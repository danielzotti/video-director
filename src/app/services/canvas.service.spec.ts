import {TestBed} from '@angular/core/testing';
import {CanvasService} from './canvas.service';

describe('CanvasService', () => {
  let service: CanvasService;
  const editorStorageKey = 'video-director.editor-state.v1';

  const createCanvasElements = () => {
    const canvas = document.createElement('div');
    const wrapper = document.createElement('div');

    spyOn(wrapper, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 1280, 720));
    spyOn(canvas, 'getBoundingClientRect').and.returnValue(new DOMRect(0, 0, 1280, 720));

    return { canvas, wrapper };
  };

  beforeEach(() => {
    localStorage.removeItem(editorStorageKey);
    TestBed.configureTestingModule({});
    service = TestBed.inject(CanvasService);
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

  it('updates and clears selected widget background', () => {
    service.selectWidget('1');
    service.setSelectedWidgetBackground('#12ab34');

    const withBackground = service.widgetsState.getById('1');
    expect(withBackground?.background).toBe('#12ab34');

    service.setSelectedWidgetBackground(null);
    const transparent = service.widgetsState.getById('1');
    expect(transparent?.background).toBeUndefined();
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
});

