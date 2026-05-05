import {TestBed} from '@angular/core/testing';
import {CanvasService} from './canvas.service';

describe('CanvasService', () => {
  let service: CanvasService;

  beforeEach(() => {
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
});

