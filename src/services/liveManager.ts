import {
  ClientSocketMessage,
  ConnectionState,
  ServerSocketMessage,
  SocketMessageType
} from '../types/conversation';
import {
  decodePcm16Base64ToBuffer,
  float32ToPcm16Base64
} from '../utils/audioUtils';
import { ConversationRecorder } from '../utils/conversationRecorder';

interface LiveManagerCallbacks {
  onLog: (role: 'user' | 'model' | 'system', text: string) => void;
  onError: (error: string) => void;
  onClose: () => void;
  onVolumeUpdate: (inputVol: number, outputVol: number) => void;
}

interface LiveManagerOptions {
  backendUrl?: string;
  appRoute?: string;
}

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const CHUNK_SIZE = 4096;
const HEARTBEAT_INTERVAL_MS = 15000;

export class LiveManager {
  private socket: WebSocket | null = null;
  private readyPromise: Promise<void> | null = null;
  private resolveReady?: () => void;
  private rejectReady?: (reason?: unknown) => void;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private outputNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private animationFrameId: number | null = null;
  private heartbeatId: number | null = null;
  private nextStartTime = 0;
  private socketReady = false;
  private seq = 0;
  private backendUrl: string;
  private appRoute?: string;
  private conversationRecorder: ConversationRecorder | null = null;
  private sessionId: string | null = null;
  private recordingToken: string | null = null;
  private botAudioDestination: MediaStreamAudioDestinationNode | null = null;

  constructor(
    private callbacks: LiveManagerCallbacks,
    options?: LiveManagerOptions
  ) {
    const envWs = import.meta.env.VITE_BACKEND_WS_URL as string | undefined;
    const envHttp = import.meta.env.VITE_BACKEND_URL as string | undefined;
    this.backendUrl =
      options?.backendUrl ??
      envWs ??
      envHttp ??
      'http://localhost:4000';
    this.appRoute = options?.appRoute;
  }

