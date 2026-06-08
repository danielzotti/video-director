import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TimelineWidget } from '../../../models/timeline.models';
import { TimelineService } from '../../../services/timeline.service';
import { TimelineTimeMarkersComponent } from '../timeline-time-marker/timeline-time-markers.component';
import { TimelineTimeLabelsComponent } from '../timeline-time-labels/timeline-time-labels.component';
import { TimelineTrackLayerComponent } from '../timeline-track-layer/timeline-track-layer.component';

@Component({
  selector: 'app-timeline-track',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimelineTimeMarkersComponent, TimelineTimeLabelsComponent, TimelineTrackLayerComponent],
  templateUrl: './timeline-track.component.html',
  styleUrl: './timeline-track.component.scss',
})
export class TimelineTrackComponent implements AfterViewInit, OnDestroy {
  private readonly timelineService = inject(TimelineService);

  /** Synchronized scroll offset passed from the panel. */
  readonly scrollTop = input(0);

  readonly scrolled = output<number>();
  readonly layerClicked = output<string>();

  private readonly cursorRef = viewChild<ElementRef<HTMLDivElement>>('cursor');
  private readonly cursorTimeRef = viewChild<ElementRef<HTMLDivElement>>('cursorTime');
  private readonly layersContainerRef = viewChild<ElementRef<HTMLDivElement>>('layersContainer');
  private readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('container');

  readonly layers = this.timelineService.layers;
  readonly zoom = this.timelineService.zoom;
  readonly duration = this.timelineService.duration;
  readonly time = this.timelineService.time;

  private resizeObserver: ResizeObserver | null = null;
  private readonly viewportWidthPx = signal(1);

  readonly minStepMs = 100;

  hasCursorAnimation = true;
  timelineCursorHeight = '30px';

  /** Cursor moves immediately when time signal changes. */
  constructor() {
    effect(() => {
      const t = this.time();
      this.updateCursorPosition(t);
      this.updateTimelineCursorHeight();
    });

    // Sync container scroll when parent updates scrollTop
    effect(() => {
      const top = this.scrollTop();
      const el = this.containerRef()?.nativeElement;
      if (el && el.scrollTop !== top) {
        el.scrollTop = top;
      }
    });
  }

  get printEveryMs(): number {
    // Dynamic label spacing reacts to duration, zoom and viewport width.
    const minLabelSpacingPx = 40;
    const duration = Math.max(1, this.duration());
    const viewport = Math.max(1, this.viewportWidthPx());
    const zoom = Math.max(1, this.zoom());

    // ms/px at current zoom (zoom=1 => entire timeline fits viewport).
    const msPerPx = duration / (viewport * zoom);
    const labelIntervalMs = Math.ceil(msPerPx * minLabelSpacingPx);

    // Human-friendly intervals.
    const units = [
      100, 200, 500,
      1_000, 2_000, 5_000, 10_000, 15_000, 30_000,
      60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000,
      3_600_000,
    ];

    return units.find((u) => u >= labelIntervalMs) ?? units[units.length - 1];
  }

  get timelineTotalWidthPx(): string {
    return `${this.stepPx * (this.maxMs / this.stepMs)}px`;
  }

  get stepPx(): number {
    // At zoom=1, timeline width matches viewport width. Higher zoom scales from this baseline.
    const duration = this.duration();
    const viewport = Math.max(1, this.viewportWidthPx());
    const baseStepPx = duration > 0 ? (viewport * this.minStepMs) / duration : 1;
    return Math.max(0.1, baseStepPx) * this.zoom();
  }

  get stepMs(): number {
    return this.minStepMs * this.zoom();
  }

  get maxMs(): number {
    return this.duration() * this.zoom();
  }

  ngAfterViewInit(): void {
    this.updateViewportWidth();
    const container = this.containerRef()?.nativeElement;
    if (container) {
      this.resizeObserver = new ResizeObserver(() => this.updateViewportWidth());
      this.resizeObserver.observe(container);
    }

    this.updateCursorPosition(this.time());
    this.updateTimelineCursorHeight();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  syncTimelineScroll(event: Event): void {
    this.scrolled.emit((event.target as HTMLElement).scrollTop);
  }

  onSliderChange(event: Event): void {
    const raw = +(event.target as HTMLInputElement).value;
    const t = raw / this.zoom();
    this.hasCursorAnimation = false;
    this.timelineService.setTime(t);
    // Re-enable transition after the immediate paint
    requestAnimationFrame(() => { this.hasCursorAnimation = true; });
  }

  onSliderMouseDown(): void {
    this.hasCursorAnimation = false;
    if (this.timelineService.isPlaying()) {
      this.timelineService.pause();
    }
  }

  onSliderMouseUp(): void {
    this.hasCursorAnimation = true;
  }

  onLayerClicked(layer: TimelineWidget): void {
    this.layerClicked.emit(layer.uuid);
  }

  onLayerChanged(layer: TimelineWidget): void {
    this.timelineService.updateLayerTiming(layer.uuid, layer.timelineStart, layer.timelineEnd);
  }

  trackLayers(_i: number, item: TimelineWidget): string {
    return item.uuid;
  }

  private updateCursorPosition(time: number): void {
    const cursor = this.cursorRef()?.nativeElement;
    const cursorTime = this.cursorTimeRef()?.nativeElement;
    if (!cursor || !cursorTime) return;
    const pct = this.duration() > 0 ? (time / this.duration()) * 100 : 0;
    cursor.style.left = `${pct}%`;
    cursorTime.style.left = `${pct}%`;
  }

  private updateTimelineCursorHeight(): void {
    const container = this.layersContainerRef()?.nativeElement;
    this.timelineCursorHeight = container?.offsetHeight
      ? `${container.offsetHeight}px`
      : '30px';
  }

  private updateViewportWidth(): void {
    const width = this.containerRef()?.nativeElement.clientWidth ?? 1;
    this.viewportWidthPx.set(Math.max(1, width));
  }
}
