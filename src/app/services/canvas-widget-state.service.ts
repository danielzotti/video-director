import {computed, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {v4 as uuid} from 'uuid';
import {
  DEFAULT_WIDGET_CONTENT,
  WidgetContent,
  WidgetState,
  WidgetStateItem,
  WidgetStateList,
} from '../models/canvas-widget-state.models';

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
      content: {type: 'text', text: 'Titolo'},
    },
    '2': {
      uuid: '2',
      x: 100,
      y: 200,
      z: 2,
      width: 400,
      height: 200,
      content: {
        type: 'image',
        src: 'https://images.unsplash.com/photo-1618005198919-d3d4b5a92eee?auto=format&fit=crop&w=1200&q=80',
        alt: 'Background astratto',
      },
    },
    '3': {
      uuid: '3',
      x: 400,
      y: 20,
      z: 3,
      width: 120,
      height: 100,
      content: {type: 'text', text: 'CTA'},
    },
    '4': {
      uuid: '4',
      x: 20,
      y: 20,
      z: 4,
      width: 91,
      height: 88,
      content: {type: 'text', text: 'Logo'},
    },
    '5': {
      uuid: '5',
      x: 332,
      y: 420,
      z: 5,
      width: 20,
      height: 33,
      content: {type: 'text', text: '1'},
    }
  });

  public list: Signal<WidgetStateList> = computed(() => Object.values(this.state()));

  public lastUpdate: WritableSignal<Date> = signal(new Date());

  public getById(uuid:WidgetStateItem["uuid"]) {
    return this.state()[uuid];
  }

  public add(widget: WidgetStateItem) {
    const newWidget = this.normalizeWidget({
      ...widget,
      x: widget.x ?? 0,
      y: widget.y ?? 0,
      ...(!widget.uuid && {uuid: uuid()}),
    });

    this.state.update((s) => ({
      ...s,
      [newWidget.uuid]: newWidget
    }));
  }

  public update(widget: WidgetStateItem) {
    this.state.update((s) => ({...s, [widget.uuid]: this.normalizeWidget(widget)}));
  }

  public remove({uuid}: { uuid: string; }) {
    const newState = {...this.state()};
    delete newState[uuid];
    this.state.set(newState);
  }

  private normalizeWidget(widget: WidgetStateItem): WidgetStateItem {
    return {
      ...widget,
      content: this.normalizeContent(widget.content),
    };
  }

  private normalizeContent(content?: WidgetContent): WidgetContent {
    if (!content) {
      return {...DEFAULT_WIDGET_CONTENT};
    }

    if (content.type === 'image') {
      return {
        type: 'image',
        src: content.src,
        alt: content.alt ?? '',
      };
    }

    return {
      type: 'text',
      text: content.text,
    };
  }
}
