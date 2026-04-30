import {computed, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {v4 as uuid} from 'uuid';
import {WidgetState, WidgetStateItem, WidgetStateList} from '../models/canvas-widget-state.models';

@Injectable({
  providedIn: 'root'
})
export class CanvasWidgetStateService {
  private state: WritableSignal<WidgetState> = signal<WidgetState>({
    '1': {
      uuid: '1',
      x: 0,
      y: 0,
      z: 1,
      width: 200,
      height: 200,
    },
    '2': {
      uuid: '2',
      x: 100,
      y: 200,
      z: 2,
      width: 400,
      height: 200,
    },
    '3': {
      uuid: '3',
      x: 400,
      y: 20,
      z: 3,
      width: 120,
      height: 100,
    },
    '4': {
      uuid: '4',
      x: 20,
      y: 20,
      z: 4,
      width: 91,
      height: 88,
    },
    '5': {
      uuid: '5',
      x: 332,
      y: 420,
      z: 5,
      width: 20,
      height: 33,
    }
  });

  public list: Signal<WidgetStateList> = computed(() => Object.values(this.state()));

  public lastUpdate: WritableSignal<Date> = signal(new Date());

  public getById(uuid:WidgetStateItem["uuid"]) {
    return this.state()[uuid];
  }

  public add(widget: WidgetStateItem) {
    const newWidget: WidgetStateItem = {
      ...widget,
      x: widget.x ?? 0,
      y: widget.y ?? 0,
      ...(!widget.uuid && {uuid: uuid()}),
    }

    this.state.update((s) => ({
      ...s,
      [newWidget.uuid]: newWidget
    }));
  }

  public update(widget: WidgetStateItem) {
    this.state.update((s) => ({...s, [widget.uuid]: widget as WidgetStateItem}));
  }

  public remove({uuid}: { uuid: string; }) {
    const newState = {...this.state()};
    delete newState[uuid];
    this.state.set(newState);
  }
}
