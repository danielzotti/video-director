import {
  ChangeDetectionStrategy,
  Component,
  input,
  OnChanges,
  OnDestroy,
  OnInit,
  output,
  SimpleChanges,
} from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { TimelineWidget } from '../../../models/timeline.models';

interface LayerStyle {
  left: string;
  width: string;
}

type DragAction = 'move' | 'resize-left' | 'resize-right' | null;

interface DragState {
  startClientX: number;
  startLeft: number;
  startWidth: number;
  startScrollLeft: number;
}

@Component({
  selector: 'app-timeline-track-layer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-track-layer.component.html',
  styleUrl: './timeline-track-layer.component.scss',
})
export class TimelineTrackLayerComponent implements OnInit, OnChanges, OnDestroy {
  readonly layer = input.required<TimelineWidget>();
  readonly isLocked = input(false);
  readonly stepPx = input(5);
  readonly step = input(100);
  readonly zoom = input(1);
  readonly maxMs = input(30_000);

  readonly layerChanged = output<TimelineWidget>();
  readonly dragActiveChanged = output<boolean>();

  left = 0;
  width = 0;
  private maxPx = 0;

  style: LayerStyle = { left: '0px', width: '100%' };

  private dragState: DragState | null = null;
  private currentAction: DragAction = null;

  private readonly layerChangedSubject = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.layerChangedSubject.pipe(
      debounceTime(150),
      takeUntil(this.destroy$),
    ).subscribe(() => this.emitLayerChange());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stepPx'] || changes['zoom'] || changes['layer'] || changes['maxMs'] || changes['step']) {
      this.initStyle();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  // ---- Drag (move) -----------------------------------------------

  onMovePointerDown(event: PointerEvent): void {
    if (this.isLocked() || this.layer().locked) return;
    if ((event.target as HTMLElement).classList.contains('layer__resize-handler')) return;
    this.currentAction = 'move';
    this.dragState = {
      startClientX: event.clientX,
      startLeft: this.left,
      startWidth: this.width,
      startScrollLeft: this.resolveTimelineScrollLeft(event.currentTarget),
    };
    this.dragActiveChanged.emit(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  onMovePointerMove(event: PointerEvent): void {
    if (this.currentAction !== 'move' || !this.dragState) return;
    const dx = this.getScrollAdjustedDx(event, this.dragState);
    const result = this.clampStyle({ left: this.dragState.startLeft + dx, width: this.width, action: 'move' });
    this.setStyle(result);
    this.layerChangedSubject.next();
  }

  onMovePointerUp(event: PointerEvent): void {
    event.preventDefault();
    this.clearDrag();
  }

  // ---- Resize left handle ----------------------------------------

  onResizeLeftPointerDown(event: PointerEvent): void {
    if (this.isLocked() || this.layer().locked) return;
    this.currentAction = 'resize-left';
    this.dragState = {
      startClientX: event.clientX,
      startLeft: this.left,
      startWidth: this.width,
      startScrollLeft: this.resolveTimelineScrollLeft(event.currentTarget),
    };
    this.dragActiveChanged.emit(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  }

  onResizeLeftPointerMove(event: PointerEvent): void {
    if (this.currentAction !== 'resize-left' || !this.dragState) return;
    const dx = this.getScrollAdjustedDx(event, this.dragState);
    const result = this.clampStyle({ left: this.dragState.startLeft + dx, width: this.dragState.startWidth - dx, action: 'resize' });
    this.setStyle(result);
    this.layerChangedSubject.next();
  }

  onResizeLeftPointerUp(event: PointerEvent): void {
    event.preventDefault();
    this.clearDrag();
  }

  // ---- Resize right handle ---------------------------------------

  onResizeRightPointerDown(event: PointerEvent): void {
    if (this.isLocked() || this.layer().locked) return;
    this.currentAction = 'resize-right';
    this.dragState = {
      startClientX: event.clientX,
      startLeft: this.left,
      startWidth: this.width,
      startScrollLeft: this.resolveTimelineScrollLeft(event.currentTarget),
    };
    this.dragActiveChanged.emit(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();
  }

  onResizeRightPointerMove(event: PointerEvent): void {
    if (this.currentAction !== 'resize-right' || !this.dragState) return;
    const dx = this.getScrollAdjustedDx(event, this.dragState);
    const result = this.clampStyle({ left: this.left, width: this.dragState.startWidth + dx, action: 'resize' });
    this.setStyle(result);
    this.layerChangedSubject.next();
  }

  onResizeRightPointerUp(event: PointerEvent): void {
    event.preventDefault();
    this.clearDrag();
  }

  // ---- Private helpers -------------------------------------------

  private clearDrag(): void {
    if (this.currentAction !== null) {
      this.dragActiveChanged.emit(false);
    }
    this.currentAction = null;
    this.dragState = null;
  }

  private getScrollAdjustedDx(event: PointerEvent, dragState: DragState): number {
    const pointerDx = event.clientX - dragState.startClientX;
    const scrollDx = this.resolveTimelineScrollLeft(event.currentTarget) - dragState.startScrollLeft;
    return pointerDx + scrollDx;
  }

  private resolveTimelineScrollLeft(target: EventTarget | null): number {
    if (!(target instanceof HTMLElement)) return 0;
    return target.closest('.timeline')?.scrollLeft ?? 0;
  }

  private initStyle(): void {
    this.maxPx = this.msToPixels(this.maxMs());
    const width = this.msToPixels(this.layer().timelineEnd - this.layer().timelineStart);
    const left = this.msToPixels(this.layer().timelineStart);
    this.setStyle({ left, width });
  }

  private setStyle({ width, left }: { width?: number; left?: number }): void {
    this.left = left ?? this.left;
    this.width = width ?? this.width;
    this.style = { left: `${this.left}px`, width: `${this.width}px` };
  }

  private emitLayerChange(): void {
    const { start, end } = this.pixelsToStartEnd();
    this.layerChanged.emit({ ...this.layer(), timelineStart: start, timelineEnd: end });
  }

  private msToPixels(ms: number): number {
    return Math.round((ms * this.stepPx()) / this.step());
  }

  private pixelsToMs(px: number): number {
    return Math.round((px * this.step()) / this.stepPx());
  }

  private pixelsToStartEnd(): { start: number; end: number } {
    const left = Math.max(0, this.left);
    const right = Math.min(this.left + this.width, this.maxPx);
    return { start: this.pixelsToMs(left), end: this.pixelsToMs(right) };
  }

  private clampStyle({ left, width, action }: { left: number; width: number; action: 'move' | 'resize' }): { left: number; width: number } {
    const minWidth = this.stepPx();
    let newLeft;
    let newWidth;

    if (action === 'move') {
      newLeft = Math.max(0, Math.min(left, this.maxPx - width));
      newWidth = width;
    } else {
      newLeft = Math.max(0, left);
      newWidth = Math.max(minWidth, width);
      if (newLeft + newWidth > this.maxPx) {
        newWidth = this.maxPx - newLeft;
      }
    }

    return { left: newLeft, width: Math.max(minWidth, newWidth) };
  }
}
