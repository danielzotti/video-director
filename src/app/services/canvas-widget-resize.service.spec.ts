import {CanvasWidgetResizeService} from './canvas-widget-resize.service';

describe('CanvasWidgetResizeService', () => {
  const service = new CanvasWidgetResizeService();

  it('locks aspect ratio on corner resize while Shift is pressed', () => {
    const initialRect = {x: 100, y: 80, width: 160, height: 90};
    const nextRect = service.computeNextRect({
      handle: 'bottom-right',
      initialRect,
      delta: {x: 100, y: 10},
      min: {width: 10, height: 10},
      snapToGrid: false,
      snapSize: 1,
      canExitBorders: true,
      canvas: {width: 1920, height: 1080},
      keepAspectRatio: true,
      aspectRatio: initialRect.width / initialRect.height,
    });

    expect(nextRect.width / nextRect.height).toBeCloseTo(initialRect.width / initialRect.height, 6);
  });

  it('keeps widget inside canvas on Shift side-resize when exit borders are disabled', () => {
    const nextRect = service.computeNextRect({
      handle: 'left',
      initialRect: {x: 100, y: 100, width: 160, height: 90},
      delta: {x: -60, y: 0},
      min: {width: 10, height: 10},
      snapToGrid: false,
      snapSize: 1,
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
    const nextRect = service.computeNextRect({
      handle: 'right',
      initialRect: {x: 20, y: 20, width: 160, height: 90},
      delta: {x: 20, y: 50},
      min: {width: 10, height: 10},
      snapToGrid: false,
      snapSize: 1,
      canExitBorders: true,
      canvas: {width: 1920, height: 1080},
      keepAspectRatio: false,
    });

    expect(nextRect).toEqual({x: 20, y: 20, width: 180, height: 90});
  });

  it('applies grid snap and still restores locked ratio when Shift is pressed', () => {
    const initialRect = {x: 0, y: 0, width: 160, height: 90};
    const nextRect = service.computeNextRect({
      handle: 'bottom-right',
      initialRect,
      delta: {x: 33, y: 17},
      min: {width: 10, height: 10},
      snapToGrid: true,
      snapSize: 20,
      canExitBorders: true,
      canvas: {width: 1920, height: 1080},
      keepAspectRatio: true,
      aspectRatio: initialRect.width / initialRect.height,
    });

    expect(nextRect.width % 20).toBe(0);
    expect(nextRect.height % 20).toBe(0);
    expect(nextRect.width / nextRect.height).toBeCloseTo(initialRect.width / initialRect.height, 6);
  });

  it('does not lock ratio on side handles when snap to grid is enabled', () => {
    const initialRect = {x: 40, y: 30, width: 160, height: 90};
    const nextRect = service.computeNextRect({
      handle: 'right',
      initialRect,
      delta: {x: 26, y: 0},
      min: {width: 10, height: 10},
      snapToGrid: true,
      snapSize: 10,
      canExitBorders: true,
      canvas: {width: 1920, height: 1080},
      keepAspectRatio: true,
      aspectRatio: initialRect.width / initialRect.height,
    });

    expect(nextRect).toEqual({
      x: initialRect.x,
      y: initialRect.y,
      width: 190,
      height: initialRect.height,
    });
    expect(nextRect.width % 10).toBe(0);
    expect(nextRect.height).toBe(initialRect.height);
  });

  it('keeps aspect ratio when resizing outside canvas bounds with Shift and borders locked', () => {
    const initialRect = {x: 300, y: 180, width: 160, height: 90};
    const nextRect = service.computeNextRect({
      handle: 'bottom-right',
      initialRect,
      delta: {x: 220, y: 220},
      min: {width: 10, height: 10},
      snapToGrid: false,
      snapSize: 1,
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
 