  public async connect() {
    if (this.readyPromise) {
      return this.readyPromise;
    }
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = () => {
        this.readyPromise = null;
        this.resolveReady = undefined;
        this.rejectReady = undefined;
        resolve();
      };
      this.rejectReady = (error) => {
        this.readyPromise = null;
        this.resolveReady = undefined;
        this.rejectReady = undefined;
        reject(error);
      };
    });

    try {
      await this.initializeAudioPipelines();
      this.openSocket();
    } catch (error) {
      this.teardownAudio();
      this.rejectReady?.(error);
      throw error;
    }

    return this.readyPromise;
  }

  private async initializeAudioPipelines() {
    this.outputAudioContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    this.outputNode = this.outputAudioContext.createGain();
    this.analyser = this.outputAudioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.outputNode.connect(this.analyser);
    this.outputNode.connect(this.outputAudioContext.destination);
    
    this.botAudioDestination = this.outputAudioContext.createMediaStreamDestination();
    this.outputNode.connect(this.botAudioDestination);
    
    this.startVolumeMonitoring();

    this.inputAudioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    this.processor = this.inputAudioContext.createScriptProcessor(
      CHUNK_SIZE,
      1,
      1
    );
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    });
    const source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor.onaudioprocess = (event) => {
      const channelData = event.inputBuffer.getChannelData(0);
      this.handleMicChunk(channelData);
    };
    source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);

    this.conversationRecorder = new ConversationRecorder(OUTPUT_SAMPLE_RATE);
    
    if (this.stream) {
      this.conversationRecorder.connectMicrophoneStream(this.stream);
    }
    if (this.botAudioDestination) {
      this.conversationRecorder.connectBotAudioStream(this.botAudioDestination.stream);
    }
  }

  private openSocket() {
    const wsUrl = this.resolveWsUrl();
    this.socket = new WebSocket(wsUrl);
    this.socket.addEventListener('open', () => {
      this.socketReady = true;
      this.sendHello();
      this.startHeartbeat();
    });
    this.socket.addEventListener('message', (event) =>
      this.handleSocketMessage(event.data)
    );
    this.socket.addEventListener('error', () => {
      const error = new Error('WebSocket connection error');
      this.callbacks.onError(error.message);
      this.rejectReady?.(error);
    });
    this.socket.addEventListener('close', () => {
      if (this.readyPromise) {
        this.rejectReady?.(new Error('Socket closed before session became ready'));
      }
      this.socketReady = false;
      this.stopHeartbeat();
      this.callbacks.onClose();
      this.teardownAudio();
    });
  }

  private sendHello() {
    const hello: ClientSocketMessage = {
      type: SocketMessageType.CLIENT_HELLO,
      payload: {
        locale: navigator.language || 'en-US',
        sampleRate: INPUT_SAMPLE_RATE,
        appRoute: this.appRoute
      },
      timestamp: Date.now()
    };
    this.send(hello);
  }

  private handleMicChunk(channelData: Float32Array) {
    if (!this.socketReady || !this.socket) return;
    const base64 = float32ToPcm16Base64(channelData);
    const payload: ClientSocketMessage = {
      type: SocketMessageType.CLIENT_AUDIO_CHUNK,
      payload: {
        chunk: base64,
        sampleRate: INPUT_SAMPLE_RATE
      },
      timestamp: Date.now(),
      seq: this.nextSeq()
    };
    this.send(payload);
  }

  private handleSocketMessage(data: string | ArrayBuffer) {
    const text =
      typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
    let message: ServerSocketMessage;
    try {
      message = JSON.parse(text);
    } catch (error) {
      console.error('Invalid socket payload', error);
      return;
    }

    switch (message.type) {
      case SocketMessageType.SERVER_READY:
        this.callbacks.onLog('system', 'Prisijungta prie IdeaLink asistento');
        
        if (message.payload.sessionId) {
          this.sessionId = message.payload.sessionId;
        }
        if (message.payload.recordingToken) {
          this.recordingToken = message.payload.recordingToken;
        }
        
        if (this.conversationRecorder && !this.conversationRecorder.isCurrentlyRecording()) {
          this.conversationRecorder.startRecording();
        }
        
        this.resolveReady?.();
        break;
      case SocketMessageType.SERVER_STATUS:
        if (message.payload.detail) {
          this.callbacks.onLog('system', message.payload.detail);
        }
        if (message.payload.state === ConnectionState.ERROR) {
          const detail = message.payload.detail ?? 'Ryšio klaida';
          this.callbacks.onError(detail);
          if (this.readyPromise) {
            this.rejectReady?.(new Error(detail));
          }
        }
        break;
      case SocketMessageType.SERVER_TRANSCRIPT:
        this.callbacks.onLog(message.payload.role, message.payload.text);
        break;
      case SocketMessageType.SERVER_AUDIO_CHUNK:
        this.enqueueAudioChunk(message).catch((error) =>
          console.error('Audio chunk decode failed', error)
        );
        break;
      case SocketMessageType.SERVER_ERROR:
        this.callbacks.onError(message.payload.message);
        if (this.readyPromise) {
          this.rejectReady?.(new Error(message.payload.message));
        }
        break;
      case SocketMessageType.SERVER_AUDIO_FLUSH:
        this.flushAudioQueue();
        break;
      case SocketMessageType.HEARTBEAT:
        this.send({
          type: SocketMessageType.HEARTBEAT,
          payload: { kind: 'pong' },
          timestamp: Date.now()
        });
        break;
      default:
        break;
    }
  }

  private async enqueueAudioChunk(message: ServerSocketMessage) {
    if (
      message.type !== SocketMessageType.SERVER_AUDIO_CHUNK ||
      !this.outputAudioContext ||
      !this.outputNode
    ) {
      return;
    }

    const buffer = await decodePcm16Base64ToBuffer(
      message.payload.chunk,
      this.outputAudioContext,
      message.payload.sampleRate ?? OUTPUT_SAMPLE_RATE,
      1
    );

    const source = this.outputAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputNode);
    source.addEventListener('ended', () => this.sources.delete(source));

    const startAt = Math.max(
      this.nextStartTime,
      this.outputAudioContext.currentTime
    );
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.sources.add(source);
  }

  private flushAudioQueue() {
    this.sources.forEach((source) => {
      try {
        source.stop();
      } catch (e) {
      }
    });
    this.sources.clear();
    if (this.outputAudioContext) {
      this.nextStartTime = this.outputAudioContext.currentTime;
    }
  }

  private send(message: ClientSocketMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  private startVolumeMonitoring() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const update = () => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);
      const avg =
        dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      this.callbacks.onVolumeUpdate(0, avg / 255);
      this.animationFrameId = requestAnimationFrame(update);
    };

    update();
  }

  private stopVolumeMonitoring() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatId = window.setInterval(() => {
      this.send({
        type: SocketMessageType.HEARTBEAT,
        payload: { kind: 'ping' },
        timestamp: Date.now()
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatId) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
  }

  public async disconnect() {
    const hadSocket = Boolean(this.socket);
    if (this.conversationRecorder && this.conversationRecorder.isCurrentlyRecording()) {
      try {
        const recordingBlob = await this.conversationRecorder.stopRecording();
        if (recordingBlob) {
          await this.uploadRecording(recordingBlob);
        }
      } catch (error) {
        console.error('Failed to save recording:', error);
        this.callbacks.onError('Failed to save conversation recording');
      }
    }
    
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send({
        type: SocketMessageType.CLIENT_END,
        payload: { reason: 'user_disconnect' },
        timestamp: Date.now()
      });
      this.socket.close();
    }
    this.socket = null;
    this.socketReady = false;
    this.stopHeartbeat();
    this.teardownAudio();
    if (!hadSocket) {
      this.callbacks.onClose();
    }
  }

  private teardownAudio() {
    this.sources.forEach((source) => source.stop());
    this.sources.clear();

    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.botAudioDestination) {
      this.botAudioDestination = null;
    }

    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }

    if (this.outputAudioContext) {
      this.outputAudioContext.close();
      this.outputAudioContext = null;
    }

    if (this.conversationRecorder) {
      this.conversationRecorder.dispose();
      this.conversationRecorder = null;
    }

    this.stopVolumeMonitoring();
    this.nextStartTime = 0;
    this.seq = 0;
    this.sessionId = null;
    this.recordingToken = null;
  }

  private resolveWsUrl() {
    const trimmed = this.backendUrl.replace(/\/$/, '');
    if (trimmed.startsWith('ws')) {
      return `${trimmed}/ws`;
    }
    if (trimmed.startsWith('http')) {
      return `${trimmed.replace(/^http/, 'ws')}/ws`;
    }
    return `ws://${trimmed}/ws`;
  }

  private nextSeq() {
    this.seq += 1;
    return this.seq;
  }

  private async uploadRecording(blob: Blob): Promise<void> {
    if (!this.recordingToken) {
      console.warn('No recording token available - skipping upload');
      this.callbacks.onLog('system', 'Recording not saved: authentication required');
      return;
    }

    const formData = new FormData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `conversation_${timestamp}.webm`;
    
    formData.append('audio', blob, filename);
    
    if (this.sessionId) {
      formData.append('sessionId', this.sessionId);
    }
    
    formData.append('timestamp', new Date().toISOString());
    formData.append('appRoute', this.appRoute || 'default');

    const uploadUrl = `${import.meta.env.VITE_BACKEND_URL}/api/recordings`;
    
    try {
      this.callbacks.onLog('system', 'Uploading conversation recording...');
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'X-Recording-Token': this.recordingToken,
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed');
        }
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      this.callbacks.onLog('system', 'Recording saved successfully');
    } catch (error) {
      console.error('Failed to upload recording:', error);
      throw error;
    }
  }
}

