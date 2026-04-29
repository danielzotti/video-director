import {computed, inject, Injectable, Renderer2, RendererFactory2, signal} from '@angular/core';
import {WidgetStateItem} from '../models/canvas-widget-state.models';
import {Point2D, Rect2D} from '../models/geometry.models';
import {CanvasStateService} from './canvas-state.service';
import {CanvasWidgetStateService} from './canvas-widget-state.service';
import {MathService} from './math.service';
import {
  canvasToScreenPoint,
  clampRectInsideCanvas,
  clampWidgetPosition,
  resizeRectFromHandle,
  screenToCanvasPoint,
  snapPointToGrid,
  snapWidgetPositionToObjects,
} from '../utils/canvas-geometry.utils';

export interface CanvasServiceInitModel {
  canvas: HTMLElement;
  canvasWrapper?: HTMLElement;
  allowExitBorders?: boolean;
  allowSnapToGrid?: boolean;
  allowWidgetResize?: boolean;
  width?: number;
  height?: number;
  snapSize?: number;
  zoom?: number;
}

export type ResizePosition = 'top' | 'right' | 'bottom' | 'left';

@Injectable({
  providedIn: 'root'
})
export class CanvasService {

  public readonly WIDGET_DRAGGING_CLASS = "app-canvas-widget-dragging" // TODO: should be customizable
  public readonly CANVAS_DRAGGING_CLASS = "app-canvas-dragging" // TODO: should be customizable
  public readonly WIDGET_RESIZING_CLASS = "app-canvas-widget-resizing" // TODO: should be customizable
  public readonly WIDGET_RESIZER_CLASS = "app-canvas-widget-resizer" // TODO: should be customizable

  public canvasEl: HTMLElement | null = null;
  public canvasWrapperEl: HTMLElement | null = null;

  public readonly canvasState = inject(CanvasStateService);
  public readonly widgetsState = inject(CanvasWidgetStateService);
  private readonly mathService = inject(MathService);

  public canManageCanvas = signal(false);
  public canExitBorders = signal(false);
  public canSnapToGrid = signal(false);
  public canSnapToObjects = signal(true);
  public canResizeWidget = signal(false);

  public isDraggingCanvas = signal(false);
  public isDraggingWidget = signal(false);
  public isResizingWidget = signal(false);
  public isSpacePressed = signal(false);
  public widgetResizingPosition = signal<ResizePosition | null>(null);
  public selectedWidgetId = signal<string | null>(null);

  public zoom = signal(1);
  public width = signal(800);
  public height = signal(600);
  public top = signal(0);
  public left = signal(0);
  public snapSize = signal(1);

  public readonly snapSizeList = computed<number[]>(() => {
    return this.mathService.divisorsInCommon(this.width(), this.height()) ?? [1];
  });

  private readonly objectSnapDistance = 8;

  private canvasDragStartPointer: Point2D | null = null;
  private canvasDragStartOffset: Point2D | null = null;
  private widgetDragOffset: Point2D | null = null;
  private resizeStartPointer: Point2D | null = null;
  private resizeStartRect: Rect2D | null = null;

  private readonly renderer: Renderer2 = inject(RendererFactory2).createRenderer(null, null);

  public init({
    canvas,
    canvasWrapper,
    allowExitBorders = false,
    allowSnapToGrid = true,
    width = 800,
    height = 600,
    snapSize = 1,
    allowWidgetResize = true,
    zoom = 1,
  }: CanvasServiceInitModel) {
    this.canvasEl = canvas;
    this.canvasWrapperEl = canvasWrapper ?? null;

    this.canManageCanvas.set(!!this.canvasWrapperEl);
    this.canExitBorders.set(allowExitBorders);
    this.canSnapToGrid.set(allowSnapToGrid);
    this.canResizeWidget.set(allowWidgetResize);

    this.width.set(width);
    this.height.set(height);
    this.zoom.set(this.clampZoom(zoom));
    this.snapSize.set(allowSnapToGrid ? Math.max(1, snapSize) : 1);

    this.renderer.setStyle(this.canvasEl, 'position', 'relative');
    this.renderer.setStyle(this.canvasEl, 'top', '0px');
    this.renderer.setStyle(this.canvasEl, 'left', '0px');
    this.renderer.setStyle(this.canvasEl, 'width', `${width}px`);
    this.renderer.setStyle(this.canvasEl, 'height', `${height}px`);
    this.renderer.setStyle(this.canvasEl, 'transform', `scale(${this.zoom()})`);
    this.renderer.setStyle(this.canvasEl, 'transformOrigin', 'top left');

    if (this.canvasWrapperEl) {
      this.renderer.setStyle(this.canvasWrapperEl, 'overflow', 'hidden');
    }

    if (allowSnapToGrid) {
      this.resetWidgetToSnapSize();
    }

    this.canvasCenter();
  }

