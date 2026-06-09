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
import { LayerTiming, getSnapGuidePx, snapEdgePx, snapMovePx, TimelineSnapConfig } from '../../../utils/timeline-snap.utils';

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
  readonly snapToSeconds = input(false);
  readonly snapToLayers = input(false);
  readonly allLayerTimings = input<LayerTiming[]>([]);

  private readonly snapThresholdPx = 8;

  readonly layerChanged = output<TimelineWidget>();
  readonly dragActiveChanged = output<boolean>();
  /** Emits px positions of active snap guides during drag; empty array when drag ends. */
  readonly snapGuidesChanged = output<number[]>();

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
    const rawLeft = this.dragState.startLeft + dx;
    const config = this.buildSnapConfig();
    const snappedLeft = snapMovePx(rawLeft, this.width, config);
    const result = this.clampStyle({ left: snappedLeft, width: this.width, action: 'move' });
    this.setStyle(result);
    this.snapGuidesChanged.emit(this.computeSnapGuides(rawLeft, this.width, config));
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
    const rawLeft = this.dragState.startLeft + dx;
    // Right edge is fixed during left-resize
    const fixedRight = this.dragState.startLeft + this.dragState.startWidth;
    const config = this.buildSnapConfig();
    const snappedLeft = snapEdgePx(rawLeft, config);
    const result = this.clampStyle({ left: snappedLeft, width: fixedRight - snappedLeft, action: 'resize' });
    this.setStyle(result);
    this.snapGuidesChanged.emit(this.computeSnapGuides(rawLeft, 0, config));
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
    const rawRight = this.dragState.startLeft + this.dragState.startWidth + dx;
    // Left edge is fixed during right-resize
    const config = this.buildSnapConfig();
    const snappedRight = snapEdgePx(rawRight, config);
    const result = this.clampStyle({ left: this.left, width: snappedRight - this.left, action: 'resize' });
    this.setStyle(result);
    this.snapGuidesChanged.emit(this.computeSnapGuides(rawRight, 0, config));
    this.layerChangedSubject.next();
  }

  onResizeRightPointerUp(event: PointerEvent): void {
    event.preventDefault();
    this.clearDrag();
  }

  // ---- Private helpers -------------------------------------------

  private buildSnapConfig(): TimelineSnapConfig {
    return {
      snapToSeconds: this.snapToSeconds(),
      snapToLayers: this.snapToLayers(),
      excludeUuid: this.layer().uuid,
      layerTimings: this.allLayerTimings(),
      thresholdPx: this.snapThresholdPx,
      stepPx: this.stepPx(),
      stepMs: this.step(),
    };
  }

  /**
   * Returns the pixel positions of active snap guides for the given edge(s).
   * Pass widthPx > 0 for move (tests both edges), 0 for single-edge resize.
   */
  private computeSnapGuides(edgePx: number, widthPx: number, config: TimelineSnapConfig): number[] {
    const guides: number[] = [];
    const leftGuide = getSnapGuidePx(edgePx, config);
    if (leftGuide !== null) guides.push(leftGuide);
    if (widthPx > 0) {
      const rightGuide = getSnapGuidePx(edgePx + widthPx, config);
      if (rightGuide !== null && rightGuide !== leftGuide) guides.push(rightGuide);
    }
    return guides;
  }

  private clearDrag(): void {
    if (this.currentAction !== null) {
      this.dragActiveChanged.emit(false);
      this.snapGuidesChanged.emit([]);
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
    const raw = (px * this.step()) / this.stepPx();
    // Always round to the nearest 100ms (tenth-of-second is the minimum precision).
    return Math.round(raw / 100) * 100;
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
