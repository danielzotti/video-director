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
});

