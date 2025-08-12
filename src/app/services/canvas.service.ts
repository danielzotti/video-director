import {computed, inject, Injectable, Renderer2, RendererFactory2, signal} from '@angular/core';
import {WidgetStateItem} from '../models/canvas-widget-state.models';
import {CanvasStateService} from './canvas-state.service';
import {CanvasWidgetStateService} from './canvas-widget-state.service';
import {MathService} from './math.service';

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

export type ResizePosition = "top" | "right" | "bottom" | "left";


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
  public canResizeWidget = signal(false);

  public isDraggingCanvas = signal(false);
  public isDraggingWidget = signal(false);
  public isResizingWidget = signal(false);
  public widgetResizingPosition = signal<ResizePosition | null>(null);
  public selectedWidgetId = signal<string | null>(null);

  public zoom = signal(1);

  public width = signal(800);
  public height = signal(600);
  public top = signal(0);
  public left = signal(0);

  public snapSize = signal(1);

  public snapSizeList = computed(() => {
    return this.mathService.divisorsInCommon(this.width(), this.height()) ?? 1;
  })


  private readonly mouseDiffX = signal(0);
  private readonly mouseDiffY = signal(0);

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
                zoom = 1
              }: CanvasServiceInitModel) {
    this.canvasEl = canvas;

    this.renderer.setStyle(this.canvasEl, "left", `${0}px`);
    this.renderer.setStyle(this.canvasEl, "top", `${0}px`);
    this.renderer.setStyle(this.canvasEl, "width", `${width}px`);
    this.renderer.setStyle(this.canvasEl, "height", `${height}px`);
    this.renderer.setStyle(this.canvasEl, "transform", `scale(${zoom})`);
    this.renderer.setStyle(this.canvasEl, "transformOrigin", 'center center');

    this.canvasWrapperEl = canvasWrapper ?? null;
    if (this.canvasWrapperEl) {
      this.canManageCanvas.set(true);
      this.renderer.setStyle(this.canvasWrapperEl, "overflow", 'hidden');
      this.renderer.setStyle(this.canvasWrapperEl, "transformOrigin", 'center center');
    }
    this.canSnapToGrid.set(allowSnapToGrid);
    this.snapSize.set(allowSnapToGrid ? snapSize : 1);

    this.canExitBorders.set(allowExitBorders);
    this.canResizeWidget.set(allowWidgetResize);

    this.width.set(width);
    this.height.set(height);
    this.zoom.set(zoom);
    if (allowSnapToGrid) {
      this.resetWidgetToSnapSize();
    }
    this.canvasCenter();
  }

  // region CANVAS ZOOM
  public canvasResize({width, height}: { width?: number; height?: number; }) {
    if (width) {
      this.width.set(width);
    }
    if (height) {
      this.height.set(height);
    }
  }

  public canvasZoomIn(value?: number) {
    if (value) {
      this.zoom.update((z) => z < 3 ? Math.min(Math.round((z + value) * 100) / 100, 3) : 3);
      return;
    }
    this.zoom.update((z) => z < 3 ? Math.min(z + 0.25, 3) : z);
  }

  public canvasZoomOut(value?: number) {
    if (value) {
      this.zoom.update((z) => z > 0.25 ? Math.max(Math.round((z - value) * 100) / 100, 0.25) : z);
      return;
    }
    this.zoom.update((z) => z > 0.25 ? Math.max(z - 0.25, 0.25) : 0.25);
  }

  public canvasZoomReset() {
    this.zoom.set(1);
  }

  public canvasCenter() {
    if (!this.canvasWrapperEl) {
      this.top.set(0);
      this.left.set(0);
      this.canvasZoomReset();
      return;
    }

    const {width: canvasWrapperWidth, height: canvasWrapperHeight} = this.canvasWrapperEl.getBoundingClientRect();
    const {width: canvasWidth, height: canvasHeight} = this.canvasEl!.getBoundingClientRect();
    const centerX = (canvasWrapperWidth - canvasWidth / this.zoom()) / 2;
    const centerY = (canvasWrapperHeight - canvasHeight / this.zoom()) / 2;
    this.top.set(centerY);
    this.left.set(centerX);
  }

  // endregion

  // region CANVAS SNAP SIZE
  public setSnapSize(value: number) {
    this.snapSize.set(value);
    this.resetWidgetToSnapSize()
  }

  public resetWidgetToSnapSize() {
    const snapSize = this.snapSize();
    this.widgetsState.list().forEach((widget) => {
      const newWidget = structuredClone(widget);

      newWidget.x = Math.round(widget.x / snapSize) * snapSize;
      newWidget.y = Math.round(widget.y / snapSize) * snapSize;
      newWidget.width = (Math.round(widget.width / snapSize) * snapSize) || snapSize;
      newWidget.height = (Math.round(widget.height / snapSize) * snapSize) || snapSize;
      this.widgetsState.update(newWidget);
    });
  }

  // endregion

  // region CANVAS DRAG
  public canvasDragStart({el, event}: { el: HTMLElement, event: MouseEvent }) {
    if (!this.canvasEl || !this.canvasWrapperEl) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0) {
      // 0: Main button pressed, usually the left button or the un-initialized state
      // 1: Auxiliary button pressed, usually the wheel button or the middle button (if present)
      // 2: Secondary button pressed, usually the right button
      // 3: Fourth button, typically the Browser Back button
      // 4: Fifth button, typically the Browser Forward button
      return;
    }

    this.isDraggingCanvas.set(true);
    el.classList.add(this.CANVAS_DRAGGING_CLASS);

    const {
      top: wrapperY = 0,
      left: wrapperX = 0,
    } = this.canvasWrapperEl.getBoundingClientRect();

    const diffX = (event.clientX - wrapperX);
    const diffY = (event.clientY - wrapperY);
    this.mouseDiffX.set(diffX);
    this.mouseDiffY.set(diffY);
  }

  public canvasDrag({el, event}: { el: HTMLElement, event: MouseEvent }) {
    if (!el.classList.contains(this.CANVAS_DRAGGING_CLASS)) {
      return;
    }
    if (!this.canvasEl || !this.canvasWrapperEl) {
      return;
    }

    const {
      x: wrapperX,
      y: wrapperY,
    } = this.canvasWrapperEl.getBoundingClientRect() ?? {x: 0, y: 0};

    const newX = Math.round(parseFloat(el.style.left) + (event.clientX - this.mouseDiffX() - wrapperX));
    const newY = Math.round(parseFloat(el.style.top) + (event.clientY - this.mouseDiffY() - wrapperY));

    this.mouseDiffX.set(event.clientX - wrapperX);
    this.mouseDiffY.set(event.clientY - wrapperY);
    el.style.top = `${newY}px`;
    el.style.left = `${newX}px`;
    this.top.set(newY);
    this.left.set(newX);
  }

  public canvasDragEnd({el}: { el: HTMLElement, event?: MouseEvent }) {
    if (!this.canvasEl) {
      return;
    }
    if (!el.classList.contains(this.CANVAS_DRAGGING_CLASS)) {
      return;
    }
    el.classList.remove(this.CANVAS_DRAGGING_CLASS);
    this.isDraggingCanvas.set(false);
  }

  // endregion

  // region WIDGET DRAG
  public widgetDragStart({widget, el, event}: { widget: WidgetStateItem, el: HTMLElement, event: MouseEvent }) {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0) {
      // 0: Main button pressed, usually the left button or the un-initialized state
      // 1: Auxiliary button pressed, usually the wheel button or the middle button (if present)
      // 2: Secondary button pressed, usually the right button
      // 3: Fourth button, typically the Browser Back button
      // 4: Fifth button, typically the Browser Forward button
      return;
    }

    this.isDraggingWidget.set(true);
    this.selectedWidgetId.set(widget.uuid);
    el.classList.add(this.WIDGET_DRAGGING_CLASS);
    el.style.zIndex = "9999";

    const {
      top: canvasY = 0,
      left: canvasX = 0,
    } = this.canvasEl?.getBoundingClientRect() ?? {canvasX: 0, canvasY: 0};

    const diffX = (event.clientX - canvasX);
    const diffY = (event.clientY - canvasY);
    this.mouseDiffX.set(diffX);
    this.mouseDiffY.set(diffY);
  }

  public widgetDrag({el, event}: { widget: WidgetStateItem, el: HTMLElement, event: MouseEvent }) {
    if (!this.canvasEl) {
      console.log("[CanvasService] no canvas");
      return;
    }
    if (!el.classList.contains(this.WIDGET_DRAGGING_CLASS)) {
      return;
    }
    // if (target.id !== el.id) {
    //   console.log("[CanvasService] different target")
    // }
    const {
      x: canvasX,
      y: canvasY,
      width: canvasWidth,
      height: canvasHeight
    } = this.canvasEl?.getBoundingClientRect() ?? {x: 0, y: 0, width: 0, height: 0};

    const {width, height} = el.getBoundingClientRect() ?? {width: 0, height: 0};

    const newX = parseFloat(el.style.left) + (event.clientX - this.mouseDiffX() - canvasX) / this.zoom();
    const newY = parseFloat(el.style.top) + (event.clientY - this.mouseDiffY() - canvasY) / this.zoom();

    let newSnappedX = 0;
    let newSnappedY = 0;

    if (this.canSnapToGrid()) {
      newSnappedX = Math.round(newX / this.snapSize()) * this.snapSize();
      newSnappedY = Math.round(newY / this.snapSize()) * this.snapSize();
    }

    const mouseDiffX = event.clientX - (this.canSnapToGrid() ? (newX - newSnappedX) * this.zoom() : 0) - canvasX;
    const mouseDiffY = event.clientY - (this.canSnapToGrid() ? (newY - newSnappedY) * this.zoom() : 0) - canvasY;

    if (this.canExitBorders()) {
      el.style.left = `${this.canSnapToGrid() ? newSnappedX : newX}px`;
      el.style.top = `${this.canSnapToGrid() ? newSnappedY : newY}px`;
      this.mouseDiffX.set(mouseDiffX);
      this.mouseDiffY.set(mouseDiffY);
      return;
    }

    const isOutLeft = this.canSnapToGrid() ? newSnappedX <= 0 : newX <= 0;
    const isOutRight = this.canSnapToGrid() ? newSnappedX >= ((canvasWidth ?? 0) - width) / this.zoom() : newX >= ((canvasWidth ?? 0) - width) / this.zoom()
    const isOutTop = this.canSnapToGrid() ? newSnappedY <= 0 : newY <= 0;
    const isOutBottom = this.canSnapToGrid() ? newSnappedY >= ((canvasHeight ?? 0) - height) / this.zoom() : newY >= ((canvasHeight ?? 0) - height) / this.zoom();

    // OUT LEFT - RIGHT
    if (isOutLeft || isOutRight) {
      if (isOutLeft) {
        el.style.left = `${0}px`;
      } else {
        el.style.left = `${((canvasWidth ?? 0) - width) / this.zoom()}px`;
      }
    } else {
      el.style.left = `${this.canSnapToGrid() ? newSnappedX : newX}px`;
      this.mouseDiffX.set(mouseDiffX);
    }

    // OUT TOP - BOTTOM
    if (isOutTop || isOutBottom) {
      if (isOutTop) {
        el.style.top = `${0}px`;
      } else {
        el.style.top = `${((canvasHeight ?? 0) - height) / this.zoom()}px`;
      }
    } else {
      el.style.top = `${this.canSnapToGrid() ? newSnappedY : newY}px`;
      this.mouseDiffY.set(mouseDiffY);
    }
  }

  public widgetDragEnd({widget, el}: { widget: WidgetStateItem, el: HTMLElement, event?: MouseEvent }) {
    if (!el.classList.contains(this.WIDGET_DRAGGING_CLASS)) {
      return;
    }
    el.classList.remove(this.WIDGET_DRAGGING_CLASS);
    el.style.zIndex = widget.z.toString();
    this.isDraggingWidget.set(false);
    this.selectedWidgetId.set(null);

    // UPDATE STATE
    this.widgetsState.update({
      ...this.widgetsState.getById(widget.uuid),
      x: parseInt(el.style.left),
      y: parseInt(el.style.top),
    });
  }

  // endregion

  // region WIDGET RESIZE
  public widgetResizeStart({widget, el, event, position}: {
    widget: WidgetStateItem,
    el: HTMLElement,
    event: MouseEvent,
    position: ResizePosition
  }) {
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0) {
      // 0: Main button pressed, usually the left button or the un-initialized state
      // 1: Auxiliary button pressed, usually the wheel button or the middle button (if present)
      // 2: Secondary button pressed, usually the right button
      // 3: Fourth button, typically the Browser Back button
      // 4: Fifth button, typically the Browser Forward button
      return;
    }
    this.isResizingWidget.set(true);
    this.widgetResizingPosition.set(position);
    this.selectedWidgetId.set(widget.uuid);
    el.classList.add(this.WIDGET_RESIZING_CLASS);
    el.style.zIndex = "9999";

    console.log("START resize", this.widgetResizingPosition());
    const {
      top: canvasY = 0,
      left: canvasX = 0,
    } = this.canvasEl?.getBoundingClientRect() ?? {canvasX: 0, canvasY: 0};

    const diffX = (event.clientX - canvasX);
    const diffY = (event.clientY - canvasY);
    this.mouseDiffX.set(diffX);
    this.mouseDiffY.set(diffY);
  }

  public widgetResize({el, event}: { widget: WidgetStateItem, el: HTMLElement, event: MouseEvent }) {
    if (!this.canvasEl) {
      console.log("[CanvasService] no canvas");
      return;
    }
    if (!el.classList.contains(this.WIDGET_RESIZING_CLASS)) {
      return;
    }
    const {
      x: canvasX,
      y: canvasY,
      width: canvasWidth,
      height: canvasHeight
    } = this.canvasEl?.getBoundingClientRect() ?? {x: 0, y: 0, width: 0, height: 0};

    const left = parseFloat(el.style.left);
    const top = parseFloat(el.style.top);
    const width = parseFloat(el.style.width);
    const height = parseFloat(el.style.height);

    const newX = (event.clientX - this.mouseDiffX() - canvasX) / this.zoom();
    const newY = (event.clientY - this.mouseDiffY() - canvasY) / this.zoom();

    let newSnappedX = 0;
    let newSnappedY = 0;

    if (this.canSnapToGrid()) {
      newSnappedX = Math.round(newX / this.snapSize()) * this.snapSize();
      newSnappedY = Math.round(newY / this.snapSize()) * this.snapSize();
    }
    let mouseDiffX = event.clientX - (this.canSnapToGrid() ? (newX - newSnappedX) * this.zoom() : 0) - canvasX;
    if (mouseDiffX > canvasWidth) {
      mouseDiffX = canvasWidth;
    }
    if (mouseDiffX < this.snapSize()) {
      mouseDiffX = this.snapSize();
    }

    // console.log(`event.clientX |${event.clientX}| - (this.canSnapToGrid() |${this.canSnapToGrid()}| ? (newX |${newX}| - newSnappedX |${newSnappedX}|) * this.zoom() |${this.zoom()}| : 0) - canvasX |${canvasX}|`)

    let mouseDiffY = event.clientY - (this.canSnapToGrid() ? (newY - newSnappedY) * this.zoom() : 0) - canvasY;
    if (mouseDiffY > canvasHeight) {
      mouseDiffY = canvasHeight;
    }
    if (mouseDiffY < this.snapSize()) {
      mouseDiffY = this.snapSize();
    }

    let newLeft = left;
    let newTop = top;
    let newWidth = width;
    let newHeight = height;
    switch (this.widgetResizingPosition()) {
      // TODO: check min width/height = snapSize or 1
      case "right":
        newWidth = (width + (this.canSnapToGrid() ? newSnappedX : newX));
        if (newWidth < this.snapSize()) {
          newWidth = this.snapSize();
        }
        break;
      case "bottom":
        newHeight = (height + (this.canSnapToGrid() ? newSnappedY : newY));
        if (newHeight < this.snapSize()) {
          newHeight = this.snapSize();
        }
        break;
      case "left": {
        const normalLeft = parseFloat(el.style.left) + newX;
        const snappedLeft = Math.round(normalLeft / this.snapSize()) * this.snapSize();
        newWidth = (width - (this.canSnapToGrid() ? newSnappedX : newX));
        if (newWidth < this.snapSize()) {
          newWidth = this.snapSize() - (this.canSnapToGrid() ? newSnappedX : newX);
          break;
        }
        newLeft = (this.canSnapToGrid() ? snappedLeft : normalLeft);
        break;
      }
      case "top": {
        const normalTop = parseFloat(el.style.top) + newY;
        const snappedTop = Math.round(normalTop / this.snapSize()) * this.snapSize();
        newHeight = (height - (this.canSnapToGrid() ? newSnappedY : newY));
        if (newHeight < this.snapSize()) {
          newHeight = this.snapSize() - (this.canSnapToGrid() ? newSnappedY : newY);
          break;
        }
        newTop = (this.canSnapToGrid() ? snappedTop : normalTop);
        break;
      }
    }
    if (this.canExitBorders()) {
      el.style.width = `${newWidth}px`;
      el.style.left = `${newLeft}px`;
      el.style.height = `${newHeight}px`;
      el.style.top = `${newTop}px`;

      this.mouseDiffX.set(mouseDiffX);
      this.mouseDiffY.set(mouseDiffY);
      return;
    }

    const isOutLeft = this.widgetResizingPosition() === "left" && newLeft < 0;
    const isOutRight = this.widgetResizingPosition() === "right" && (newLeft + newWidth) > ((canvasWidth ?? 0)) / this.zoom();
    const isOutTop = this.widgetResizingPosition() === "top" && newTop < 0;
    const isOutBottom = this.widgetResizingPosition() === "bottom" && (newTop + newHeight) > ((canvasHeight ?? 0)) / this.zoom();

    // OUT LEFT - RIGHT
    if (isOutLeft || isOutRight) {
      if (isOutLeft) {
        if (parseFloat(el.style.left) !== 0) {
          el.style.left = `${0}px`;
          el.style.width = `${newWidth + newX}px`;
          this.mouseDiffX.set(mouseDiffX);
        }
      } else {
        if (parseFloat(el.style.left) + parseFloat(el.style.width) !== canvasWidth) {
          el.style.width = `${((canvasWidth ?? 0) / this.zoom() - parseFloat(el.style.left))}px`;
          this.mouseDiffX.set(mouseDiffX);
        }
      }
    } else {
      el.style.width = `${newWidth}px`;
      el.style.left = `${newLeft}px`;
      this.mouseDiffX.set(mouseDiffX);
    }

    // OUT TOP - BOTTOM
    if (isOutTop || isOutBottom) {
      if (isOutTop) {
        if (parseFloat(el.style.top) !== 0) {
          el.style.top = `${0}px`;
          el.style.height = `${newHeight + newY}px`;
          this.mouseDiffY.set(mouseDiffY);
        }
      } else {
        if (parseFloat(el.style.top) + parseFloat(el.style.height) !== canvasHeight) {
          el.style.height = `${((canvasHeight ?? 0) / this.zoom() - parseFloat(el.style.top))}px`;
          this.mouseDiffY.set(mouseDiffY);
        }
      }
    } else {
      el.style.height = `${newHeight}px`;
      el.style.top = `${newTop}px`;
      this.mouseDiffY.set(mouseDiffY);
    }
  }

  public widgetResizeEnd({widget, el, event}: { widget: WidgetStateItem, el: HTMLElement, event?: MouseEvent }) {
    event?.stopPropagation();
    if (!el.classList.contains(this.WIDGET_RESIZING_CLASS)) {
      return;
    }
    console.log("END resize", this.widgetResizingPosition());
    el.classList.remove(this.WIDGET_RESIZING_CLASS);
    el.style.zIndex = widget.z.toString();
    this.isResizingWidget.set(false);
    this.widgetResizingPosition.set(null);
    this.selectedWidgetId.set(null);

    // UPDATE STATE
    this.widgetsState.update({
      ...this.widgetsState.getById(widget.uuid),
      width: parseInt(el.style.width),
      height: parseInt(el.style.height),
      x: parseInt(el.style.left),
      y: parseInt(el.style.top),
    });
  }

  // endregion
}
