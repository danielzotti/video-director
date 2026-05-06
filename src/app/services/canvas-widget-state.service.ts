import {computed, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {v4 as uuid} from 'uuid';
import {
  DEFAULT_WIDGET_CONTENT,
  DEFAULT_WIDGET_TEXT_STYLE,
  DEFAULT_WIDGET_VIDEO_CONTENT,
  WidgetContent,
  WidgetImageFitMode,
  WidgetTextAlignmentHorizontal,
  WidgetTextAlignmentVertical,
  WidgetTextFontFamily,
  WidgetState,
  WidgetStateItem,
  WidgetStateList,
} from '../models/canvas-widget-state.models';


const widgetListMock: WidgetState = {
    '1': {
        uuid: '1',
        x: 0,
        y: 0,
        z: 1,
        width: 200,
        height: 200,
        content: {
            type: 'text',
            text: 'This is a title',
            style: {...DEFAULT_WIDGET_TEXT_STYLE},
        },
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
            src: 'https://danielzotti.it/_next/static/media/danielzotti-logo-medium.856a381a.webp',
            alt: 'Logo Daniel Zotti',
            fitMode: 'contain',
        },
    },
    '3': {
        uuid: '3',
        x: 400,
        y: 20,
        z: 3,
        width: 120,
        height: 100,
        content: {
            type: 'text',
            text: 'CTA',
            style: {...DEFAULT_WIDGET_TEXT_STYLE},
        },
    },
    '4': {
        uuid: '4',
        x: 20,
        y: 20,
        z: 4,
        width: 91,
        height: 88,
        content: {
            type: 'text',
            text: 'Logo',
            style: {...DEFAULT_WIDGET_TEXT_STYLE},
        },
    },
    '5': {
        uuid: '5',
        x: 332,
        y: 420,
        z: 5,
        width: 20,
        height: 33,
        content: {
            type: 'text',
            text: 'This is a very long text who knows what happens',
            style: {...DEFAULT_WIDGET_TEXT_STYLE},
        },
    }
}

@Injectable({
  providedIn: 'root'
})
export class CanvasWidgetStateService {
  private state: WritableSignal<WidgetState> = signal<WidgetState>({});

   public list: Signal<WidgetStateList> = computed(() =>
     Object.values(this.state()).sort((a, b) => a.z - b.z)
   );

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

  public replaceAll(widgets: WidgetStateList) {
    const ordered = [...widgets].sort((a, b) => a.z - b.z);
    const nextState: WidgetState = {};

    ordered.forEach((widget, index) => {
      const normalized = this.normalizeWidget({
        ...widget,
        z: Number.isFinite(widget.z) ? Math.max(1, Math.round(widget.z)) : index + 1,
      });

      nextState[normalized.uuid] = normalized;
    });

    this.state.set(nextState);
    this.lastUpdate.set(new Date());
  }

   public remove({uuid}: { uuid: string; }) {
     const newState = {...this.state()};
     delete newState[uuid];
     this.state.set(newState);
   }

    public reorderLayerToIndex(uuid: string, targetIndex: number) {
      const widgets = this.list();
      const sourceWidget = widgets.find(w => w.uuid === uuid);
      if (!sourceWidget) {
        return;
      }

      const clampedIndex = Math.max(0, Math.min(targetIndex, widgets.length - 1));
      const orderedWidgets = widgets.filter(w => w.uuid !== uuid);
      const reorderedWidgets = [
        ...orderedWidgets.slice(0, clampedIndex),
        sourceWidget,
        ...orderedWidgets.slice(clampedIndex),
      ];

      const newState: WidgetState = {};
      reorderedWidgets.forEach((widget, index) => {
        newState[widget.uuid] = {
          ...widget,
          z: index + 1
        };
      });

      this.state.set(newState);
      // Trigger update for computed signals
      this.lastUpdate.set(new Date());
    }

   public moveLayerUp(uuid: string) {
     const widgets = this.list();
     const currentIndex = widgets.findIndex(w => w.uuid === uuid);
     if (currentIndex >= 0 && currentIndex < widgets.length - 1) {
       this.reorderLayerToIndex(uuid, currentIndex + 1);
     }
   }

   public moveLayerDown(uuid: string) {
     const widgets = this.list();
     const currentIndex = widgets.findIndex(w => w.uuid === uuid);
     if (currentIndex > 0) {
       this.reorderLayerToIndex(uuid, currentIndex - 1);
     }
   }

