import {TestBed} from '@angular/core/testing';
import {DEFAULT_WIDGET_CONTENT, DEFAULT_WIDGET_TEXT_STYLE, WidgetStateItem} from '../models/canvas-widget-state.models';
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
      fitMode: 'cover',
    });
  });

  it('normalizes missing text style fields to defaults', () => {
    const textWidget = {
      uuid: 'text-widget',
      x: 20,
      y: 40,
      z: 12,
      width: 220,
      height: 120,
      content: {
        type: 'text',
        text: 'Legacy text',
      },
    } as unknown as WidgetStateItem;

    service.add(textWidget);

    expect(service.getById('text-widget').content).toEqual({
      type: 'text',
      text: 'Legacy text',
      style: DEFAULT_WIDGET_TEXT_STYLE,
    });
  });

  it('normalizes missing locked flag to false', () => {
    const legacyWidget = {
      uuid: 'legacy-lock',
      x: 0,
      y: 0,
      z: 30,
      width: 120,
      height: 60,
      content: DEFAULT_WIDGET_CONTENT,
    } as WidgetStateItem;

    service.add(legacyWidget);

    expect(service.getById('legacy-lock').locked).toBeFalse();
  });

  it('normalizes missing visible flag to true', () => {
    const legacyWidget = {
      uuid: 'legacy-visible',
      x: 0,
      y: 0,
      z: 31,
      width: 120,
      height: 60,
      content: DEFAULT_WIDGET_CONTENT,
    } as WidgetStateItem;

    service.add(legacyWidget);

    expect(service.getById('legacy-visible').visible).toBeTrue();
  });
});

