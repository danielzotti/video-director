import {AfterViewInit, Directive, effect, ElementRef, HostBinding, HostListener, inject, input, Renderer2} from '@angular/core';
import {DEFAULT_WIDGET_BACKGROUND_OPACITY, DEFAULT_WIDGET_OPACITY, WidgetStateItem} from '../models/canvas-widget-state.models';

import {CanvasService, ResizePosition} from "../services/canvas.service";

@Directive({
    selector: '[appCanvasWidget]',
    standalone: true
})
export class CanvasWidgetDirective implements AfterViewInit {
    private static readonly RESIZE_HANDLES: ResizePosition[] = [
        'left',
        'right',
        'top',
        'bottom',
        'top-left',
        'top-right',
        'bottom-right',
        'bottom-left',
    ];
    private static readonly BASE_RESIZER_SIZE = 8;
    private static readonly CORNER_HANDLE_MULTIPLIER = 2.5;

    private readonly renderer = inject(Renderer2);
    private readonly elRef = inject(ElementRef<HTMLElement>);
    private readonly resizerEls: HTMLElement[] = [];

    canvasService = inject(CanvasService);

    constructor() {
        effect(() => {
            this.canvasService.canResizeWidget();
            const widgetLocked = !!this.widget().locked;
            this.applyResizerCursorState(widgetLocked);
        });
    }

    // INPUTS
    widget = input.required<WidgetStateItem>({alias: 'appCanvasWidget'});
    debugMode = input(false);

    @HostBinding('class.debug-mode')
    get isDebugMode() {
        return this.debugMode();
    }

    @HostBinding('class.app-canvas-widget--selected')
    get isSelected() {
        return this.canvasService.selectedWidgetId() === this.widget().uuid;
    }

    ngAfterViewInit() {

        for (const position of CanvasWidgetDirective.RESIZE_HANDLES) {
            this.addResizer({position});
        }
        this.applyResizerCursorState(!!this.widget().locked);
    }

    @HostBinding('class')
    elementClass = 'app-canvas-widget';

    @HostBinding('style')
    get style() {
        const widget = this.widget();
        const bw = widget.borderWidth ?? 0;
        const bs = widget.borderStyle ?? 'none';

        const shadowStyles = this.getBoxShadowStyle(widget);

        return {
            top: widget.y + 'px',
            left: widget.x + 'px',
            width: widget.width + 'px',
            height: widget.height + 'px',
            backgroundColor: this.getWidgetBackgroundColor(widget),
            opacity: this.normalizeWidgetOpacity(widget.opacity) / 100,
            zIndex: this.canvasService.getWidgetRenderZIndex(widget),
            position: 'absolute',
            borderRadius: (widget.borderRadius ?? 0) + 'px',
            borderWidth: bw + 'px',
            borderStyle: bw > 0 ? bs : 'none',
            borderColor: bw > 0 ? (widget.borderColor ?? '#000000') : 'transparent',
            padding: (widget.padding ?? 0) + 'px',
            boxSizing: 'border-box',
            boxShadow: shadowStyles,
            cursor: this.canvasService.canMoveWidget() && !widget.locked ? 'move' : 'default',
        };
    }

    @HostBinding('attr.id')
    get id() {
        return `app-canvas-widget-${this.widget().uuid}`;
    }

    // @HostBinding('attr.draggable') draggable = 'true';
    // @HostBinding('attr.resizable') resizable = 'resizable';

    @HostListener('pointerdown', ['$event'])
    onPointerDown(event: PointerEvent) {
        this.canvasService.widgetDragStart({
            widget: this.widget(),
            el: this.elRef.nativeElement,
            event
        })
    }


