import {computed, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {v4 as uuid} from 'uuid';
import {StreamState, StreamStateItem, StreamStateList} from "../models/stream.model";


@Injectable({
  providedIn: 'root'
})
export class StreamStateService {
  private state: WritableSignal<StreamState> = signal<StreamState>({});

  public records: Signal<StreamState> = computed(() => this.state());
  public list: Signal<StreamStateList> = computed(() => Object.values(this.state()));

  public lastUpdate: WritableSignal<Date> = signal(new Date());

  public addStream(stream: StreamStateItem) {

    const videoTracksCount = stream.mediaStream?.getVideoTracks().length;
    const videoTrack = stream.mediaStream?.getVideoTracks()[0];
    const settings = videoTrack?.getSettings();
    const constraints = videoTrack?.getConstraints();

    console.log({videoTracksCount})

    if (videoTrack) {
      // This is needed to detect when the video track is stopped by the user through the browser stop button
      videoTrack.onended = () => {
        this.lastUpdate.set(new Date());
        this.stopStream(stream);
      };
    }

    const newStream = {
      ...stream,
      uuid: stream.uuid ?? uuid(),
      constraints,
      settings
    }

    this.state.update((s) => ({
      ...s,
      [stream.uuid ?? uuid()]: newStream
    }));
  }

  public updateStream(stream: StreamStateItem) {
    this.state.update((s) => ({...s, [stream.uuid]: stream}));
  }

  public removeStream({uuid}: { uuid: string; }) {
    const {[uuid]: _, ...newState} = this.state();
    this.state.set(newState);
  }

  public stopStream(item: StreamStateItem) {
    item.mediaStream?.getTracks().forEach((track) => track.stop());
    this.removeStream({uuid: item.uuid});
  }

  // Can be exported in a different service / utils!
  public getStreamVideoTracks(mediaStream: MediaStream) {
    return mediaStream.getVideoTracks();
  }

  public getStreamVideoTrack(mediaStream: MediaStream) {
    return this.getStreamVideoTracks(mediaStream)?.at(0)  // TODO: Change that zero with something dynamic
  }

  public getStreamSettings(mediaStream: MediaStream) {
    return this.getStreamVideoTrack(mediaStream)?.getSettings();
  }
}
