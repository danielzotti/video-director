import {TestBed} from '@angular/core/testing';
import {CanvasService} from './canvas.service';
import {DEFAULT_WIDGET_TEXT_STYLE, WidgetStateList} from '../models/canvas-widget-state.models';

describe('CanvasService', () => {
  let service: CanvasService;
  const editorStorageKey = 'video-director.editor-state.v1';

  type WritableLike = { write: (data: Blob) => Promise<void>; close: () => Promise<void> };

  interface MemoryFileHandle {
    getFile: () => Promise<File>;
    createWritable: () => Promise<WritableLike>;
  }

  interface MemoryDirectoryHandle {
    name: string;
    getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<MemoryDirectoryHandle>;
    getFileHandle: (name: string, options?: { create?: boolean }) => Promise<MemoryFileHandle>;
    entries: () => AsyncIterable<[string, unknown]>;
    removeEntry: (name: string) => Promise<void>;
  }

  const createMemoryDirectoryHandle = (
    name: string,
    pathPrefix = '',
    files = new Map<string, Blob>(),
  ): MemoryDirectoryHandle => {
    const directories = new Map<string, MemoryDirectoryHandle>();

    return {
      name,
      async getDirectoryHandle(childName: string, options?: { create?: boolean }) {
        const existing = directories.get(childName);
        if (existing) {
          return existing;
        }

        if (!options?.create) {
          throw new Error(`Directory not found: ${childName}`);
        }

        const childPath = pathPrefix ? `${pathPrefix}/${childName}` : childName;
        const child = createMemoryDirectoryHandle(childName, childPath, files);
        directories.set(childName, child);
        return child;
      },
      async getFileHandle(fileName: string, options?: { create?: boolean }) {
        const filePath = pathPrefix ? `${pathPrefix}/${fileName}` : fileName;
        const existingBlob = files.get(filePath);

        if (!existingBlob && !options?.create) {
          throw new Error(`File not found: ${filePath}`);
        }

        return {
          getFile: async () => {
            const blob = files.get(filePath) ?? new Blob([], {type: 'application/octet-stream'});
            return new File([blob], fileName, {type: blob.type || 'application/octet-stream'});
          },
          createWritable: async () => ({
            write: async (data: Blob) => {
              files.set(filePath, data);
            },
            close: async () => undefined,
          }),
        };
      },
      entries: async function* () {
        const prefix = pathPrefix ? `${pathPrefix}/` : '';
        const emitted = new Set<string>();

        for (const filePath of files.keys()) {
          if (!filePath.startsWith(prefix)) {
            continue;
          }

          const relative = filePath.slice(prefix.length);
          if (!relative || relative.includes('/')) {
            continue;
          }

          if (emitted.has(relative)) {
            continue;
          }

          emitted.add(relative);
          yield [relative, {}];
        }
      },
      removeEntry: async (entryName: string) => {
        const entryPath = pathPrefix ? `${pathPrefix}/${entryName}` : entryName;
        files.delete(entryPath);
      },
    };
  };

  const createCanvasElements = () => {
    const canvas = document.createElement('div');
    const wrapper = document.createElement('div');

    spyOn(wrapper, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 1280, 720));
    spyOn(canvas, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 1280, 720));

    return { canvas, wrapper };
  };

  const createSeedWidgets = (): WidgetStateList => [
    {
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
    {
      uuid: '2',
      x: 100,
      y: 200,
      z: 2,
      width: 400,
      height: 200,
      content: {
        type: 'image',
        src: 'https://example.com/logo.webp',
        alt: 'Logo',
        fitMode: 'contain',
      },
    },
    {
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
  ];

  beforeEach(() => {
    localStorage.removeItem(editorStorageKey);
    delete (globalThis as unknown as {showDirectoryPicker?: unknown}).showDirectoryPicker;
    TestBed.configureTestingModule({});
    service = TestBed.inject(CanvasService);
    service.widgetsState.replaceAll(createSeedWidgets());
  });

  it('marks project directory restore as ready after startup restore attempt', async () => {
    for (let attempt = 0; attempt < 20 && !service.projectDirectoryRestoreReady(); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(service.projectDirectoryRestoreReady()).toBeTrue();
  });

  it('returns temporary top z-index for selected widget', () => {
    service.selectWidget('1');

    const selected = service.widgetsState.getById('1');
    expect(selected).toBeTruthy();

    const maxZ = service.widgetsState.list().reduce((max, item) => Math.max(max, item.z), 0);
    expect(service.getWidgetRenderZIndex(selected!)).toBe(maxZ + 1);
  });

  it('keeps base z-index for non-selected widgets', () => {
    service.selectWidget('1');

    const notSelected = service.widgetsState.getById('2');
    expect(notSelected).toBeTruthy();

    expect(service.getWidgetRenderZIndex(notSelected!)).toBe(notSelected!.z);
  });

  it('restores base z-index when selection is cleared', () => {
    service.selectWidget('1');
    service.selectWidget(null);

    const widget = service.widgetsState.getById('1');
    expect(widget).toBeTruthy();

    expect(service.getWidgetRenderZIndex(widget!)).toBe(widget!.z);
  });

  it('creates and selects a new text widget on top of layers', () => {
    const before = service.widgetsState.list();
    const beforeMaxZ = before.reduce((max, item) => Math.max(max, item.z), 0);

    service.createTextWidget();

    const after = service.widgetsState.list();
    expect(after.length).toBe(before.length + 1);

    const created = after[after.length - 1];
    expect(created.content.type).toBe('text');
    expect(created.z).toBe(beforeMaxZ + 1);
    expect(service.selectedWidgetId()).toBe(created.uuid);
  });

  it('creates image widget centered in viewport using zoom-aware mapping', () => {
    const {canvas, wrapper} = createCanvasElements();
    service.init({
      canvas,
      canvasWrapper: wrapper,
      width: 800,
      height: 600,
      zoom: 2,
      allowSnapToGrid: false,
      allowExitBorders: true,
    });

    service.createImageWidget();

    const created = service.widgetsState.list().at(-1);
    expect(created).toBeTruthy();
    expect(created!.content.type).toBe('image');
    expect(created!.x).toBe(160);
    expect(created!.y).toBe(90);
  });

  it('creates and selects a new video widget on top of layers', () => {
    const before = service.widgetsState.list();
    const beforeMaxZ = before.reduce((max, item) => Math.max(max, item.z), 0);

    service.createVideoWidget();

    const after = service.widgetsState.list();
    expect(after.length).toBe(before.length + 1);

    const created = after[after.length - 1];
    expect(created.content.type).toBe('video');
    expect(created.z).toBe(beforeMaxZ + 1);
    expect(service.selectedWidgetId()).toBe(created.uuid);
  });

  it('auto-rounds geometry values when snap to grid is enabled', () => {
    service.selectWidget('1');
    service.setWidgetResize(true);
    service.setSnapToGrid(true);
    service.setSnapSize(10);

    service.setSelectedWidgetX(17);
    service.setSelectedWidgetY(26);
    service.setSelectedWidgetWidth(27);
    service.setSelectedWidgetHeight(34);

    const widget = service.widgetsState.getById('1');
    expect(widget).toBeTruthy();
    expect(widget!.x).toBe(20);
    expect(widget!.y).toBe(30);
    expect(widget!.width).toBe(30);
    expect(widget!.height).toBe(30);
  });

  it('clamps geometry inside canvas when exit borders is disabled', () => {
    service.selectWidget('1');
    service.setWidgetResize(true);
    service.setExitBorders(false);

    service.setSelectedWidgetWidth(9999);
    service.setSelectedWidgetHeight(9999);
    service.setSelectedWidgetX(9999);
    service.setSelectedWidgetY(9999);

    const widget = service.widgetsState.getById('1');
    expect(widget).toBeTruthy();
    expect(widget!.width).toBe(800);
    expect(widget!.height).toBe(600);
    expect(widget!.x).toBe(0);
    expect(widget!.y).toBe(0);
  });

  it('ignores width/height updates when widget resize is disabled', () => {
    service.selectWidget('1');
    service.setWidgetResize(false);

    const before = service.widgetsState.getById('1');
    expect(before).toBeTruthy();

    service.setSelectedWidgetWidth((before?.width ?? 0) + 100);
    service.setSelectedWidgetHeight((before?.height ?? 0) + 100);

    const after = service.widgetsState.getById('1');
    expect(after).toBeTruthy();
    expect(after!.width).toBe(before!.width);
    expect(after!.height).toBe(before!.height);
  });

  it('toggles widget move flag', () => {
    service.setWidgetMove(false);
    expect(service.canMoveWidget()).toBeFalse();

    service.setWidgetMove(true);
    expect(service.canMoveWidget()).toBeTrue();
  });

  it('moves selected widget by 1px with arrow keys when snap to grid is disabled', () => {
    service.selectWidget('1');
    service.setSnapToGrid(false);
    service.setWidgetMove(true);

    const handled = service.moveSelectedWidgetByArrowKey({key: 'ArrowRight', shiftKey: false});
    const widget = service.widgetsState.getById('1');

    expect(handled).toBeTrue();
    expect(widget?.x).toBe(1);
    expect(widget?.y).toBe(0);
  });

  it('moves selected widget by 10px with shift+arrow when snap to grid is disabled', () => {
    service.selectWidget('1');
    service.setSnapToGrid(false);
    service.setWidgetMove(true);

    const handled = service.moveSelectedWidgetByArrowKey({key: 'ArrowDown', shiftKey: true});
    const widget = service.widgetsState.getById('1');

    expect(handled).toBeTrue();
    expect(widget?.x).toBe(0);
    expect(widget?.y).toBe(10);
  });

  it('moves selected widget by one grid step with arrow keys when snap to grid is enabled', () => {
    service.selectWidget('1');
    service.setSnapToGrid(true);
    service.setSnapSize(8);
    service.setWidgetMove(true);

    const handled = service.moveSelectedWidgetByArrowKey({key: 'ArrowRight', shiftKey: false});
    const widget = service.widgetsState.getById('1');

    expect(handled).toBeTrue();
    expect(widget?.x).toBe(8);
    expect(widget?.y).toBe(0);
  });

  it('moves selected widget by three grid steps with shift+arrow when snap to grid is enabled', () => {
    service.selectWidget('1');
    service.setSnapToGrid(true);
    service.setSnapSize(8);
    service.setWidgetMove(true);

    const handled = service.moveSelectedWidgetByArrowKey({key: 'ArrowDown', shiftKey: true});
    const widget = service.widgetsState.getById('1');

    expect(handled).toBeTrue();
    expect(widget?.x).toBe(0);
    expect(widget?.y).toBe(24);
  });

  it('does not move selected widget with arrow keys when widget move is disabled', () => {
    service.selectWidget('1');
    service.setSnapToGrid(false);
    service.setWidgetMove(false);

    const handled = service.moveSelectedWidgetByArrowKey({key: 'ArrowRight', shiftKey: false});
    const widget = service.widgetsState.getById('1');

    expect(handled).toBeTrue();
    expect(widget?.x).toBe(0);
    expect(widget?.y).toBe(0);
  });

  it('keeps selected widget inside bounds with arrow keys when exit borders is disabled', () => {
    service.selectWidget('1');
    service.setSnapToGrid(false);
    service.setWidgetMove(true);
    service.setExitBorders(false);

    const handled = service.moveSelectedWidgetByArrowKey({key: 'ArrowLeft', shiftKey: false});
    const widget = service.widgetsState.getById('1');

    expect(handled).toBeTrue();
    expect(widget?.x).toBe(0);
    expect(widget?.y).toBe(0);
  });

  it('selects widget on pointerdown even when widget move is disabled', () => {
    service.canvasEl = document.createElement('div');
    const widgetEl = document.createElement('div');
    const widget = service.widgetsState.getById('2');
    expect(widget).toBeTruthy();

    service.selectWidget(null);
    service.setWidgetMove(false);

    const event = new PointerEvent('pointerdown', {button: 0});

    service.widgetDragStart({
      widget: widget!,
      el: widgetEl,
      event,
    });

    expect(service.selectedWidgetId()).toBe('2');
    expect(service.isDraggingWidget()).toBeFalse();
    expect(widgetEl.classList.contains(service.WIDGET_DRAGGING_CLASS)).toBeFalse();
  });

  it('prevents drag start when widget is locked', () => {
    service.canvasEl = document.createElement('div');
    const widgetEl = document.createElement('div');
    service.selectWidget(null);
    const beforeSelected = service.selectedWidgetId();
    service.setWidgetLocked('1', true);

    const widget = service.widgetsState.getById('1');
    expect(widget?.locked).toBeTrue();

    const event = new PointerEvent('pointerdown', {button: 0});
    service.widgetDragStart({
      widget: widget!,
      el: widgetEl,
      event,
    });

    expect(service.selectedWidgetId()).toBe(beforeSelected);
    expect(service.isDraggingWidget()).toBeFalse();
    expect(widgetEl.classList.contains(service.WIDGET_DRAGGING_CLASS)).toBeFalse();
  });

  it('ignores geometry updates when selected widget is locked', () => {
    service.selectWidget('1');
    service.setWidgetResize(true);

    const before = service.widgetsState.getById('1');
    expect(before).toBeTruthy();

    service.setSelectedWidgetLocked(true);
    service.setSelectedWidgetX((before?.x ?? 0) + 10);
    service.setSelectedWidgetY((before?.y ?? 0) + 10);
    service.setSelectedWidgetWidth((before?.width ?? 0) + 10);
    service.setSelectedWidgetHeight((before?.height ?? 0) + 10);

    const after = service.widgetsState.getById('1');
    expect(after).toBeTruthy();
    expect(after!.x).toBe(before!.x);
    expect(after!.y).toBe(before!.y);
    expect(after!.width).toBe(before!.width);
    expect(after!.height).toBe(before!.height);
  });

  it('updates selected image fit mode', () => {
    service.selectWidget('2');
    service.setSelectedWidgetImageFitMode('contain');

    const widget = service.widgetsState.getById('2');
    expect(widget?.content.type).toBe('image');
    if (widget?.content.type === 'image') {
      expect(widget.content.fitMode).toBe('contain');
    }
  });

  it('updates selected image crop settings', () => {
    service.selectWidget('2');
    service.setSelectedWidgetImageFitMode('crop');
    service.setSelectedWidgetImageOffsetX(-25);
    service.setSelectedWidgetImageOffsetY(-75);
    service.setSelectedWidgetImageCropZoom(2.4);

    const widget = service.widgetsState.getById('2');
    expect(widget?.content.type).toBe('image');
    if (widget?.content.type === 'image') {
      expect(widget.content.fitMode).toBe('crop');
      expect(widget.content.offsetX).toBe(-25);
      expect(widget.content.offsetY).toBe(-75);
      expect(widget.content.cropZoom).toBeCloseTo(2.4, 3);
    }
  });

  it('clamps selected image crop values inside supported range', () => {
    service.selectWidget('2');
    service.setSelectedWidgetImageFitMode('crop');
    service.setSelectedWidgetImageOffsetX(25);
    service.setSelectedWidgetImageOffsetY(-125);
    service.setSelectedWidgetImageCropZoom(9);

    const widget = service.widgetsState.getById('2');
    expect(widget?.content.type).toBe('image');
    if (widget?.content.type === 'image') {
      expect(widget.content.offsetX).toBe(0);
      expect(widget.content.offsetY).toBe(-100);
      expect(widget.content.cropZoom).toBe(5);
    }
  });

  it('switches selected widget content to video with default values', () => {
    service.selectWidget('2');

    service.setSelectedWidgetContentType('video');

    const widget = service.widgetsState.getById('2');
    expect(widget?.content.type).toBe('video');
    if (widget?.content.type === 'video') {
      expect(widget.content.src).toBe('');
      expect(widget.content.poster).toBe('');
      expect(widget.content.fitMode).toBe('cover');
      expect(widget.content.autoplay).toBeFalse();
      expect(widget.content.loop).toBeFalse();
      expect(widget.content.muted).toBeTrue();
      expect(widget.content.controls).toBeTrue();
      expect(widget.content.offsetX).toBe(-50);
      expect(widget.content.offsetY).toBe(-50);
      expect(widget.content.cropZoom).toBe(1);
    }
  });

  it('updates selected video settings', () => {
    service.selectWidget('2');
    service.setSelectedWidgetContentType('video');

    service.setSelectedWidgetVideoSrc('https://cdn.example.com/video.mp4');
    service.setSelectedWidgetVideoPoster('https://cdn.example.com/poster.jpg');
    service.setSelectedWidgetVideoFitMode('contain');
    service.setSelectedWidgetVideoAutoplay(true);
    service.setSelectedWidgetVideoLoop(true);
    service.setSelectedWidgetVideoMuted(false);
    service.setSelectedWidgetVideoControls(false);

    const widget = service.widgetsState.getById('2');
    expect(widget?.content.type).toBe('video');
    if (widget?.content.type === 'video') {
      expect(widget.content.src).toBe('https://cdn.example.com/video.mp4');
      expect(widget.content.poster).toBe('https://cdn.example.com/poster.jpg');
      expect(widget.content.fitMode).toBe('contain');
      expect(widget.content.autoplay).toBeTrue();
      expect(widget.content.loop).toBeTrue();
      expect(widget.content.muted).toBeFalse();
      expect(widget.content.controls).toBeFalse();
    }
  });

  it('updates selected video crop settings', () => {
    service.selectWidget('2');
    service.setSelectedWidgetContentType('video');
    service.setSelectedWidgetVideoFitMode('crop');
    service.setSelectedWidgetVideoOffsetX(-20);
    service.setSelectedWidgetVideoOffsetY(-60);
    service.setSelectedWidgetVideoCropZoom(1.8);

    const widget = service.widgetsState.getById('2');
    expect(widget?.content.type).toBe('video');
    if (widget?.content.type === 'video') {
      expect(widget.content.fitMode).toBe('crop');
      expect(widget.content.offsetX).toBe(-20);
      expect(widget.content.offsetY).toBe(-60);
      expect(widget.content.cropZoom).toBeCloseTo(1.8, 3);
    }
  });

  it('accepts data image URLs as valid image source', () => {
    const isValid = service.isValidImageUrl('data:image/png;base64,AAAA');
    expect(isValid).toBeTrue();
  });

  it('accepts blob URLs as valid image source', () => {
    const isValid = service.isValidImageUrl('blob:https://example.com/1234-5678');
    expect(isValid).toBeTrue();
  });

  it('accepts http/https and blob URLs as valid video source', () => {
    expect(service.isValidVideoUrl('https://example.com/video.mp4')).toBeTrue();
    expect(service.isValidVideoUrl('http://example.com/video.mp4')).toBeTrue();
    expect(service.isValidVideoUrl('blob:https://example.com/1234-5678')).toBeTrue();
  });

  it('toggles video playback through registered video element', async () => {
    service.selectWidget('2');
    service.setSelectedWidgetContentType('video');

    const videoElement = document.createElement('video');
    Object.defineProperty(videoElement, 'paused', {value: true, writable: true, configurable: true});
    Object.defineProperty(videoElement, 'ended', {value: false, writable: true, configurable: true});

    const playSpy = spyOn(videoElement, 'play').and.callFake(async () => {
      Object.defineProperty(videoElement, 'paused', {value: false, writable: true, configurable: true});
    });
    const pauseSpy = spyOn(videoElement, 'pause').and.callFake(() => {
      Object.defineProperty(videoElement, 'paused', {value: true, writable: true, configurable: true});
    });

    service.registerWidgetVideoElement('2', videoElement);
    expect(service.canControlWidgetVideo('2')).toBeTrue();
    expect(service.isWidgetVideoPlaying('2')).toBeFalse();

    service.toggleWidgetVideoPlayback('2');
    await Promise.resolve();

    expect(playSpy).toHaveBeenCalled();
    expect(service.isWidgetVideoPlaying('2')).toBeTrue();

    service.toggleWidgetVideoPlayback('2');

    expect(pauseSpy).toHaveBeenCalled();
    expect(service.isWidgetVideoPlaying('2')).toBeFalse();
  });

  it('cleans registered video controller state when widget is deleted', () => {
    service.selectWidget('2');
    service.setSelectedWidgetContentType('video');

    const videoElement = document.createElement('video');
    service.registerWidgetVideoElement('2', videoElement);
    service.setWidgetVideoPlaybackState('2', true);

    service.deleteWidget('2');

    expect(service.canControlWidgetVideo('2')).toBeFalse();
    expect(service.isWidgetVideoPlaying('2')).toBeFalse();
  });

  it('keeps video output muted when muted toggle is active even with non-zero slider volume', () => {
    service.selectWidget('2');
    service.setSelectedWidgetContentType('video');

    const videoElement = document.createElement('video');
    videoElement.volume = 1;
    videoElement.muted = false;
    service.registerWidgetVideoElement('2', videoElement);

    service.setWidgetVideoVolume('2', 0.8);

    expect(service.getWidgetVideoVolume('2')).toBeCloseTo(0.8, 3);
    expect(videoElement.volume).toBeCloseTo(0.8, 3);
    expect(videoElement.muted).toBeTrue();
  });

  it('restores audible output after unmuting while preserving remembered volume', () => {
    service.selectWidget('2');
    service.setSelectedWidgetContentType('video');

    const videoElement = document.createElement('video');
    videoElement.volume = 1;
    videoElement.muted = false;
    service.registerWidgetVideoElement('2', videoElement);

    service.setWidgetVideoVolume('2', 0.7);
    service.setSelectedWidgetVideoMuted(false);

    expect(service.getWidgetVideoVolume('2')).toBeCloseTo(0.7, 3);
    expect(videoElement.volume).toBeCloseTo(0.7, 3);
    expect(videoElement.muted).toBeFalse();
  });

  it('stores imported image from file as data URL', async () => {
    service.selectWidget('2');

    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const binary = atob(pngBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const file = new File([bytes], 'avatar.png', {type: 'image/png'});
    await service.setSelectedWidgetImageFromFile(file);

    const updated = service.widgetsState.getById('2');
    expect(updated?.content.type).toBe('image');
    if (updated?.content.type === 'image') {
      expect(updated.content.src.startsWith('data:image/png;base64,')).toBeTrue();
    }
  });

  it('uses widget name as download filename for selected blob image', async () => {
    service.selectWidget('2');
    const widget = service.widgetsState.getById('2');
    expect(widget?.content.type).toBe('image');
    if (!widget || widget.content.type !== 'image') {
      return;
    }

    service.widgetsState.update({
      ...widget,
      name: 'Hero Banner',
      content: {
        ...widget.content,
        alt: 'Alt text',
        src: 'data:image/png;base64,AAAA',
      },
    });

    const writeSpy = jasmine.createSpy('write').and.resolveTo();
    const closeSpy = jasmine.createSpy('close').and.resolveTo();
    const pickerSpy = jasmine.createSpy('showSaveFilePicker').and.resolveTo({
      getFile: async () => new File([], 'ignored.png'),
      createWritable: async () => ({write: writeSpy, close: closeSpy}),
    });

    (globalThis as unknown as {showSaveFilePicker?: unknown}).showSaveFilePicker = pickerSpy;

    await service.saveSelectedWidgetImageToDisk();

    expect(pickerSpy).toHaveBeenCalled();
    const options = pickerSpy.calls.mostRecent().args[0] as {suggestedName?: string};
    expect(options.suggestedName).toBe('Hero-Banner.png');

    delete (globalThis as unknown as {showSaveFilePicker?: unknown}).showSaveFilePicker;
  });

  it('falls back to widget-{uuid} when widget name and alt are empty', async () => {
    service.selectWidget('2');
    const widget = service.widgetsState.getById('2');
    expect(widget?.content.type).toBe('image');
    if (!widget || widget.content.type !== 'image') {
      return;
    }

    service.widgetsState.update({
      ...widget,
      name: '   ',
      content: {
        ...widget.content,
        alt: '   ',
        src: 'data:image/jpeg;base64,AAAA',
      },
    });

    const writeSpy = jasmine.createSpy('write').and.resolveTo();
    const closeSpy = jasmine.createSpy('close').and.resolveTo();
    const pickerSpy = jasmine.createSpy('showSaveFilePicker').and.resolveTo({
      getFile: async () => new File([], 'ignored.jpg'),
      createWritable: async () => ({write: writeSpy, close: closeSpy}),
    });

    (globalThis as unknown as {showSaveFilePicker?: unknown}).showSaveFilePicker = pickerSpy;

    await service.saveSelectedWidgetImageToDisk();

    expect(pickerSpy).toHaveBeenCalled();
    const options = pickerSpy.calls.mostRecent().args[0] as {suggestedName?: string};
    expect(options.suggestedName).toBe('widget-2.jpg');

    delete (globalThis as unknown as {showSaveFilePicker?: unknown}).showSaveFilePicker;
  });

  it('updates selected text style settings', () => {
    service.selectWidget('1');
    service.setSelectedWidgetTextFontFamily('fira-code');
    service.setSelectedWidgetTextFontSize(32);
    service.setSelectedWidgetTextColor('#ff00aa');
    service.setSelectedWidgetTextHorizontalAlignment('left');
    service.setSelectedWidgetTextVerticalAlignment('bottom');
    service.setSelectedWidgetTextAutoSize(true);

    const widget = service.widgetsState.getById('1');
    expect(widget?.content.type).toBe('text');
    if (widget?.content.type === 'text') {
      expect(widget.content.style.fontFamily).toBe('fira-code');
      expect(widget.content.style.fontSize).toBe(32);
      expect(widget.content.style.color).toBe('#ff00aa');
      expect(widget.content.style.alignHorizontal).toBe('left');
      expect(widget.content.style.alignVertical).toBe('bottom');
      expect(widget.content.style.autoSize).toBeTrue();
    }
  });

  it('recomputes font size when font family changes and autoSize is enabled', () => {
    service.selectWidget('1');
    service.setSelectedWidgetTextAutoSize(true);

    const recomputeSpy = spyOn<any>(service, 'computeAutoTextFontSize').and.returnValue(17);

    service.setSelectedWidgetTextFontFamily('montserrat');

    expect(recomputeSpy).toHaveBeenCalled();

    const widget = service.widgetsState.getById('1');
    expect(widget?.content.type).toBe('text');
    if (widget?.content.type === 'text') {
      expect(widget.content.style.fontFamily).toBe('montserrat');
      expect(widget.content.style.fontSize).toBe(17);
    }
  });

  it('updates and clears selected widget background', () => {
    service.selectWidget('1');
    service.setSelectedWidgetBackground('#12ab34');

    const withBackground = service.widgetsState.getById('1');
    expect(withBackground?.background).toBe('#12ab34');

    service.setSelectedWidgetBackground(null);
    const transparent = service.widgetsState.getById('1');
    expect(transparent?.background).toBeUndefined();
  });

  it('updates selected widget background opacity and clamps values', () => {
    service.selectWidget('1');

    service.setSelectedWidgetBackgroundOpacity(65);
    expect(service.widgetsState.getById('1')?.backgroundOpacity).toBe(65);

    service.setSelectedWidgetBackgroundOpacity(150);
    expect(service.widgetsState.getById('1')?.backgroundOpacity).toBe(100);

    service.setSelectedWidgetBackgroundOpacity(-20);
    expect(service.widgetsState.getById('1')?.backgroundOpacity).toBe(0);
  });

  it('updates selected widget opacity and clamps values', () => {
    service.selectWidget('1');

    service.setSelectedWidgetOpacity(70);
    expect(service.widgetsState.getById('1')?.opacity).toBe(70);

    service.setSelectedWidgetOpacity(140);
    expect(service.widgetsState.getById('1')?.opacity).toBe(100);

    service.setSelectedWidgetOpacity(-10);
    expect(service.widgetsState.getById('1')?.opacity).toBe(0);
  });

  it('updates selected widget visibility', () => {
    service.selectWidget('1');
    service.setSelectedWidgetVisible(false);
    expect(service.widgetsState.getById('1')?.visible).toBeFalse();

    service.setSelectedWidgetVisible(true);
    expect(service.widgetsState.getById('1')?.visible).toBeTrue();
  });

  it('updates lock and visibility by widget id', () => {
    service.setWidgetLocked('2', true);
    service.setWidgetVisible('2', false);

    const widget = service.widgetsState.getById('2');
    expect(widget?.locked).toBeTrue();
    expect(widget?.visible).toBeFalse();
  });

  it('deletes selected widget and clears selection', () => {
    service.selectWidget('1');

    service.deleteSelectedWidget();

    expect(service.widgetsState.getById('1')).toBeUndefined();
    expect(service.selectedWidgetId()).toBeNull();
  });

  it('deletes widget by id and keeps selection when another widget is selected', () => {
    service.selectWidget('1');

    service.deleteWidget('2');

    expect(service.widgetsState.getById('2')).toBeUndefined();
    expect(service.selectedWidgetId()).toBe('1');
  });

  it('supports undo and redo for editor actions', async () => {
    const { canvas, wrapper } = createCanvasElements();
    service.init({ canvas, canvasWrapper: wrapper });

    const initialShowGrid = service.showGrid();
    service.setShowGrid(!initialShowGrid);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.canUndo()).toBeTrue();
    service.undo();
    expect(service.showGrid()).toBe(initialShowGrid);
    expect(service.canRedo()).toBeTrue();

    service.redo();
    expect(service.showGrid()).toBe(!initialShowGrid);
  });

  it('restores saved editor state from localStorage on init', () => {
    const { canvas, wrapper } = createCanvasElements();
    const savedSnapshot = {
      canvas: {
        width: 1024,
        height: 576,
        zoom: 1.5,
        top: 12,
        left: 24,
        snapSize: 8,
        canExitBorders: true,
        canSnapToGrid: true,
        canSnapToObjects: true,
        canSnapToBorder: true,
        canResizeWidget: true,
        canMoveWidget: true,
        showGrid: true,
        showContainer: false,
        debugMode: false,
        debugPanelVisible: false,
        settingsPanelLayout: 'floating' as const,
        layersPanelLayout: 'fixed-left' as const,
        selectedWidgetId: '1',
      },
      widgets: service.widgetsState.list().map((widget) =>
        widget.uuid === '1' ? { ...widget, x: 333, y: 111 } : widget,
      ),
    };

    localStorage.setItem(editorStorageKey, JSON.stringify(savedSnapshot));
    service.init({ canvas, canvasWrapper: wrapper, width: 1280, height: 720, zoom: 1 });

    expect(service.width()).toBe(1024);
    expect(service.height()).toBe(576);
    expect(service.zoom()).toBe(1.5);
    expect(service.left()).toBe(24);
    expect(service.top()).toBe(12);
    expect(service.showGrid()).toBeTrue();
    expect(service.settingsPanelLayout()).toBe('floating');
    expect(service.widgetsState.getById('1')?.x).toBe(333);
    expect(service.widgetsState.getById('1')?.y).toBe(111);
  });

  it('connects a project folder and writes a synced project snapshot', async () => {
    service.selectWidget('2');
    service.setSelectedWidgetImageSrc('data:image/png;base64,AAAA');

    const fileMap = new Map<string, Blob>();
    const directoryHandle = createMemoryDirectoryHandle('video-project', '', fileMap);
    (globalThis as unknown as {showDirectoryPicker?: unknown}).showDirectoryPicker = jasmine
      .createSpy('showDirectoryPicker')
      .and.resolveTo(directoryHandle);

    await service.connectProjectDirectory();

    expect(service.isProjectDirectoryConnected()).toBeTrue();
    expect(service.projectDirectoryName()).toBe('video-project');
    expect(fileMap.has('state.json')).toBeTrue();
    expect(fileMap.has('assets/widget-2.png')).toBeTrue();

    const rawProject = await (fileMap.get('state.json') as Blob).text();
    const parsedProject = JSON.parse(rawProject) as {widgets: {uuid: string; content: {type: string; src?: string}}[]};
    const imageWidget = parsedProject.widgets.find((widget) => widget.uuid === '2');
    expect(imageWidget?.content.type).toBe('image');
    expect(imageWidget?.content.src).toBe('assets/widget-2.png');
  });

  it('loads project from folder when connecting a non-empty directory', async () => {
    service.setShowGrid(false);
    service.setSnapToGrid(true);

    const persistedWidgets = createSeedWidgets().map((widget) => {
      if (widget.uuid !== '1') {
        return widget;
      }

      return {
        ...widget,
        x: 456,
        y: 321,
      };
    });

    const persistedSnapshot = {
      canvas: {
        width: 900,
        height: 500,
        zoom: 1,
        top: 0,
        left: 0,
        snapSize: 5,
        canExitBorders: false,
        canSnapToGrid: false,
        canSnapToObjects: true,
        canSnapToBorder: true,
        canResizeWidget: false,
        canMoveWidget: true,
        showGrid: true,
        showContainer: false,
        debugMode: false,
        debugPanelVisible: false,
        settingsPanelLayout: 'fixed-right' as const,
        layersPanelLayout: 'fixed-left' as const,
        selectedWidgetId: '1',
      },
      widgets: persistedWidgets,
    };

    const fileMap = new Map<string, Blob>([
      ['state.json', new Blob([JSON.stringify(persistedSnapshot)], {type: 'application/json'})],
    ]);

    const directoryHandle = createMemoryDirectoryHandle('video-project', '', fileMap);
    (globalThis as unknown as {showDirectoryPicker?: unknown}).showDirectoryPicker = jasmine
      .createSpy('showDirectoryPicker')
      .and.resolveTo(directoryHandle);

    await service.connectProjectDirectory();

    expect(service.width()).toBe(900);
    expect(service.height()).toBe(500);
    expect(service.showGrid()).toBeTrue();
    expect(service.canSnapToGrid()).toBeFalse();
    expect(service.widgetsState.getById('1')?.x).toBe(456);
    expect(service.widgetsState.getById('1')?.y).toBe(321);
  });

  it('marks project as pending when local changes are not synced yet', async () => {
    const { canvas, wrapper } = createCanvasElements();
    service.init({ canvas, canvasWrapper: wrapper });

    const fileMap = new Map<string, Blob>();
    const directoryHandle = createMemoryDirectoryHandle('video-project', '', fileMap);
    (globalThis as unknown as {showDirectoryPicker?: unknown}).showDirectoryPicker = jasmine
      .createSpy('showDirectoryPicker')
      .and.resolveTo(directoryHandle);

    await service.connectProjectDirectory();
    expect(service.projectHasPendingChanges()).toBeFalse();

    service.setShowGrid(!service.showGrid());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(service.projectHasPendingChanges()).toBeTrue();

    await service.syncProjectToDirectoryNow();
    expect(service.projectHasPendingChanges()).toBeFalse();
  });

  it('removes stale asset files when synced widgets no longer reference them', async () => {
    service.selectWidget('2');
    service.setSelectedWidgetImageSrc('data:image/png;base64,AAAA');

    const fileMap = new Map<string, Blob>();
    const directoryHandle = createMemoryDirectoryHandle('video-project', '', fileMap);
    const pickerSpy = jasmine.createSpy('showDirectoryPicker').and.resolveTo(directoryHandle);
    (globalThis as unknown as {showDirectoryPicker?: unknown}).showDirectoryPicker = pickerSpy;

    await service.connectProjectDirectory();
    expect(fileMap.has('assets/widget-2.png')).toBeTrue();

    service.setSelectedWidgetContentType('text');
    await service.syncProjectToDirectoryNow();

    expect(fileMap.has('assets/widget-2.png')).toBeFalse();
  });

  it('keeps non-managed asset files during stale cleanup', async () => {
    service.selectWidget('2');
    service.setSelectedWidgetImageSrc('data:image/png;base64,AAAA');

    const fileMap = new Map<string, Blob>([
      ['assets/custom-logo.png', new Blob(['manual'], {type: 'image/png'})],
    ]);

    const directoryHandle = createMemoryDirectoryHandle('video-project', '', fileMap);
    (globalThis as unknown as {showDirectoryPicker?: unknown}).showDirectoryPicker = jasmine
      .createSpy('showDirectoryPicker')
      .and.resolveTo(directoryHandle);

    await service.connectProjectDirectory();
    expect(fileMap.has('assets/widget-2.png')).toBeTrue();

    service.setSelectedWidgetContentType('text');
    await service.syncProjectToDirectoryNow();

    expect(fileMap.has('assets/widget-2.png')).toBeFalse();
    expect(fileMap.has('assets/custom-logo.png')).toBeTrue();
  });

  it('eagerly writes image asset to project folder when importing from file while folder is connected', async () => {
    service.selectWidget('2');

    const fileMap = new Map<string, Blob>();
    const directoryHandle = createMemoryDirectoryHandle('video-project', '', fileMap);
    (globalThis as unknown as {showDirectoryPicker?: unknown}).showDirectoryPicker = jasmine
      .createSpy('showDirectoryPicker')
      .and.resolveTo(directoryHandle);

    await service.connectProjectDirectory();
    fileMap.clear(); // clear the initial sync writes

    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const binary = atob(pngBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const file = new File([bytes], 'photo.png', {type: 'image/png'});
    await service.setSelectedWidgetImageFromFile(file);

    // Asset must be on disk immediately (eager write, not waiting for debounce)
    expect(fileMap.has('assets/widget-2.png')).toBeTrue();

    // Runtime widget src must still be a data URL (for in-browser rendering)
    const widget = service.widgetsState.getById('2');
    expect(widget?.content.type).toBe('image');
    if (widget?.content.type === 'image') {
      expect(widget.content.src.startsWith('data:image/png;base64,')).toBeTrue();
    }
  });

  it('eagerly writes video asset to project folder when importing from file while folder is connected', async () => {
    service.selectWidget('2');
    service.setSelectedWidgetContentType('video');

    const fileMap = new Map<string, Blob>();
    const directoryHandle = createMemoryDirectoryHandle('video-project', '', fileMap);
    (globalThis as unknown as {showDirectoryPicker?: unknown}).showDirectoryPicker = jasmine
      .createSpy('showDirectoryPicker')
      .and.resolveTo(directoryHandle);

    await service.connectProjectDirectory();
    fileMap.clear(); // clear the initial sync writes

    const file = new File([new Uint8Array([0, 0, 0, 1])], 'clip.mp4', {type: 'video/mp4'});
    await service.setSelectedWidgetVideoFromFile(file);

    expect(fileMap.has('assets/widget-2.mp4')).toBeTrue();

    const widget = service.widgetsState.getById('2');
    expect(widget?.content.type).toBe('video');
    if (widget?.content.type === 'video') {
      expect(widget.content.src.startsWith('data:video/mp4;base64,')).toBeTrue();
    }
  });

  it('stores managed asset paths instead of inline image blobs in localStorage when folder sync is connected', async () => {
    const { canvas, wrapper } = createCanvasElements();
    service.init({ canvas, canvasWrapper: wrapper });
    service.selectWidget('2');
    service.setSelectedWidgetImageSrc('data:image/png;base64,AAAA');

    const fileMap = new Map<string, Blob>();
    const directoryHandle = createMemoryDirectoryHandle('video-project', '', fileMap);
    (globalThis as unknown as {showDirectoryPicker?: unknown}).showDirectoryPicker = jasmine
      .createSpy('showDirectoryPicker')
      .and.resolveTo(directoryHandle);

    await service.connectProjectDirectory();
    service.setShowGrid(!service.showGrid());
    await new Promise((resolve) => setTimeout(resolve, 0));

    const raw = localStorage.getItem(editorStorageKey);
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('data:image/png;base64');
    expect(raw).toContain('assets/widget-2.png');
  });

  it('hydrates managed asset paths to data URLs on init when folder sync is already connected', async () => {
    const { canvas, wrapper } = createCanvasElements();
    service.init({ canvas, canvasWrapper: wrapper });

    const fileMap = new Map<string, Blob>();
    const directoryHandle = createMemoryDirectoryHandle('video-project', '', fileMap);
    (globalThis as unknown as {showDirectoryPicker?: unknown}).showDirectoryPicker = jasmine
      .createSpy('showDirectoryPicker')
      .and.resolveTo(directoryHandle);

    await service.connectProjectDirectory();
    fileMap.set('assets/widget-2.png', new Blob(['png-binary'], {type: 'image/png'}));

    const persistedSnapshot = {
      canvas: {
        width: service.width(),
        height: service.height(),
        zoom: service.zoom(),
        top: service.top(),
        left: service.left(),
        snapSize: service.snapSize(),
        canExitBorders: service.canExitBorders(),
        canSnapToGrid: service.canSnapToGrid(),
        canSnapToObjects: service.canSnapToObjects(),
        canSnapToBorder: service.canSnapToBorder(),
        canResizeWidget: service.canResizeWidget(),
        canMoveWidget: service.canMoveWidget(),
        showGrid: service.showGrid(),
        showContainer: service.showContainer(),
        debugMode: service.debugMode(),
        debugPanelVisible: service.debugPanelVisible(),
        settingsPanelLayout: service.settingsPanelLayout(),
        layersPanelLayout: service.layersPanelLayout(),
        selectedWidgetId: service.selectedWidgetId(),
      },
      widgets: service.widgetsState.list().map((widget) => {
        if (widget.uuid !== '2' || widget.content.type !== 'image') {
          return widget;
        }

        return {
          ...widget,
          content: {
            ...widget.content,
            src: 'assets/widget-2.png',
          },
        };
      }),
    };

    localStorage.setItem(editorStorageKey, JSON.stringify(persistedSnapshot));
    service.init({ canvas, canvasWrapper: wrapper });
    await new Promise((resolve) => setTimeout(resolve, 25));

    const imageWidget = service.widgetsState.getById('2');
    expect(imageWidget?.content.type).toBe('image');
    if (imageWidget?.content.type === 'image') {
      expect(imageWidget.content.src.startsWith('data:image/')).toBeTrue();
    }
  });
});

