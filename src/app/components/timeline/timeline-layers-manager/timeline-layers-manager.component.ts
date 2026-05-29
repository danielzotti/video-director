import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TimelineWidget } from '../../../models/timeline.models';
import { TimelineService } from '../../../services/timeline.service';
import { UiIconComponent } from '../../../ui';
import { TimelineLayerItemComponent } from './timeline-layer-item/timeline-layer-item.component';

@Component({
  selector: 'app-timeline-layers-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimelineLayerItemComponent, UiIconComponent],
  templateUrl: './timeline-layers-manager.component.html',
  styleUrl: './timeline-layers-manager.component.scss',
})
export class TimelineLayersManagerComponent {
  private readonly timelineService = inject(TimelineService);

  readonly layers = input.required<TimelineWidget[]>();
  readonly mainVideoId = input<string | null>(null);
  readonly scrollTop = input(0);

  readonly scrolled = output<number>();
  readonly layerClicked = output<string>();
  readonly layerIsVisibleChanged = output<TimelineWidget>();
  readonly layerIsLockedChanged = output<TimelineWidget>();

  private readonly containerRef = viewChild<ElementRef<HTMLDivElement>>('container');

  draggedUuid: string | null = null;
  private dragOverIndex: number | null = null;

  constructor() {
    effect(() => {
      const top = this.scrollTop();
      const el = this.containerRef()?.nativeElement;
      if (el && el.scrollTop !== top) {
        el.scrollTop = top;
      }
    });
  }

  syncTimelineScroll(event: Event): void {
    this.scrolled.emit((event.target as HTMLElement).scrollTop);
  }

  trackLayers(_i: number, item: TimelineWidget): string {
    return item.uuid;
  }

  // ---- Drag & Drop (HTML5 API) ----
  onLayerDragStart(event: DragEvent, layer: TimelineWidget): void {
    this.draggedUuid = layer.uuid;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', layer.uuid);
    }
  }

  onLayerDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onLayerDrop(event: DragEvent, displayTargetIndex: number): void {
    event.preventDefault();
    if (!this.draggedUuid) return;

    const layers = this.layers();
    const displaySourceIndex = layers.findIndex(l => l.uuid === this.draggedUuid);
    if (displaySourceIndex === -1 || displaySourceIndex === displayTargetIndex) return;

    // layers() is sorted descending by z (display order).
    // reorderLayerToIndex() works on the ascending-z list inside the service.
    // Convert display index → ascending index: ascIdx = (n - 1) - displayIdx
    const n = layers.length;
    const ascendingTargetIndex = (n - 1) - displayTargetIndex;

    this.timelineService.reorderLayers(this.draggedUuid, ascendingTargetIndex);
    this.draggedUuid = null;
  }

  onLayerDragEnd(): void {
    this.draggedUuid = null;
    this.dragOverIndex = null;
  }

  onLayerIsVisibleChanged(layer: TimelineWidget): void {
    this.layerIsVisibleChanged.emit(layer);
  }

  onLayerIsLockedChanged(layer: TimelineWidget): void {
    this.layerIsLockedChanged.emit(layer);
  }

  onLayerClicked(uuid: string): void {
    this.layerClicked.emit(uuid);
  }

  onLayerMultiClicked(uuid: string): void {
    this.layerClicked.emit(uuid);
  }
}