    private addResizer({
                           position
                       }: {
        position: ResizePosition;
    }) {

        const resizerSize = CanvasWidgetDirective.BASE_RESIZER_SIZE;
        const cornerHandleSize = CanvasWidgetDirective.CORNER_HANDLE_MULTIPLIER * resizerSize;
        const edgeOffset = -Math.floor(resizerSize / 4);
        const cornerOffset = -Math.floor(resizerSize / 2);
        const resizer = this.renderer.createElement('div');


        this.renderer.setStyle(resizer, "position", "absolute");
        this.renderer.addClass(resizer, `${this.canvasService.WIDGET_RESIZER_CLASS}`);
        this.renderer.addClass(resizer, `${this.canvasService.WIDGET_RESIZER_CLASS}-${position}`);

        let resizeCursor = 'default';

        switch (position) {
            case "top":
            case "bottom":
                this.renderer.setStyle(resizer, "width", "100%"); // `${edgeHandleSize}px`
                this.renderer.setStyle(resizer, "height", `${resizerSize}px`);
                this.renderer.setStyle(resizer, position, `${edgeOffset}px`);
                this.renderer.setStyle(resizer, "transform", `translate(-50%, 0%)`);
                this.renderer.setStyle(resizer, "left", "50%");
                resizeCursor = 'ns-resize';
                break;
            case "right":
            case "left":
                this.renderer.setStyle(resizer, "height", "100%"); // `${edgeHandleSize}px`
                this.renderer.setStyle(resizer, "width", `${resizerSize}px`);
                this.renderer.setStyle(resizer, position, `${edgeOffset}px`);
                this.renderer.setStyle(resizer, "transform", `translate(0%, -50%)`);
                this.renderer.setStyle(resizer, "top", "50%");
                resizeCursor = 'ew-resize';
                break;
            case 'top-left':
            case 'top-right':
            case 'bottom-right':
            case 'bottom-left':
                this.renderer.setStyle(resizer, 'width', `${cornerHandleSize}px`);
                this.renderer.setStyle(resizer, 'height', `${cornerHandleSize}px`);
                this.renderer.setStyle(resizer, 'transform', 'none');
                if (position.includes('top')) {
                    this.renderer.setStyle(resizer, 'top', `${cornerOffset}px`);
                }
                if (position.includes('bottom')) {
                    this.renderer.setStyle(resizer, 'bottom', `${cornerOffset}px`);
                }
                if (position.includes('left')) {
                    this.renderer.setStyle(resizer, 'left', `${cornerOffset}px`);
                }
                if (position.includes('right')) {
                    this.renderer.setStyle(resizer, 'right', `${cornerOffset}px`);
                }
                resizeCursor = position === 'top-left' || position === 'bottom-right' ? 'nwse-resize' : 'nesw-resize';
                break;
        }

        (resizer as HTMLElement).dataset['resizeCursor'] = resizeCursor;

        this.renderer.listen(resizer, 'pointerdown', (event: PointerEvent) => {
            this.canvasService.widgetResizeStart({
                widget: this.widget(),
                el: this.elRef.nativeElement,
                event,
                position
            })
        })

        this.resizerEls.push(resizer as HTMLElement);

        // Append the new element to the host element
        this.renderer.appendChild(this.elRef.nativeElement, resizer);
    }

    private applyResizerCursorState(isWidgetLocked: boolean): void {
        const canResize = this.canvasService.canResizeWidget() && !isWidgetLocked;

        for (const resizer of this.resizerEls) {
            const resizeCursor = resizer.dataset['resizeCursor'] ?? 'default';
            this.renderer.setStyle(resizer, 'cursor', canResize ? resizeCursor : 'default');
        }
    }

    private getWidgetBackgroundColor(widget: WidgetStateItem): string {
        const background = widget.background?.trim();
        if (!background || background === 'transparent') {
            return 'transparent';
        }

        const opacity = this.normalizeBackgroundOpacity(widget.backgroundOpacity);
        if (opacity >= 100) {
            return background;
        }

        return `color-mix(in srgb, ${background} ${opacity}%, transparent)`;
    }

    private normalizeBackgroundOpacity(value?: number): number {
        if (!Number.isFinite(value)) {
            return DEFAULT_WIDGET_BACKGROUND_OPACITY;
        }

        return Math.max(0, Math.min(100, Math.round(Number(value))));
    }

    private normalizeWidgetOpacity(value?: number): number {
        if (!Number.isFinite(value)) {
            return DEFAULT_WIDGET_OPACITY;
        }

        return Math.max(0, Math.min(100, Math.round(Number(value))));
    }

    private getBoxShadowStyle(widget: WidgetStateItem): string {
        const shadowBlur = widget.shadowBlur ?? 0;
        if (shadowBlur === 0) {
            return 'none';
        }

        const offsetX = widget.shadowOffsetX ?? 0;
        const offsetY = widget.shadowOffsetY ?? 0;
        const color = widget.shadowColor ?? '#000000';

        return `${offsetX}px ${offsetY}px ${shadowBlur}px ${color}`;
    }

}
