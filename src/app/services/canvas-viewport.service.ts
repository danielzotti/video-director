import {Injectable} from '@angular/core';
import {Point2D, Size2D} from '../models/geometry.models';
import {canvasToScreenPoint, screenToCanvasPoint} from '../utils/canvas-geometry.utils';

@Injectable({
  providedIn: 'root',
})
export class CanvasViewportService {
  clampZoom(value: number): number {
    return Math.max(0.25, Math.min(3, value));
  }

  fitCanvasZoom({
    wrapper,
    canvas,
  }: {
    wrapper: Size2D;
    canvas: Size2D;
  }): number {
    if (canvas.width <= 0 || canvas.height <= 0) {
      return 1;
    }

    const fitZoom = Math.min(wrapper.width / canvas.width, wrapper.height / canvas.height);
    return this.clampZoom(fitZoom);
  }

  centerCanvas({
    wrapper,
    canvas,
    zoom,
  }: {
    wrapper: Size2D;
    canvas: Size2D;
    zoom: number;
  }): Point2D {
    return {
      x: Math.round((wrapper.width - canvas.width * zoom) / 2),
      y: Math.round((wrapper.height - canvas.height * zoom) / 2),
    };
  }

  zoomFromFocalPoint({
    delta,
    oldZoom,
    focalPoint,
    canvasOffset,
    wrapperOffset,
  }: {
    delta: number;
    oldZoom: number;
    focalPoint: Point2D;
    canvasOffset: Point2D;
    wrapperOffset: Point2D;
  }): {zoom: number; left: number; top: number} {
    const zoom = this.clampZoom(Math.round((oldZoom + delta) * 100) / 100);

    if (zoom === oldZoom) {
      return {
        zoom,
        left: Math.round(canvasOffset.x - wrapperOffset.x),
        top: Math.round(canvasOffset.y - wrapperOffset.y),
      };
    }

    const canvasPoint = screenToCanvasPoint({
      screen: focalPoint,
      canvasOffset,
      zoom: oldZoom,
    });

    const nextCanvasScreen = canvasToScreenPoint({
      canvas: canvasPoint,
      canvasOffset: {x: 0, y: 0},
      zoom,
    });

    return {
      zoom,
      left: Math.round(focalPoint.x - nextCanvasScreen.x - wrapperOffset.x),
      top: Math.round(focalPoint.y - nextCanvasScreen.y - wrapperOffset.y),
    };
  }
}


