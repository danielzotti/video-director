import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  inject,
  OnDestroy,
} from '@angular/core';
import { TimelineService } from '../../../services/timeline.service';
import { CanvasService } from '../../../services/canvas.service';
import { TimelineToolbarComponent } from '../timeline-toolbar/timeline-toolbar.component';
import { TimelineLayersManagerComponent } from '../timeline-layers-manager/timeline-layers-manager.component';
import { TimelineTrackComponent } from '../timeline-track/timeline-track.component';
import { TimelineWidget } from '../../../models/timeline.models';

@Component({
  selector: 'app-timeline-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimelineToolbarComponent, TimelineLayersManagerComponent, TimelineTrackComponent],
  host: {
    '[style.height.px]': 'panelVisualHeight()',
  },
  templateUrl: './timeline-panel.component.html',
  styleUrl: './timeline-panel.component.scss',
})
export class TimelinePanelComponent implements OnDestroy {
  private readonly timelineService = inject(TimelineService);
  private readonly canvasService = inject(CanvasService);

  private readonly defaultPanelHeight = 350;
  private readonly panelHeaderHeight = 36;
  private readonly maxPanelViewportRatio = 0.6;

  private resizePointerId: number | null = null;
  private resizeStartY = 0;
  private resizeStartHeight = 0;

  readonly layers = this.timelineService.layers;
  readonly panelHeight = signal(this.defaultPanelHeight);
  readonly layersManagerScrollTop = signal(0);
  readonly trackScrollTop = signal(0);

  readonly duration = this.timelineService.duration;
  readonly zoom = this.timelineService.zoom;
  readonly isPlaying = this.timelineService.isPlaying;
  readonly time = this.timelineService.time;
  readonly isOpened = computed(() => this.panelHeight() > 0);
  readonly panelVisualHeight = computed(() => Math.max(this.panelHeight(), this.panelHeaderHeight));

  readonly anyLayerSelected = computed(() => false); // TODO: integrate with CanvasService selection

  ngOnDestroy(): void {
    this.detachResizeListeners();
  }

  onTogglePanel(): void {
    this.panelHeight.update((height) => (height > 0 ? 0 : this.defaultPanelHeight));
  }

  onResizeHandlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.resizePointerId = event.pointerId;
    this.resizeStartY = event.clientY;
    this.resizeStartHeight = this.panelHeight();

    window.addEventListener('pointermove', this.onResizePointerMove, { passive: false });
    window.addEventListener('pointerup', this.onResizePointerUp);
    window.addEventListener('pointercancel', this.onResizePointerUp);
  }

  onLayersManagerScrolled(scrollTop: number): void {
    this.layersManagerScrollTop.set(scrollTop);
    this.trackScrollTop.set(scrollTop);
  }

  onTrackScrolled(scrollTop: number): void {
    this.trackScrollTop.set(scrollTop);
    this.layersManagerScrollTop.set(scrollTop);
  }

  onLayerClicked(uuid: string): void {
    this.canvasService.selectWidget(uuid);
  }

  onLayerIsVisibleChanged(layer: TimelineWidget): void {
    this.canvasService.setWidgetVisible(layer.uuid, layer.visible ?? true);
  }

  onLayerIsLockedChanged(layer: TimelineWidget): void {
    this.canvasService.setWidgetLocked(layer.uuid, !!layer.locked);
  }

  private readonly onResizePointerMove = (event: PointerEvent): void => {
    if (this.resizePointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const deltaY = this.resizeStartY - event.clientY;
    const requestedHeight = this.resizeStartHeight + deltaY;
    this.panelHeight.set(this.clampHeight(requestedHeight));
  };

  private readonly onResizePointerUp = (event: PointerEvent): void => {
    if (this.resizePointerId !== event.pointerId) {
      return;
    }

    this.detachResizeListeners();
    this.resizePointerId = null;
  };

  private detachResizeListeners(): void {
    window.removeEventListener('pointermove', this.onResizePointerMove);
    window.removeEventListener('pointerup', this.onResizePointerUp);
    window.removeEventListener('pointercancel', this.onResizePointerUp);
  }

  private clampHeight(height: number): number {
    const maxHeight = Math.floor(window.innerHeight * this.maxPanelViewportRatio);
    return Math.max(0, Math.min(Math.round(height), maxHeight));
  }
}
