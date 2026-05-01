import {TestBed} from '@angular/core/testing';
import {DEFAULT_WIDGET_CONTENT, WidgetStateItem} from '../models/canvas-widget-state.models';
import {CanvasWidgetStateService} from './canvas-widget-state.service';

describe('CanvasWidgetStateService', () => {
  let service: CanvasWidgetStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CanvasWidgetStateService);
  });

  it('normalizes missing content to default text content', () => {
    const legacyWidget = {
      uuid: 'legacy-widget',
      x: 10,
      y: 20,
      z: 10,
      width: 200,
      height: 120,
      content: undefined,
    } as unknown as WidgetStateItem;

    service.update(legacyWidget);

    expect(service.getById('legacy-widget').content).toEqual(DEFAULT_WIDGET_CONTENT);
  });

  it('normalizes image content with empty alt text when not provided', () => {
    const imageWidget = {
      uuid: 'image-widget',
      x: 15,
      y: 25,
      z: 11,
      width: 160,
      height: 90,
      content: {
        type: 'image',
        src: 'https://example.com/image.png',
      },
    } as WidgetStateItem;

    service.add(imageWidget);

    expect(service.getById('image-widget').content).toEqual({
      type: 'image',
      src: 'https://example.com/image.png',
      alt: '',
    });
  });
});

