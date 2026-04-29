export type StreamState = Record<string, StreamStateItem>;

export interface StreamStateItem {
  uuid: string;
  type?: "video" | "audio" | "screen";
  mediaStream?: MediaStream;
  constraints?: MediaTrackConstraints;
  settings?: MediaTrackSettings;
  // aspectRatio: number;
  // isStarted: boolean;
  // isVideoEnabled: boolean;
  // isAudioEnabled: boolean;
}

export type StreamStateList = StreamStateItem[];
