import {CanvasWidgetResizeService} from './canvas-widget-resize.service';

describe('CanvasWidgetResizeService', () => {
  const service = new CanvasWidgetResizeService();
  const defaultRectInput = {
    min: {width: 10, height: 10},
    snapToGrid: false,
    snapSize: 1,
    canExitBorders: true,
    canvas: {width: 1920, height: 1080},
    keepAspectRatio: false,
    snapToObjects: false,
    objectSnapDistance: 8,
    snapToBorder: false,
    borderSnapDistance: 8,
    siblings: [],
    zoom: 1,
  };

  const computeRect = (overrides: Partial<Parameters<CanvasWidgetResizeService['computeNextRect']>[0]>) =>
    service.computeNextRect({
      ...defaultRectInput,
      ...overrides,
    } as Parameters<CanvasWidgetResizeService['computeNextRect']>[0]).rect;

  it('locks aspect ratio on corner resize while Shift is pressed', () => {
    const initialRect = {x: 100, y: 80, width: 160, height: 90};
    const nextRect = computeRect({
      handle: 'bottom-right',
      initialRect,
      delta: {x: 100, y: 10},
      keepAspectRatio: true,
      aspectRatio: initialRect.width / initialRect.height,
    });

    expect(nextRect.width / nextRect.height).toBeCloseTo(initialRect.width / initialRect.height, 6);
  });

  it('keeps widget inside canvas on Shift side-resize when exit borders are disabled', () => {
    const nextRect = computeRect({
      handle: 'left',
      initialRect: {x: 100, y: 40, width: 160, height: 90},
      delta: {x: -60, y: 0},
      canExitBorders: false,
      canvas: {width: 400, height: 150},
      keepAspectRatio: true,
      aspectRatio: 16 / 9,
    });

    expect(nextRect.x).toBeGreaterThanOrEqual(0);
    expect(nextRect.y).toBeGreaterThanOrEqual(0);
    expect(nextRect.x + nextRect.width).toBeLessThanOrEqual(400);
    expect(nextRect.y + nextRect.height).toBeLessThanOrEqual(150);
    expect(nextRect.width / nextRect.height).toBeCloseTo(16 / 9, 6);
  });

  it('preserves previous behavior when Shift is not pressed', () => {
    const nextRect = computeRect({
      handle: 'right',
      initialRect: {x: 20, y: 20, width: 160, height: 90},
      delta: {x: 20, y: 50},
      keepAspectRatio: false,
    });

    expect(nextRect).toEqual({x: 20, y: 20, width: 180, height: 90});
  });

  it('applies grid snap and still restores locked ratio when Shift is pressed', () => {
    const initialRect = {x: 0, y: 0, width: 160, height: 90};
    const nextRect = computeRect({
      handle: 'bottom-right',
      initialRect,
      delta: {x: 33, y: 17},
      snapToGrid: true,
      snapSize: 20,
      keepAspectRatio: true,
      aspectRatio: initialRect.width / initialRect.height,
    });

    expect(nextRect.width % 20).toBe(0);
    expect(nextRect.height % 20).toBe(0);
    expect(nextRect.width / nextRect.height).toBeCloseTo(initialRect.width / initialRect.height, 6);
  });

  it('maps right side to bottom-right when Shift is pressed', () => {
    const initialRect = {x: 40, y: 30, width: 160, height: 90};
    const nextRect = computeRect({
      handle: 'right',
      initialRect,
      delta: {x: 26, y: 0},
      snapToGrid: true,
      snapSize: 10,
      keepAspectRatio: true,
      aspectRatio: initialRect.width / initialRect.height,
    });

    expect(nextRect.width % 10).toBe(0);
    expect(nextRect.height % 10).toBe(0);
    expect(nextRect.x).toBe(initialRect.x);
    expect(nextRect.y).toBe(initialRect.y);
    expect(nextRect.width / nextRect.height).toBeCloseTo(initialRect.width / initialRect.height, 6);
  });

  it('maps top side to top-left when Shift is pressed', () => {
    const initialRect = {x: 100, y: 100, width: 160, height: 90};
    const nextRect = computeRect({
      handle: 'top',
      initialRect,
      delta: {x: 0, y: -30},
      keepAspectRatio: true,
      aspectRatio: initialRect.width / initialRect.height,
    });

    expect(nextRect.x).toBeLessThan(initialRect.x);
    expect(nextRect.y).toBeLessThan(initialRect.y);
    expect(nextRect.width / nextRect.height).toBeCloseTo(initialRect.width / initialRect.height, 6);
  });

  it('keeps aspect ratio when resizing outside canvas bounds with Shift and borders locked', () => {
    const initialRect = {x: 300, y: 180, width: 160, height: 90};
    const nextRect = computeRect({
      handle: 'bottom-right',
      initialRect,
      delta: {x: 220, y: 220},
      canExitBorders: false,
      canvas: {width: 400, height: 240},
      keepAspectRatio: true,
      aspectRatio: initialRect.width / initialRect.height,
    });

    expect(nextRect.x).toBeGreaterThanOrEqual(0);
    expect(nextRect.y).toBeGreaterThanOrEqual(0);
    expect(nextRect.x + nextRect.width).toBeLessThanOrEqual(400);
    expect(nextRect.y + nextRect.height).toBeLessThanOrEqual(240);
    expect(nextRect.width / nextRect.height).toBeCloseTo(initialRect.width / initialRect.height, 6);
  });
 });






