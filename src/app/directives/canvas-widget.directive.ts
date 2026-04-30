import {AfterViewInit, Directive, ElementRef, HostBinding, HostListener, inject, input, Renderer2} from '@angular/core';
import {WidgetStateItem} from '../models/canvas-widget-state.models';

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
  private static readonly BASE_RESIZER_SIZE = 5;
  private static readonly EDGE_HANDLE_MULTIPLIER = 10;
  private static readonly CORNER_HANDLE_MULTIPLIER = 2;

  private readonly renderer = inject(Renderer2);
  private readonly elRef = inject(ElementRef<HTMLElement>);

  canvasService = inject(CanvasService);

  // INPUTS
  widget = input.required<WidgetStateItem>({alias: 'appCanvasWidget'});

  ngAfterViewInit() {
    for (const position of CanvasWidgetDirective.RESIZE_HANDLES) {
      this.addResizer({position});
    }
  }

  @HostBinding('class')
  elementClass = 'app-canvas-widget';

  @HostBinding('style')
  get style() {
    return {
      top: this.widget().y + 'px',
      left: this.widget().x + 'px',
      width: this.widget().width + 'px',
      height: this.widget().height + 'px',
      zIndex: this.widget().z,
      position: "absolute"
    };
  }

  @HostBinding('attr.id')
  get id() {
    return `app-canvas-widget-${this.widget().uuid}`;
  }

  // @HostBinding('attr.draggable') draggable = 'true';
  // @HostBinding('attr.resizable') resizable = 'resizable';

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    this.canvasService.widgetDragStart({
      widget: this.widget(),
      el: this.elRef.nativeElement,
      event
    })
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.canvasService.isDraggingWidget()) {
      this.canvasService.widgetDrag({
        widget: this.widget(),
        el: this.elRef.nativeElement,
        event
      });
      return;
    }

    if (this.canvasService.isResizingWidget()) {
      this.canvasService.widgetResize({
        widget: this.widget(),
        el: this.elRef.nativeElement,
        event
      });
    }

  }

  @HostListener('window:mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    if (this.canvasService.isDraggingWidget()) {
      this.canvasService.widgetDragEnd({
        widget: this.widget(),
        el: this.elRef.nativeElement,
        event
      });
      return;
    }
    if (this.canvasService.isResizingWidget()) {
      // console.log("XXXXXX resize end");
      this.canvasService.widgetResizeEnd({
        widget: this.widget(),
        el: this.elRef.nativeElement,
        event
      });
      return;
    }
  }

  private addResizer({
                       position
                     }: {
    position: ResizePosition;
  }) {

    const resizerSize = CanvasWidgetDirective.BASE_RESIZER_SIZE;
    const edgeHandleSize = CanvasWidgetDirective.EDGE_HANDLE_MULTIPLIER * resizerSize;
    const cornerHandleSize = CanvasWidgetDirective.CORNER_HANDLE_MULTIPLIER * resizerSize;
    const edgeOffset = -Math.floor(resizerSize / 4);
    const cornerOffset = -Math.floor(resizerSize / 2);
    const resizer = this.renderer.createElement('div');


    this.renderer.setStyle(resizer, "position", "absolute");
    this.renderer.addClass(resizer, `${this.canvasService.WIDGET_RESIZER_CLASS}`);
    this.renderer.addClass(resizer, `${this.canvasService.WIDGET_RESIZER_CLASS}-${position}`);

    switch (position) {
      case "top":
      case "bottom":
        this.renderer.setStyle(resizer, "width", `${edgeHandleSize}px`);
        this.renderer.setStyle(resizer, "height", `${resizerSize}px`);
        this.renderer.setStyle(resizer, position, `${edgeOffset}px`);
        this.renderer.setStyle(resizer, "transform", `translate(-50%, 0%)`);
        this.renderer.setStyle(resizer, "left", "50%");
        this.renderer.setStyle(resizer, "cursor", "ns-resize");
        break;
      case "right":
      case "left":
        this.renderer.setStyle(resizer, "height", `${edgeHandleSize}px`);
        this.renderer.setStyle(resizer, "width", `${resizerSize}px`);
        this.renderer.setStyle(resizer, position, `${edgeOffset}px`);
        this.renderer.setStyle(resizer, "transform", `translate(0%, -50%)`);
        this.renderer.setStyle(resizer, "top", "50%");
        this.renderer.setStyle(resizer, "cursor", "ew-resize");
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
        this.renderer.setStyle(
          resizer,
          'cursor',
          position === 'top-left' || position === 'bottom-right' ? 'nwse-resize' : 'nesw-resize'
        );
        break;
    }

    this.renderer.listen(resizer, 'mousedown', (event: MouseEvent) => {
      this.canvasService.widgetResizeStart({
        widget: this.widget(),
        el: this.elRef.nativeElement,
        event,
        position
      })
    })

    // Append the new element to the host element
    this.renderer.appendChild(this.elRef.nativeElement, resizer);
  }

}
