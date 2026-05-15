import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnChanges,
  output,
  SimpleChanges,
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
export class TimelineTrackComponent implements AfterViewInit, OnChanges {
  private readonly timelineService = inject(TimelineService);

  /** Synchronized scroll offset passed from the panel. */
  readonly scrollTop = input(0);

  readonly scrolled = output<number>();
  readonly layerClicked = output<string>();

  private readonly sliderRef = viewChild<ElementRef<HTMLInputElement>>('slider');
  private readonly cursorRef = viewChild<ElementRef<HTMLDivElement>>('cursor');
  private readonly cursorTimeRef = viewChild<ElementRef<HTMLDivElement>>('cursorTime');
  private readonly layersContainerRef = viewChild<ElementRef<HTMLDivElement>>('layersContainer');
  private readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('container');

  readonly layers = this.timelineService.layers;
  readonly zoom = this.timelineService.zoom;
  readonly duration = this.timelineService.duration;
  readonly time = this.timelineService.time;

  readonly minStepMs = 100;
  readonly minStepPx = 5;

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
    return this.zoom() > 9 ? 100 : this.zoom() > 6 ? 200 : this.zoom() > 3 ? 500 : 1000;
  }

  get timelineTotalWidthPx(): string {
    return `${this.stepPx * (this.maxMs / this.stepMs)}px`;
  }

  get stepPx(): number {
    return this.minStepPx * this.zoom();
  }

  get stepMs(): number {
    return this.minStepMs * this.zoom();
  }

  get maxMs(): number {
    return this.duration() * this.zoom();
  }

  ngAfterViewInit(): void {
    this.updateCursorPosition(this.time());
    this.updateTimelineCursorHeight();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.updateTimelineCursorHeight();
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

  onSliderMouseDown(_event: Event): void {
    this.hasCursorAnimation = false;
    if (this.timelineService.isPlaying()) {
      this.timelineService.pause();
    }
  }

  onSliderMouseUp(_event: Event): void {
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
}