  public setSpacePressed(pressed: boolean) {
    this.isSpacePressed.set(pressed);
  }

  public canvasResize({width, height}: { width?: number; height?: number; }) {
    if (typeof width === 'number') {
      this.width.set(width);
    }
    if (typeof height === 'number') {
      this.height.set(height);
    }
  }

  public canvasZoomIn(value?: number, focalPoint?: Point2D) {
    this.canvasZoomBy(value ?? 0.25, focalPoint);
  }

  public canvasZoomOut(value?: number, focalPoint?: Point2D) {
    this.canvasZoomBy(-(value ?? 0.25), focalPoint);
  }

  public canvasZoomReset() {
    this.zoom.set(1);
    this.canvasCenter();
  }

  public canvasCenter() {
    if (!this.canvasWrapperEl) {
      this.top.set(0);
      this.left.set(0);
      return;
    }

    const wrapperRect = this.canvasWrapperEl.getBoundingClientRect();
    const centerX = (wrapperRect.width - this.width() * this.zoom()) / 2;
    const centerY = (wrapperRect.height - this.height() * this.zoom()) / 2;

    this.left.set(Math.round(centerX));
    this.top.set(Math.round(centerY));
  }

  public setSnapSize(value: number) {
    this.snapSize.set(Math.max(1, value));
    this.resetWidgetToSnapSize();
  }

  public resetWidgetToSnapSize() {
    const snap = this.snapSize();

    for (const widget of this.widgetsState.list()) {
      const snapped = snapPointToGrid({point: {x: widget.x, y: widget.y}, snap});
      this.widgetsState.update({
        ...widget,
        x: snapped.x,
        y: snapped.y,
        width: Math.max(snap, Math.round(widget.width / snap) * snap),
        height: Math.max(snap, Math.round(widget.height / snap) * snap),
      });
    }
  }

  public canvasDragStart({el, event}: { el: HTMLElement, event: MouseEvent }) {
    if (!this.canvasEl || !this.canvasWrapperEl) {
      return;
    }

    const canPan = event.button === 1 || (event.button === 0 && this.isSpacePressed());
    if (!canPan) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.isDraggingCanvas.set(true);
    el.classList.add(this.CANVAS_DRAGGING_CLASS);

    this.canvasDragStartPointer = {x: event.clientX, y: event.clientY};
    this.canvasDragStartOffset = {x: this.left(), y: this.top()};
  }

  public canvasDrag({el, event}: { el: HTMLElement, event: MouseEvent }) {
    if (!el.classList.contains(this.CANVAS_DRAGGING_CLASS) || !this.canvasDragStartPointer || !this.canvasDragStartOffset) {
      return;
    }

    const dx = event.clientX - this.canvasDragStartPointer.x;
    const dy = event.clientY - this.canvasDragStartPointer.y;

    this.left.set(Math.round(this.canvasDragStartOffset.x + dx));
    this.top.set(Math.round(this.canvasDragStartOffset.y + dy));
  }

  public canvasDragEnd({el}: { el: HTMLElement, event?: MouseEvent }) {
    if (!el.classList.contains(this.CANVAS_DRAGGING_CLASS)) {
      return;
    }

    el.classList.remove(this.CANVAS_DRAGGING_CLASS);
    this.isDraggingCanvas.set(false);
    this.canvasDragStartPointer = null;
    this.canvasDragStartOffset = null;
  }

