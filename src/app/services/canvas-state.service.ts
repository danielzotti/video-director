import {Injectable, signal, WritableSignal} from '@angular/core';
import {CanvasState} from "../models/canvas-state.models";

@Injectable({
  providedIn: 'root'
})
export class CanvasStateService {
  public state: WritableSignal<CanvasState> = signal<CanvasState>({
    uuid: '1',
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    zoom: 1
  });

  public lastUpdate: WritableSignal<Date> = signal(new Date());
}
