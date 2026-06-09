import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
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
  private readonly horizontalVirtualBufferPx = 300;
  private readonly layerRowHeightPx = 40;
  private readonly layerVirtualOverscanRows = 5;

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
  private readonly viewportHeightPx = signal(1);
  private readonly scrollLeftPx = signal(0);

  /** Direction of the active edge-scroll RAF loop: -1=left, 0=none, 1=right. */
  private edgeScrollDirection: -1 | 0 | 1 = 0;
  private edgeScrollRafId: number | null = null;
  private readonly edgeScrollSpeedPx = 8;
  private edgeScrollSpeedMultiplier = 1;

  /** True only while the user holds the mouse button down on the timeline scrubber. */
  private isSliderDragging = false;

  readonly minStepMs = 100;

  hasCursorAnimation = true;
  timelineCursorHeight = '30px';

  readonly visibleStartMs = computed(() => this.visibleRangeMs().startMs);
  readonly visibleEndMs = computed(() => this.visibleRangeMs().endMs);
  readonly visibleLayers = computed(() => {
    const all = this.layers();
    const range = this.visibleLayerRange();
    return all.slice(range.startIndex, range.endExclusiveIndex);
  });
  readonly topSpacerHeightPx = computed(() => this.visibleLayerRange().startIndex * this.layerRowHeightPx);
  readonly bottomSpacerHeightPx = computed(() => {
    const all = this.layers();
    const range = this.visibleLayerRange();
    const hiddenAfter = Math.max(0, all.length - range.endExclusiveIndex);
    return hiddenAfter * this.layerRowHeightPx;
  });

  constructor() {
    // Update cursor position and height whenever time changes
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

    // Center scrollbar on cursor when zoom changes (untracked to avoid reacting to time/duration)
    effect(() => {
      this.zoom();
      untracked(() => this.centerCursorInViewport());
    });

    // Update maxZoom whenever viewport width or duration changes
    effect(() => {
      const viewportWidth = this.viewportWidthPx();
      this.duration();
      this.timelineService.setMaxZoom(viewportWidth);
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

    return units.find((u) => u >= labelIntervalMs) ?? (units.at(-1) ?? 3_600_000);
  }

  get timelineTotalWidthPx(): string {
    return `${this.timelineTotalWidthRawPx()}px`;
  }

  get stepPx(): number {
    // At zoom=1, timeline width matches viewport width. Higher zoom scales from this baseline.
    const duration = this.duration();
    const viewport = Math.max(1, this.viewportWidthPx());
    const baseStepPx = duration > 0 ? (viewport * this.minStepMs) / duration : 1;
    return Math.max(0.1, baseStepPx) * this.zoom();
  }

  get stepMs(): number {
    return this.minStepMs;
  }

  get maxMs(): number {
    return this.duration();
  }

  private readonly visibleRangeMs = computed(() => {
    const duration = Math.max(1, this.duration());
    const totalWidthPx = Math.max(1, this.timelineTotalWidthRawPx());
    const viewportWidthPx = Math.max(1, this.viewportWidthPx());
    const bufferPx = this.horizontalVirtualBufferPx;
    const startPx = Math.max(0, this.scrollLeftPx() - bufferPx);
    const endPx = Math.min(totalWidthPx, this.scrollLeftPx() + viewportWidthPx + bufferPx);
    const msPerPx = duration / totalWidthPx;

    return {
      startMs: Math.max(0, Math.floor(startPx * msPerPx)),
      endMs: Math.min(duration, Math.ceil(endPx * msPerPx)),
    };
  });

  private readonly visibleLayerRange = computed(() => {
    const total = this.layers().length;
    const rowHeight = this.layerRowHeightPx;
    const overscan = this.layerVirtualOverscanRows;
    const scrollTop = this.scrollTop();
    const viewportHeight = Math.max(1, this.viewportHeightPx());

    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleRows = Math.ceil(viewportHeight / rowHeight);
    const endExclusiveIndex = Math.min(total, startIndex + visibleRows + overscan * 2);

    return { startIndex, endExclusiveIndex };
  });

  ngAfterViewInit(): void {
    this.updateViewportWidth();
    const container = this.containerRef()?.nativeElement;
    if (container) {
      this.scrollLeftPx.set(container.scrollLeft);
      this.resizeObserver = new ResizeObserver(() => this.updateViewportWidth());
      this.resizeObserver.observe(container);
    }

    this.updateCursorPosition(this.time());
    this.updateTimelineCursorHeight();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.stopEdgeScroll();
  }

  syncTimelineScroll(event: Event): void {
    const target = event.target as HTMLElement;
    this.scrolled.emit(target.scrollTop);
    this.scrollLeftPx.set(target.scrollLeft);
  }

  onSliderChange(event: Event): void {
    const t = +(event.target as HTMLInputElement).value;
    this.hasCursorAnimation = false;
    this.timelineService.setTime(t);
    // Re-enable transition after the immediate paint
    requestAnimationFrame(() => { this.hasCursorAnimation = true; });
  }

  onSliderMouseDown(): void {
    this.isSliderDragging = true;
    this.hasCursorAnimation = false;
    if (this.timelineService.isPlaying()) {
      this.timelineService.pause();
    }
  }

  onSliderMouseUp(): void {
    this.isSliderDragging = false;
    this.hasCursorAnimation = true;
    this.stopEdgeScroll();
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
       const container = this.containerRef()?.nativeElement;
       const width = container?.clientWidth ?? 1;
       const height = container?.clientHeight ?? 1;
       this.viewportWidthPx.set(Math.max(1, width));
       this.viewportHeightPx.set(Math.max(1, height));
   }

  /** Centers the scroll so the playhead cursor is in the middle of the viewport. Used on zoom change. */
  private centerCursorInViewport(): void {
    const container = this.containerRef()?.nativeElement;
    if (!container) return;

    const duration = this.duration();
    const cursorPct = duration > 0 ? (this.time() / duration) * 100 : 0;
    const timelineWidthPx = this.timelineTotalWidthRawPx();
    const cursorPx = (timelineWidthPx * cursorPct) / 100;
    const viewportWidth = container.clientWidth;
    const nextScrollLeft = Math.max(0, cursorPx - viewportWidth / 2);
    container.scrollLeft = nextScrollLeft;
    this.scrollLeftPx.set(nextScrollLeft);
  }

  /**
   * Called by (pointermove) on the container.
   * Starts a continuous RAF scroll when the mouse enters the 0–5% or 95–100% edge zones.
   * In the outer 0–2% and 98–100% zones, speed is 10x.
   * Stops scroll when mouse is in the central 5%–95% area.
   */
  onContainerPointerMove(event: PointerEvent): void {
    const container = this.containerRef()?.nativeElement;
    if (!container || !this.isSliderDragging) {
      this.stopEdgeScroll();
      return;
    }

    const rect = container.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const viewportWidth = rect.width;
    const edgeThreshold = viewportWidth * 0.05;
    const turboEdgeThreshold = viewportWidth * 0.02;

    if (relativeX < edgeThreshold) {
      this.edgeScrollSpeedMultiplier = relativeX < turboEdgeThreshold ? 10 : 1;
      this.startEdgeScroll(-1);
    } else if (relativeX > viewportWidth - edgeThreshold) {
      this.edgeScrollSpeedMultiplier = relativeX > viewportWidth - turboEdgeThreshold ? 10 : 1;
      this.startEdgeScroll(1);
    } else {
      this.stopEdgeScroll();
    }
  }

  /** Called by (pointerleave) on the container – cancels any active edge scroll. */
  onContainerPointerLeave(): void {
    this.stopEdgeScroll();
  }

  private startEdgeScroll(direction: -1 | 1): void {
    if (this.edgeScrollDirection === direction) return; // already running in this direction
    this.edgeScrollDirection = direction;
    if (this.edgeScrollRafId === null) {
      this.runEdgeScroll();
    }
  }

  private stopEdgeScroll(): void {
    this.edgeScrollDirection = 0;
    this.edgeScrollSpeedMultiplier = 1;
    if (this.edgeScrollRafId !== null) {
      cancelAnimationFrame(this.edgeScrollRafId);
      this.edgeScrollRafId = null;
    }
  }

  /** RAF loop: scrolls by edgeScrollSpeedPx each frame while mouse stays in an edge zone. */
  private runEdgeScroll(): void {
    const container = this.containerRef()?.nativeElement;
    if (!container || this.edgeScrollDirection === 0) {
      this.edgeScrollRafId = null;
      return;
    }

    const timelineWidthPx = this.timelineTotalWidthRawPx();
    const maxScroll = Math.max(0, timelineWidthPx - container.clientWidth);
    const next =
      container.scrollLeft +
      this.edgeScrollDirection * this.edgeScrollSpeedPx * this.edgeScrollSpeedMultiplier;
    const nextScrollLeft = Math.max(0, Math.min(maxScroll, next));
    container.scrollLeft = nextScrollLeft;
    this.scrollLeftPx.set(nextScrollLeft);

    this.edgeScrollRafId = requestAnimationFrame(() => this.runEdgeScroll());
  }

  private timelineTotalWidthRawPx(): number {
    const totalSteps = Math.max(1, this.maxMs / this.stepMs);
    return Math.max(1, this.stepPx * totalSteps);
  }
}