  public widgetDragStart({widget, el, event}: { widget: WidgetStateItem, el: HTMLElement, event: MouseEvent }) {
    if (event.button !== 0 || !this.canvasEl) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.isDraggingWidget.set(true);
    this.selectedWidgetId.set(widget.uuid);
    el.classList.add(this.WIDGET_DRAGGING_CLASS);
    el.style.zIndex = '9999';

    const pointerCanvas = this.getPointerCanvasPoint(event);
    this.widgetDragOffset = {
      x: pointerCanvas.x - widget.x,
      y: pointerCanvas.y - widget.y,
    };
  }

  public widgetDrag({widget, el, event}: { widget: WidgetStateItem, el: HTMLElement, event: MouseEvent }) {
    if (!el.classList.contains(this.WIDGET_DRAGGING_CLASS) || !this.widgetDragOffset) {
      return;
    }

    const pointerCanvas = this.getPointerCanvasPoint(event);
    let next = {
      x: pointerCanvas.x - this.widgetDragOffset.x,
      y: pointerCanvas.y - this.widgetDragOffset.y,
    };

    if (this.canSnapToGrid()) {
      next = snapPointToGrid({point: next, snap: this.snapSize()});
    }

    if (this.canSnapToObjects()) {
      const siblings = this.widgetsState.list().filter((item) => item.uuid !== widget.uuid);
      next = snapWidgetPositionToObjects({
        position: next,
        moving: {width: widget.width, height: widget.height},
        siblings,
        distance: this.objectSnapDistance / this.zoom(),
      }).point;
    }

    if (!this.canExitBorders()) {
      next = clampWidgetPosition({
        position: next,
        widget: {width: widget.width, height: widget.height},
        canvas: {width: this.width(), height: this.height()},
      });
    }

    el.style.left = `${next.x}px`;
    el.style.top = `${next.y}px`;
  }

  public widgetDragEnd({widget, el}: { widget: WidgetStateItem, el: HTMLElement, event?: MouseEvent }) {
    if (!el.classList.contains(this.WIDGET_DRAGGING_CLASS)) {
      return;
    }

    el.classList.remove(this.WIDGET_DRAGGING_CLASS);
    el.style.zIndex = widget.z.toString();
    this.isDraggingWidget.set(false);
    this.selectedWidgetId.set(null);
    this.widgetDragOffset = null;

    const stateWidget = this.widgetsState.getById(widget.uuid);
    if (!stateWidget) {
      return;
    }

    this.widgetsState.update({
      ...stateWidget,
      x: Number.parseFloat(el.style.left) || 0,
      y: Number.parseFloat(el.style.top) || 0,
    });
  }

