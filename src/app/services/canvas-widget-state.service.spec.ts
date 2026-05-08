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
      offsetX: -50,
      offsetY: -50,
      cropZoom: 1,
    });
  });

  it('normalizes crop fit mode and crop fields', () => {
    const imageWidget = {
      uuid: 'image-crop-widget',
      x: 15,
      y: 25,
      z: 11,
      width: 160,
      height: 90,
      content: {
        type: 'image',
        src: 'https://example.com/image.png',
        fitMode: 'crop',
        offsetX: 20,
        offsetY: -140,
        cropZoom: 8,
      },
    } as WidgetStateItem;

    service.add(imageWidget);

    expect(service.getById('image-crop-widget').content).toEqual({
      type: 'image',
      src: 'https://example.com/image.png',
      alt: '',
      fitMode: 'crop',
      offsetX: 0,
      offsetY: -100,
      cropZoom: 5,
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

  it('preserves text shadow style fields for text widgets', () => {
    const textWidget = {
      uuid: 'text-shadow-widget',
      x: 20,
      y: 40,
      z: 14,
      width: 220,
      height: 120,
      content: {
        type: 'text',
        text: 'Shadow text',
        style: {
          ...DEFAULT_WIDGET_TEXT_STYLE,
          textShadowColor: '#ff0000',
          textShadowBlur: 12,
          textShadowOffsetX: 3,
          textShadowOffsetY: 5,
        },
      },
    } as WidgetStateItem;

    service.add(textWidget);

    const normalized = service.getById('text-shadow-widget');
    expect(normalized.content).toEqual({
      type: 'text',
      text: 'Shadow text',
      style: {
        ...DEFAULT_WIDGET_TEXT_STYLE,
        textShadowColor: '#ff0000',
        textShadowBlur: 12,
        textShadowOffsetX: 3,
        textShadowOffsetY: 5,
      },
    });
  });

  it('normalizes video content with default playback options', () => {
    const videoWidget = {
      uuid: 'video-widget',
      x: 20,
      y: 40,
      z: 13,
      width: 320,
      height: 180,
      content: {
        type: 'video',
        src: 'https://example.com/video.mp4',
      },
    } as WidgetStateItem;

    service.add(videoWidget);

    expect(service.getById('video-widget').content).toEqual({
      type: 'video',
      src: 'https://example.com/video.mp4',
      poster: '',
      fitMode: 'cover',
      autoplay: false,
      loop: false,
      muted: true,
      controls: true,
      offsetX: -50,
      offsetY: -50,
      cropZoom: 1,
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

  it('normalizes missing widget opacity to 100', () => {
    const legacyWidget = {
      uuid: 'legacy-widget-opacity-default',
      x: 0,
      y: 0,
      z: 32,
      width: 120,
      height: 60,
      content: DEFAULT_WIDGET_CONTENT,
    } as WidgetStateItem;

    service.add(legacyWidget);

    expect(service.getById('legacy-widget-opacity-default').opacity).toBe(100);
  });

  it('clamps widget opacity in range 0-100', () => {
    const widget = {
      uuid: 'legacy-widget-opacity-clamp',
      x: 10,
      y: 10,
      z: 33,
      width: 120,
      height: 60,
      opacity: 140,
      content: DEFAULT_WIDGET_CONTENT,
    } as WidgetStateItem;

    service.add(widget);
    expect(service.getById('legacy-widget-opacity-clamp').opacity).toBe(100);

    const normalized = service.getById('legacy-widget-opacity-clamp');
    expect(normalized).toBeTruthy();
    if (!normalized) {
      return;
    }

    service.update({
      ...normalized,
      opacity: -5,
    });

    expect(service.getById('legacy-widget-opacity-clamp').opacity).toBe(0);
  });

  it('normalizes missing background opacity to 100', () => {
    const legacyWidget = {
      uuid: 'legacy-opacity-default',
      x: 10,
      y: 10,
      z: 40,
      width: 120,
      height: 60,
      background: '#ffffff',
      content: DEFAULT_WIDGET_CONTENT,
    } as WidgetStateItem;

    service.add(legacyWidget);

    expect(service.getById('legacy-opacity-default').backgroundOpacity).toBe(100);
  });

  it('clamps background opacity in range 0-100', () => {
    const widget = {
      uuid: 'legacy-opacity-clamp',
      x: 10,
      y: 10,
      z: 41,
      width: 120,
      height: 60,
      background: '#ffffff',
      backgroundOpacity: 132,
      content: DEFAULT_WIDGET_CONTENT,
    } as WidgetStateItem;

    service.add(widget);
    expect(service.getById('legacy-opacity-clamp').backgroundOpacity).toBe(100);

    const normalized = service.getById('legacy-opacity-clamp');
    expect(normalized).toBeTruthy();
    if (!normalized) {
      return;
    }

    service.update({
      ...normalized,
      backgroundOpacity: -12,
    });
    expect(service.getById('legacy-opacity-clamp').backgroundOpacity).toBe(0);
  });
});

