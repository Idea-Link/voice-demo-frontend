export type ConversationRole = 'user' | 'model' | 'system';

export interface LogMessage {
  role: ConversationRole;
  text: string;
  timestamp: Date;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface ClientHelloPayload {
  locale: string;
  sampleRate: number;
}

export interface ClientAudioChunkPayload {
  chunk: string;
  sampleRate: number;
  isLastChunk?: boolean;
}

export interface ServerReadyPayload {
  sessionId: string;
}

export interface ServerAudioChunkPayload {
  chunk: string;
  sampleRate: number;
  isLastChunk?: boolean;
}

export interface ServerTranscriptPayload {
  role: ConversationRole;
  text: string;
  final: boolean;
}

export interface ServerStatusPayload {
  state: ConnectionState;
  detail?: string;
}

export interface ServerErrorPayload {
  code: string;
  message: string;
}

export enum SocketMessageType {
  CLIENT_HELLO = 'client_hello',
  CLIENT_AUDIO_CHUNK = 'client_audio_chunk',
  CLIENT_END = 'client_end',
  HEARTBEAT = 'heartbeat',
  SERVER_READY = 'server_ready',
  SERVER_AUDIO_CHUNK = 'server_audio_chunk',
  SERVER_TRANSCRIPT = 'server_transcript',
  SERVER_STATUS = 'server_status',
  SERVER_ERROR = 'server_error'
}

export interface SocketEnvelope<
  TType extends SocketMessageType,
  TPayload = undefined
> {
  type: TType;
  payload: TPayload;
  seq?: number;
  timestamp: number;
}

export type ClientHelloMessage = SocketEnvelope<
  SocketMessageType.CLIENT_HELLO,
  ClientHelloPayload
>;

export type ClientAudioChunkMessage = SocketEnvelope<
  SocketMessageType.CLIENT_AUDIO_CHUNK,
  ClientAudioChunkPayload
>;

export type ClientEndMessage = SocketEnvelope<
  SocketMessageType.CLIENT_END,
  { reason?: string }
>;

export type HeartbeatMessage = SocketEnvelope<
  SocketMessageType.HEARTBEAT,
  { kind: 'ping' | 'pong' }
>;

export type ServerReadyMessage = SocketEnvelope<
  SocketMessageType.SERVER_READY,
  ServerReadyPayload
>;

export type ServerAudioChunkMessage = SocketEnvelope<
  SocketMessageType.SERVER_AUDIO_CHUNK,
  ServerAudioChunkPayload
>;

export type ServerTranscriptMessage = SocketEnvelope<
  SocketMessageType.SERVER_TRANSCRIPT,
  ServerTranscriptPayload
>;

export type ServerStatusMessage = SocketEnvelope<
  SocketMessageType.SERVER_STATUS,
  ServerStatusPayload
>;

export type ServerErrorMessage = SocketEnvelope<
  SocketMessageType.SERVER_ERROR,
  ServerErrorPayload
>;

export type ClientSocketMessage =
  | ClientHelloMessage
  | ClientAudioChunkMessage
  | ClientEndMessage
  | HeartbeatMessage;

export type ServerSocketMessage =
  | ServerReadyMessage
  | ServerAudioChunkMessage
  | ServerTranscriptMessage
  | ServerStatusMessage
  | ServerErrorMessage
  | HeartbeatMessage;

export type AnySocketMessage = ClientSocketMessage | ServerSocketMessage;