  public widgetResizeStart({widget, el, event, position}: {
    widget: WidgetStateItem,
    el: HTMLElement,
    event: MouseEvent,
    position: ResizePosition
  }) {
    if (event.button !== 0 || !this.canResizeWidget()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.isResizingWidget.set(true);
    this.widgetResizingPosition.set(position);
    this.selectedWidgetId.set(widget.uuid);
    el.classList.add(this.WIDGET_RESIZING_CLASS);
    el.style.zIndex = '9999';

    this.resizeStartPointer = this.getPointerCanvasPoint(event);
    this.resizeStartRect = {
      x: Number.parseFloat(el.style.left),
      y: Number.parseFloat(el.style.top),
      width: Number.parseFloat(el.style.width),
      height: Number.parseFloat(el.style.height),
    };
  }

  public widgetResize({el, event}: { widget: WidgetStateItem, el: HTMLElement, event: MouseEvent }) {
    if (!el.classList.contains(this.WIDGET_RESIZING_CLASS) || !this.resizeStartPointer || !this.resizeStartRect) {
      return;
    }

    const position = this.widgetResizingPosition();
    if (!position) {
      return;
    }

    const pointerCanvas = this.getPointerCanvasPoint(event);
    const delta = {
      x: pointerCanvas.x - this.resizeStartPointer.x,
      y: pointerCanvas.y - this.resizeStartPointer.y,
    };

    let nextRect = resizeRectFromHandle({
      rect: this.resizeStartRect,
      handle: position,
      delta,
      min: {width: this.snapSize(), height: this.snapSize()},
    });

    if (this.canSnapToGrid()) {
      const snappedPosition = snapPointToGrid({point: {x: nextRect.x, y: nextRect.y}, snap: this.snapSize()});
      nextRect = {
        ...nextRect,
        x: snappedPosition.x,
        y: snappedPosition.y,
        width: Math.max(this.snapSize(), Math.round(nextRect.width / this.snapSize()) * this.snapSize()),
        height: Math.max(this.snapSize(), Math.round(nextRect.height / this.snapSize()) * this.snapSize()),
      };
    }

    if (!this.canExitBorders()) {
      nextRect = clampRectInsideCanvas({
        rect: nextRect,
        canvas: {width: this.width(), height: this.height()},
      });
    }

    el.style.width = `${nextRect.width}px`;
    el.style.height = `${nextRect.height}px`;
    el.style.left = `${nextRect.x}px`;
    el.style.top = `${nextRect.y}px`;
  }

  public widgetResizeEnd({widget, el, event}: { widget: WidgetStateItem, el: HTMLElement, event?: MouseEvent }) {
    event?.stopPropagation();

    if (!el.classList.contains(this.WIDGET_RESIZING_CLASS)) {
      return;
    }

    el.classList.remove(this.WIDGET_RESIZING_CLASS);
    el.style.zIndex = widget.z.toString();
    this.isResizingWidget.set(false);
    this.widgetResizingPosition.set(null);
    this.selectedWidgetId.set(null);
    this.resizeStartPointer = null;
    this.resizeStartRect = null;

    const stateWidget = this.widgetsState.getById(widget.uuid);
    if (!stateWidget) {
      return;
    }

    this.widgetsState.update({
      ...stateWidget,
      width: Number.parseFloat(el.style.width) || this.snapSize(),
      height: Number.parseFloat(el.style.height) || this.snapSize(),
      x: Number.parseFloat(el.style.left) || 0,
      y: Number.parseFloat(el.style.top) || 0,
    });
  }

  private canvasZoomBy(delta: number, focalPoint?: Point2D) {
    const oldZoom = this.zoom();
    const nextZoom = this.clampZoom(Math.round((oldZoom + delta) * 100) / 100);

    if (oldZoom === nextZoom || !this.canvasEl) {
      return;
    }

    if (!focalPoint || !this.canvasWrapperEl) {
      this.zoom.set(nextZoom);
      return;
    }

    const canvasRect = this.canvasEl.getBoundingClientRect();
    const wrapperRect = this.canvasWrapperEl.getBoundingClientRect();

    const canvasPoint = screenToCanvasPoint({
      screen: focalPoint,
      canvasOffset: {x: canvasRect.left, y: canvasRect.top},
      zoom: oldZoom,
    });

    const nextCanvasScreen = canvasToScreenPoint({
      canvas: canvasPoint,
      canvasOffset: {x: 0, y: 0},
      zoom: nextZoom,
    });

    const newLeft = focalPoint.x - nextCanvasScreen.x - wrapperRect.left;
    const newTop = focalPoint.y - nextCanvasScreen.y - wrapperRect.top;

    this.zoom.set(nextZoom);
    this.left.set(Math.round(newLeft));
    this.top.set(Math.round(newTop));
  }

  private clampZoom(value: number): number {
    return Math.max(0.25, Math.min(3, value));
  }

  private getPointerCanvasPoint(event: MouseEvent): Point2D {
    if (!this.canvasEl) {
      return {x: 0, y: 0};
    }

    const canvasRect = this.canvasEl.getBoundingClientRect();

    return screenToCanvasPoint({
      screen: {x: event.clientX, y: event.clientY},
      canvasOffset: {x: canvasRect.left, y: canvasRect.top},
      zoom: this.zoom(),
    });
  }
}
