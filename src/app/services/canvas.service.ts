import {computed, inject, Injectable, Renderer2, RendererFactory2, signal} from '@angular/core';
import {
    DEFAULT_WIDGET_TEXT,
    WidgetContentType,
    WidgetStateItem,
} from '../models/canvas-widget-state.models';
import {AxisGuides, Point2D, Rect2D, ResizeHandle} from '../models/geometry.models';
import {CanvasWidgetStateService} from './canvas-widget-state.service';
import {CanvasWidgetDragService} from './canvas-widget-drag.service';
import {CanvasWidgetResizeService} from './canvas-widget-resize.service';
import {CanvasViewportService} from './canvas-viewport.service';
import {MathService} from './math.service';
import {
    clampRectInsideCanvas,
    screenToCanvasPoint,
    snapPointToGrid,
} from '../utils/canvas-geometry.utils';

export interface CanvasServiceInitModel {
    canvas: HTMLElement;
    canvasWrapper?: HTMLElement;
    allowExitBorders?: boolean;
    allowSnapToGrid?: boolean;
    allowSnapToObjects?: boolean;
    allowSnapToBorder?: boolean;
    allowWidgetResize?: boolean;
    width?: number;
    height?: number;
    snapSize?: number;
    zoom?: number;
}

export type ResizePosition = ResizeHandle;
export type SettingsPanelLayout = 'floating' | 'fixed-right' | 'closed';
export type LayersPanelLayout = 'floating' | 'fixed-left' | 'closed';
type PointerLikeEvent = MouseEvent | PointerEvent;

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

    public readonly widgetsState = inject(CanvasWidgetStateService);
    private readonly widgetDragService = inject(CanvasWidgetDragService);
    private readonly widgetResizeService = inject(CanvasWidgetResizeService);
    private readonly viewportService = inject(CanvasViewportService);
    private readonly mathService = inject(MathService);

    public canManageCanvas = signal(false);
    public canExitBorders = signal(false);
    public canSnapToGrid = signal(false);
    public canSnapToObjects = signal(true);
    public canSnapToBorder = signal(false);
    public canResizeWidget = signal(false);
    public debugMode = signal(true);
    public debugPanelVisible = signal(false);
    public settingsPanelLayout = signal<SettingsPanelLayout>('fixed-right');
    public layersPanelLayout = signal<LayersPanelLayout>('fixed-left');

    public isDraggingCanvas = signal(false);
    public isDraggingWidget = signal(false);
    public isResizingWidget = signal(false);
    public isSpacePressed = signal(false);
    public widgetResizingPosition = signal<ResizePosition | null>(null);
    public selectedWidgetId = signal<string | null>(null);
    public objectSnapGuides = signal<AxisGuides>({});

    public zoom = signal(1);
    public width = signal(800);
    public height = signal(600);
    public top = signal(0);
    public left = signal(0);
    public snapSize = signal(1);

    public readonly snapSizeList = computed<number[]>(() => {
        return this.mathService.divisorsInCommon(this.width(), this.height()) ?? [1];
    });

    public readonly selectedWidget = computed<WidgetStateItem | null>(() => {
        const selectedId = this.selectedWidgetId();
        return selectedId ? this.widgetsState.getById(selectedId) ?? null : null;
    });

    private readonly objectSnapDistance = 8;
    private readonly borderSnapDistance = 8;

    private canvasDragStartPointer: Point2D | null = null;
    private canvasDragStartOffset: Point2D | null = null;
    private activeWidgetEl: HTMLElement | null = null;
    private widgetDragOffset: Point2D | null = null;
    private resizeStartPointer: Point2D | null = null;
    private resizeStartRect: Rect2D | null = null;
    private resizeStartAspectRatio: number | null = null;

    private readonly renderer: Renderer2 = inject(RendererFactory2).createRenderer(null, null);

    public init({
                    canvas,
                    canvasWrapper,
                    allowExitBorders = false,
                    allowSnapToGrid = true,
                    allowSnapToObjects = false,
                    allowSnapToBorder = false,
                    width = 800,
                    height = 600,
                    snapSize = 1,
                    allowWidgetResize = true,
                    zoom = 1,
                }: CanvasServiceInitModel) {
        this.canvasEl = canvas;
        this.canvasWrapperEl = canvasWrapper ?? null;

        this.canManageCanvas.set(true); // !!this.canvasWrapperEl
        this.canExitBorders.set(allowExitBorders);
        this.canSnapToGrid.set(allowSnapToGrid);
        this.canSnapToObjects.set(allowSnapToObjects);
        this.canSnapToBorder.set(allowSnapToBorder);
        this.canResizeWidget.set(allowWidgetResize);

        this.width.set(width);
        this.height.set(height);
        this.zoom.set(this.viewportService.clampZoom(zoom));
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
            this.width.set(Math.max(1, Math.round(width)));
        }
        if (typeof height === 'number') {
            this.height.set(Math.max(1, Math.round(height)));
        }

        if (this.canvasEl) {
            this.renderer.setStyle(this.canvasEl, 'width', `${this.width()}px`);
            this.renderer.setStyle(this.canvasEl, 'height', `${this.height()}px`);
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

    public canvasFitToViewport() {
        if (!this.canvasWrapperEl) {
            this.zoom.set(1);
            this.top.set(0);
            this.left.set(0);
            return;
        }

        const wrapperRect = this.canvasWrapperEl.getBoundingClientRect();
        const nextZoom = this.viewportService.fitCanvasZoom({
            wrapper: {width: wrapperRect.width, height: wrapperRect.height},
            canvas: {width: this.width(), height: this.height()},
        });

        this.zoom.set(nextZoom);
        this.canvasCenter();
    }

    public canvasCenter() {
        if (!this.canvasWrapperEl) {
            this.top.set(0);
            this.left.set(0);
            return;
        }

        const wrapperRect = this.canvasWrapperEl.getBoundingClientRect();
        const center = this.viewportService.centerCanvas({
            wrapper: {width: wrapperRect.width, height: wrapperRect.height},
            canvas: {width: this.width(), height: this.height()},
            zoom: this.zoom(),
        });

        this.left.set(center.x);
        this.top.set(center.y);
    }

    public setSnapSize(value: number) {
        this.snapSize.set(Math.max(1, value));
        this.resetWidgetToSnapSize();
    }

    public setExitBorders(value: boolean) {
        this.canExitBorders.set(value);
    }

    public setSnapToGrid(value: boolean) {
        this.canSnapToGrid.set(value);

        if (value) {
            this.resetWidgetToSnapSize();
            return;
        }

        if (this.canSnapToObjects()) {
            this.objectSnapGuides.set({});
        }
    }

    public setSnapToObjects(value: boolean) {
        this.canSnapToObjects.set(value);
        if (!value) {
            this.objectSnapGuides.set({});
        }
    }

    public setSnapToBorder(value: boolean) {
        this.canSnapToBorder.set(value);
        if (!value) {
            this.objectSnapGuides.set({});
        }
    }

    public setWidgetResize(value: boolean) {
        this.canResizeWidget.set(value);
    }

    public setDebugMode(value: boolean) {
        this.debugMode.set(value);
    }


    public setDebugPanelVisible(value: boolean) {
        this.debugPanelVisible.set(value);
    }

    public setSettingsPanelLayout(value: SettingsPanelLayout) {
        this.settingsPanelLayout.set(value);
    }

    public setLayersPanelLayout(value: LayersPanelLayout) {
        this.layersPanelLayout.set(value);
    }

    public selectWidget(widgetId: string | null) {
        this.selectedWidgetId.set(widgetId);
    }

    public getWidgetRenderZIndex(widget: Pick<WidgetStateItem, 'uuid' | 'z'>): number {
        if (this.selectedWidgetId() !== widget.uuid) {
            return widget.z;
        }

        const maxLayerZ = this.widgetsState
            .list()
            .reduce((maxZ, item) => Math.max(maxZ, item.z), 0);

        return Math.max(maxLayerZ, widget.z) + 1;
    }

    public setSelectedWidgetContentType(type: WidgetContentType) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type === type) {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: type === 'text'
                ? {type: 'text', text: DEFAULT_WIDGET_TEXT}
                : {type: 'image', src: '', alt: ''},
        });
    }

    public setSelectedWidgetText(text: string) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'text') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                type: 'text',
                text,
            },
        });
    }

    public setSelectedWidgetImageSrc(src: string) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'image') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                src,
            },
        });
    }

    public setSelectedWidgetImageAlt(alt: string) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'image') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                alt,
            },
        });
    }

    public setSelectedWidgetName(name: string) {
        const widget = this.selectedWidget();
        if (!widget) {
            return;
        }

        this.widgetsState.renameLayer(widget.uuid, name);
    }

    public setSelectedWidgetX(value: number) {
        this.updateSelectedWidgetRect({x: value});
    }

    public setSelectedWidgetY(value: number) {
        this.updateSelectedWidgetRect({y: value});
    }

    public setSelectedWidgetWidth(value: number) {
        this.updateSelectedWidgetRect({width: value});
    }

    public setSelectedWidgetHeight(value: number) {
        this.updateSelectedWidgetRect({height: value});
    }

    public isValidImageUrl(src: string): boolean {
        if (!src.trim()) {
            return false;
        }

        try {
            const url = new URL(src);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
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

    public canvasDragStart({el, event}: { el: HTMLElement, event: PointerLikeEvent }) {
        if (!this.canvasEl || !this.canvasWrapperEl) {
            return;
        }

        const canPan = event.button === 1 || event.button === 0;
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

    public canvasDrag({el, event}: { el: HTMLElement, event: PointerLikeEvent }) {
        if (!el.classList.contains(this.CANVAS_DRAGGING_CLASS) || !this.canvasDragStartPointer || !this.canvasDragStartOffset) {
            return;
        }

        const dx = event.clientX - this.canvasDragStartPointer.x;
        const dy = event.clientY - this.canvasDragStartPointer.y;

        this.left.set(Math.round(this.canvasDragStartOffset.x + dx));
        this.top.set(Math.round(this.canvasDragStartOffset.y + dy));
    }

    public canvasDragEnd({el}: { el: HTMLElement, event?: PointerLikeEvent }) {
        if (!el.classList.contains(this.CANVAS_DRAGGING_CLASS)) {
            return;
        }

        el.classList.remove(this.CANVAS_DRAGGING_CLASS);
        this.isDraggingCanvas.set(false);
        this.canvasDragStartPointer = null;
        this.canvasDragStartOffset = null;
    }

    public handleGlobalPointerMove(event: PointerLikeEvent) {
        if (this.isDraggingWidget()) {
            const widgetId = this.selectedWidgetId();
            const widget = widgetId ? this.widgetsState.getById(widgetId) : null;

            if (!widget || !this.activeWidgetEl) {
                return;
            }

            this.widgetDrag({
                widget,
                el: this.activeWidgetEl,
                event,
            });
            return;
        }

        if (this.isResizingWidget()) {
            const widgetId = this.selectedWidgetId();
            const widget = widgetId ? this.widgetsState.getById(widgetId) : null;

            if (!widget || !this.activeWidgetEl) {
                return;
            }

            this.widgetResize({
                widget,
                el: this.activeWidgetEl,
                event,
            });
        }
    }

    public handleGlobalPointerUp(event: PointerLikeEvent) {
        if (this.isDraggingWidget()) {
            const widgetId = this.selectedWidgetId();
            const widget = widgetId ? this.widgetsState.getById(widgetId) : null;

            if (!widget || !this.activeWidgetEl) {
                return;
            }

            this.widgetDragEnd({
                widget,
                el: this.activeWidgetEl,
                event,
            });
            return;
        }

        if (this.isResizingWidget()) {
            const widgetId = this.selectedWidgetId();
            const widget = widgetId ? this.widgetsState.getById(widgetId) : null;

            if (!widget || !this.activeWidgetEl) {
                return;
            }

            this.widgetResizeEnd({
                widget,
                el: this.activeWidgetEl,
                event,
            });
        }
    }

    public widgetDragStart({widget, el, event}: { widget: WidgetStateItem, el: HTMLElement, event: PointerLikeEvent }) {
        if (event.button !== 0 || !this.canvasEl || this.isSpacePressed()) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.isDraggingWidget.set(true);
        this.selectWidget(widget.uuid);
        this.activeWidgetEl = el;
        el.classList.add(this.WIDGET_DRAGGING_CLASS);
        el.style.zIndex = '9999';

        const pointerCanvas = this.getPointerCanvasPoint(event);
        this.widgetDragOffset = this.widgetDragService.createDragOffset({
            pointerCanvas,
            widget,
        });

        this.objectSnapGuides.set({});
    }

    public widgetDrag({widget, el, event}: { widget: WidgetStateItem, el: HTMLElement, event: PointerLikeEvent }) {
        if (!el.classList.contains(this.WIDGET_DRAGGING_CLASS) || !this.widgetDragOffset) {
            return;
        }

        const pointerCanvas = this.getPointerCanvasPoint(event);
        const siblings = this.widgetsState.list().filter((item) => item.uuid !== widget.uuid);
        const moveResult = this.widgetDragService.computeNextPosition({
            pointerCanvas,
            dragOffset: this.widgetDragOffset,
            widget,
            siblings,
            snapToGrid: this.canSnapToGrid(),
            snapSize: this.snapSize(),
            snapToObjects: this.canSnapToObjects(),
            objectSnapDistance: this.objectSnapDistance,
            snapToBorder: this.canSnapToBorder(),
            borderSnapDistance: this.borderSnapDistance,
            zoom: this.zoom(),
            canExitBorders: this.canExitBorders(),
            canvas: {width: this.width(), height: this.height()},
        });

        const next = moveResult.point;
        this.objectSnapGuides.set(this.canSnapToObjects() || this.canSnapToBorder() ? moveResult.guides : {});

        el.style.left = `${next.x}px`;
        el.style.top = `${next.y}px`;
    }

    public widgetDragEnd({widget, el}: { widget: WidgetStateItem, el: HTMLElement, event?: PointerLikeEvent }) {
        if (!el.classList.contains(this.WIDGET_DRAGGING_CLASS)) {
            return;
        }

        el.classList.remove(this.WIDGET_DRAGGING_CLASS);
        el.style.zIndex = this.getWidgetRenderZIndex(widget).toString();
        this.isDraggingWidget.set(false);
        this.activeWidgetEl = null;
        this.widgetDragOffset = null;
        this.objectSnapGuides.set({});

        const stateWidget = this.widgetsState.getById(widget.uuid);
        if (!stateWidget) {
            return;
        }

        this.widgetsState.update({
            ...stateWidget,
            ...this.widgetDragService.readElementPosition(el),
        });
    }

    public widgetResizeStart({widget, el, event, position}: {
        widget: WidgetStateItem,
        el: HTMLElement,
        event: PointerLikeEvent,
        position: ResizePosition
    }) {
        if (event.button !== 0 || !this.canResizeWidget() || this.isSpacePressed()) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.isResizingWidget.set(true);
        this.widgetResizingPosition.set(position);
        this.selectWidget(widget.uuid);
        this.activeWidgetEl = el;
        el.classList.add(this.WIDGET_RESIZING_CLASS);
        el.style.zIndex = '9999';

        this.resizeStartPointer = this.getPointerCanvasPoint(event);
        this.resizeStartRect = this.widgetResizeService.readElementRect(el, {
            width: this.snapSize(),
            height: this.snapSize(),
        });
        this.resizeStartAspectRatio = this.resizeStartRect.height > 0
            ? this.resizeStartRect.width / this.resizeStartRect.height
            : null;
    }

    public widgetResize({el, event}: { widget: WidgetStateItem, el: HTMLElement, event: PointerLikeEvent }) {
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

        const nextRect = this.widgetResizeService.computeNextRect({
            handle: position,
            initialRect: this.resizeStartRect,
            delta,
            min: {width: this.snapSize(), height: this.snapSize()},
            snapToGrid: this.canSnapToGrid(),
            snapSize: this.snapSize(),
            canExitBorders: this.canExitBorders(),
            canvas: {width: this.width(), height: this.height()},
            keepAspectRatio: event.shiftKey,
            aspectRatio: this.resizeStartAspectRatio ?? undefined,
        });

        el.style.width = `${nextRect.width}px`;
        el.style.height = `${nextRect.height}px`;
        el.style.left = `${nextRect.x}px`;
        el.style.top = `${nextRect.y}px`;
    }

    public widgetResizeEnd({widget, el, event}: {
        widget: WidgetStateItem,
        el: HTMLElement,
        event?: PointerLikeEvent
    }) {
        event?.stopPropagation();

        if (!el.classList.contains(this.WIDGET_RESIZING_CLASS)) {
            return;
        }

        el.classList.remove(this.WIDGET_RESIZING_CLASS);
        el.style.zIndex = this.getWidgetRenderZIndex(widget).toString();
        this.isResizingWidget.set(false);
        this.widgetResizingPosition.set(null);
        this.activeWidgetEl = null;
        this.resizeStartPointer = null;
        this.resizeStartRect = null;
        this.resizeStartAspectRatio = null;

        const stateWidget = this.widgetsState.getById(widget.uuid);
        if (!stateWidget) {
            return;
        }

        const rect = this.widgetResizeService.readElementRect(el, {
            width: this.snapSize(),
            height: this.snapSize(),
        });

        this.widgetsState.update({
            ...stateWidget,
            width: rect.width,
            height: rect.height,
            x: rect.x,
            y: rect.y,
        });
    }

    private canvasZoomBy(delta: number, focalPoint?: Point2D) {
        const oldZoom = this.zoom();
        const nextZoom = this.viewportService.clampZoom(Math.round((oldZoom + delta) * 100) / 100);

        if (oldZoom === nextZoom || !this.canvasEl) {
            return;
        }

        if (!focalPoint || !this.canvasWrapperEl) {
            this.zoom.set(nextZoom);
            return;
        }

        const canvasRect = this.canvasEl.getBoundingClientRect();
        const wrapperRect = this.canvasWrapperEl.getBoundingClientRect();

        const next = this.viewportService.zoomFromFocalPoint({
            delta,
            oldZoom,
            focalPoint,
            canvasOffset: {x: canvasRect.left, y: canvasRect.top},
            wrapperOffset: {x: wrapperRect.left, y: wrapperRect.top},
        });

        this.zoom.set(next.zoom);
        this.left.set(next.left);
        this.top.set(next.top);
    }

    private updateSelectedWidgetRect(patch: Partial<Rect2D>) {
        const widget = this.selectedWidget();
        if (!widget) {
            return;
        }

        const isResizePatch = typeof patch.width === 'number' || typeof patch.height === 'number';
        if (isResizePatch && !this.canResizeWidget()) {
            return;
        }

        const snap = this.canSnapToGrid() ? Math.max(1, this.snapSize()) : 1;

        let next: Rect2D = {
            x: Math.round(patch.x ?? widget.x),
            y: Math.round(patch.y ?? widget.y),
            width: Math.max(1, Math.round(patch.width ?? widget.width)),
            height: Math.max(1, Math.round(patch.height ?? widget.height)),
        };

        if (this.canSnapToGrid()) {
            const snappedPoint = snapPointToGrid({
                point: {x: next.x, y: next.y},
                snap,
            });

            next = {
                ...next,
                x: snappedPoint.x,
                y: snappedPoint.y,
                width: Math.max(snap, Math.round(next.width / snap) * snap),
                height: Math.max(snap, Math.round(next.height / snap) * snap),
            };
        }

        if (!this.canExitBorders()) {
            next = clampRectInsideCanvas({
                rect: next,
                canvas: {
                    width: this.width(),
                    height: this.height(),
                },
            });
        }

        this.widgetsState.update({
            ...widget,
            ...next,
        });
    }

    private getPointerCanvasPoint(event: PointerLikeEvent): Point2D {
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
