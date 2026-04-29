import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  inject,
  input,
  OnInit,
  Renderer2
} from '@angular/core';
import {CanvasService} from '../services/canvas.service';
import {MathService} from '../services/math.service';

@Directive({
  selector: '[appCanvas]',
  standalone: true,
})
export class CanvasDirective implements OnInit {
  canvasService = inject(CanvasService);
  mathService = inject(MathService);
  private readonly canvasElementRef = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  @HostBinding('class')
  elementClass = 'app-canvas';

  canvasWrapper = input<HTMLElement | null>(null);

  ngOnInit(): void {
    const w = 1280;
    const h = 720;
    const snapSize = this.mathService.divisorsInCommon(w, h).at(3) ?? 1;

    this.canvasService.init({
      canvas: this.canvasElementRef.nativeElement,
      canvasWrapper: this.canvasWrapper() ?? undefined,
      allowSnapToGrid: true,
      snapSize,
      width: w,
      height: h,
      zoom: 1,
    });

    this.renderer.setStyle(this.canvasElementRef.nativeElement, 'transformOrigin', 'top left');
  }

  @HostBinding('style')
  get style() {
    return {
      top: `${this.canvasService.top()}px`,
      left: `${this.canvasService.left()}px`,
      transform: `scale(${this.canvasService.zoom()})`,
      position: 'relative',
    };
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.code === 'Space') {
      this.canvasService.setSpacePressed(true);
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    if (event.code === 'Space') {
      this.canvasService.setSpacePressed(false);
    }
  }

  @HostListener('window:mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    if (!this.canvasWrapper()) {
      return;
    }

    if (event.target === this.canvasWrapper() || this.canvasWrapper()?.contains(event.target as HTMLElement)) {
      this.canvasService.canvasDragStart({
        el: this.canvasElementRef.nativeElement,
        event
      });
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.canvasWrapper()) {
      return;
    }

    this.canvasService.canvasDrag({
      el: this.canvasElementRef.nativeElement,
      event
    });
  }

  @HostListener('window:mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    if (!this.canvasWrapper()) {
      return;
    }

    this.canvasService.canvasDragEnd({
      el: this.canvasElementRef.nativeElement,
      event
    });
  }

  @HostListener('window:wheel', ['$event'])
  onMouseWheel(event: WheelEvent) {
    if (!this.canvasWrapper()) {
      return;
    }

    if (event.target === this.canvasWrapper() || this.canvasWrapper()?.contains(event.target as HTMLElement)) {
      event.preventDefault();
      event.stopPropagation();

      const value = Math.round(Math.abs(event.deltaY) * 100) / 10_000;
      const focalPoint = {x: event.clientX, y: event.clientY};

      if (event.deltaY > 0) {
        this.canvasService.canvasZoomOut(value, focalPoint);
      }
      if (event.deltaY < 0) {
        this.canvasService.canvasZoomIn(value, focalPoint);
      }
    }
  }
}
