import {AfterViewInit, Directive, ElementRef, HostBinding, HostListener, inject, input, Renderer2} from '@angular/core';
import {WidgetStateItem} from '../models/canvas-widget-state.models';

import {CanvasService, ResizePosition} from "../services/canvas.service";

@Directive({
  selector: '[appCanvasWidget]',
  standalone: true
})
export class CanvasWidgetDirective implements AfterViewInit {

  private readonly renderer = inject(Renderer2);
  private readonly elRef = inject(ElementRef<HTMLElement>);

  canvasService = inject(CanvasService);

  // INPUTS
  widget = input.required<WidgetStateItem>({alias: 'appCanvasWidget'});

  ngAfterViewInit() {
    this.addResizer({position: 'left'});
    this.addResizer({position: 'right'});
    this.addResizer({position: 'top'});
    this.addResizer({position: 'bottom'});
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

    const resizerSize = 5; // TODO: should be customizable
    const resizer = this.renderer.createElement('div');

    // TODO: remove this section
    this.renderer.setStyle(resizer, "background-color", "red");
    // const text = this.renderer.createText(position);
    // this.renderer.appendChild(resizer, text);

    this.renderer.setStyle(resizer, "position", "absolute");
    this.renderer.addClass(resizer, `${this.canvasService.WIDGET_RESIZER_CLASS}`);
    this.renderer.addClass(resizer, `${this.canvasService.WIDGET_RESIZER_CLASS}-${position}`);

    switch (position) {
      case "top":
      case "bottom":
        this.renderer.setStyle(resizer, "width", `${10 * resizerSize}px`);
        this.renderer.setStyle(resizer, "height", `${resizerSize}px`);
        this.renderer.setStyle(resizer, position, `-${Math.floor(resizerSize / 4)}px`);
        this.renderer.setStyle(resizer, "transform", `translate(-50%, 0%)`);
        this.renderer.setStyle(resizer, "left", "50%");
        this.renderer.setStyle(resizer, "cursor", "ns-resize");
        break;
      case "right":
      case "left":
        this.renderer.setStyle(resizer, "height", `${10 * resizerSize}px`);
        this.renderer.setStyle(resizer, "width", `${resizerSize}px`);
        this.renderer.setStyle(resizer, position, `-${Math.floor(resizerSize / 4)}px`);
        this.renderer.setStyle(resizer, "transform", `translate(0%, -50%)`);
        this.renderer.setStyle(resizer, "top", "50%");
        this.renderer.setStyle(resizer, "cursor", "ew-resize");
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
