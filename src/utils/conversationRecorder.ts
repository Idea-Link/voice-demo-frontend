export class ConversationRecorder {
  private mixContext: AudioContext;
  private destination: MediaStreamAudioDestinationNode;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private botSource: MediaStreamAudioSourceNode | null = null;

  constructor(sampleRate: number = 24000) {
    this.mixContext = new AudioContext({ sampleRate });
    this.destination = this.mixContext.createMediaStreamDestination();
  }

  public connectMicrophoneStream(stream: MediaStream): void {
    if (!stream) return;
    
    this.micSource = this.mixContext.createMediaStreamSource(stream);
    this.micSource.connect(this.destination);
  }

  public connectBotAudioStream(stream: MediaStream): void {
    if (!stream) return;
    
    this.botSource = this.mixContext.createMediaStreamSource(stream);
    this.botSource.connect(this.destination);
  }

  public startRecording(): void {
    if (this.isRecording) {
      console.warn('Recording already in progress');
      return;
    }

    this.recordedChunks = [];
    
    const options = this.getMediaRecorderOptions();
    this.mediaRecorder = new MediaRecorder(this.destination.stream, options);
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
    };

    this.mediaRecorder.start(1000);
    this.isRecording = true;
  }

  public async stopRecording(): Promise<Blob | null> {
    if (!this.isRecording || !this.mediaRecorder) {
      console.warn('No active recording to stop');
      return null;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.recordedChunks = [];
        this.isRecording = false;
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  public dispose(): void {
    if (this.isRecording && this.mediaRecorder) {
      this.mediaRecorder.stop();
    }
    
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    
    if (this.botSource) {
      this.botSource.disconnect();
      this.botSource = null;
    }
    
    this.mediaRecorder = null;
    this.recordedChunks = [];
    
    if (this.mixContext.state !== 'closed') {
      this.mixContext.close();
    }
  }

  private getMediaRecorderOptions(): MediaRecorderOptions {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return { mimeType, audioBitsPerSecond: 128000 };
      }
    }

    return { audioBitsPerSecond: 128000 };
  }

  public isCurrentlyRecording(): boolean {
    return this.isRecording;
  }
}