   public moveLayerToFront(uuid: string) {
     const widgets = this.list();
     this.reorderLayerToIndex(uuid, widgets.length - 1);
   }

   public moveLayerToBack(uuid: string) {
     this.reorderLayerToIndex(uuid, 0);
   }

   public renameLayer(uuid: string, name: string) {
     const widget = this.getById(uuid);
     if (!widget) {
       return;
     }
     this.update({...widget, name});
   }

  private normalizeWidget(widget: WidgetStateItem): WidgetStateItem {
    return {
      ...widget,
      locked: widget.locked ?? false,
      visible: widget.visible ?? true,
      content: this.normalizeContent(widget.content),
    };
  }

  private normalizeContent(content?: WidgetContent): WidgetContent {
    if (!content) {
      return {
        ...DEFAULT_WIDGET_CONTENT,
        ...(DEFAULT_WIDGET_CONTENT.type === 'text' ? {style: {...DEFAULT_WIDGET_TEXT_STYLE}} : {}),
      };
    }

    if (content.type === 'image') {
      return {
        type: 'image',
        src: content.src,
        alt: content.alt ?? '',
        fitMode: this.normalizeImageFitMode(content.fitMode),
      };
    }

    if (content.type === 'video') {
      return {
        type: 'video',
        src: content.src,
        poster: content.poster ?? '',
        fitMode: this.normalizeImageFitMode(content.fitMode),
        autoplay: content.autoplay ?? DEFAULT_WIDGET_VIDEO_CONTENT.autoplay,
        loop: content.loop ?? DEFAULT_WIDGET_VIDEO_CONTENT.loop,
        muted: content.muted ?? DEFAULT_WIDGET_VIDEO_CONTENT.muted,
        controls: content.controls ?? DEFAULT_WIDGET_VIDEO_CONTENT.controls,
      };
    }

    return {
      type: 'text',
      text: content.text,
      style: {
        fontSize: this.normalizeFontSize(content.style?.fontSize),
        fontFamily: this.normalizeFontFamily(content.style?.fontFamily),
        color: this.normalizeTextColor(content.style?.color),
        autoSize: content.style?.autoSize ?? DEFAULT_WIDGET_TEXT_STYLE.autoSize,
        alignHorizontal: this.normalizeHorizontalAlignment(content.style?.alignHorizontal),
        alignVertical: this.normalizeVerticalAlignment(content.style?.alignVertical),
        bold: content.style?.bold ?? DEFAULT_WIDGET_TEXT_STYLE.bold,
        italic: content.style?.italic ?? DEFAULT_WIDGET_TEXT_STYLE.italic,
        underline: content.style?.underline ?? DEFAULT_WIDGET_TEXT_STYLE.underline,
        lineHeight: this.normalizeLineHeight(content.style?.lineHeight),
      },
    };
  }

  private normalizeFontSize(value?: number): number {
    if (!Number.isFinite(value)) {
      return DEFAULT_WIDGET_TEXT_STYLE.fontSize;
    }

    return Math.max(8, Math.round(value as number));
  }

  private normalizeFontFamily(value?: string): WidgetTextFontFamily {
    if (value === 'roboto' || value === 'montserrat' || value === 'exo' || value === 'lora' || value === 'fira-code') {
      return value;
    }

    return DEFAULT_WIDGET_TEXT_STYLE.fontFamily;
  }

  private normalizeTextColor(value?: string): string {
    if (typeof value !== 'string') {
      return DEFAULT_WIDGET_TEXT_STYLE.color;
    }

    const color = value.trim();
    return color || DEFAULT_WIDGET_TEXT_STYLE.color;
  }

  private normalizeHorizontalAlignment(value?: string): WidgetTextAlignmentHorizontal {
    if (value === 'left' || value === 'center' || value === 'right') {
      return value;
    }

    return DEFAULT_WIDGET_TEXT_STYLE.alignHorizontal;
  }

   private normalizeVerticalAlignment(value?: string): WidgetTextAlignmentVertical {
     if (value === 'top' || value === 'center' || value === 'bottom') {
       return value;
     }

     return DEFAULT_WIDGET_TEXT_STYLE.alignVertical;
   }

   private normalizeLineHeight(value?: number): number {
     if (!Number.isFinite(value)) {
       return DEFAULT_WIDGET_TEXT_STYLE.lineHeight;
     }

     return Math.max(0.5, value as number);
   }

   private normalizeImageFitMode(value?: string): WidgetImageFitMode {
    return value === 'contain' ? 'contain' : 'cover';
  }
}
