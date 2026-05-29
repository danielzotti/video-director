import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  inject,
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
  templateUrl: './timeline-panel.component.html',
  styleUrl: './timeline-panel.component.scss',
})
export class TimelinePanelComponent {
  private readonly timelineService = inject(TimelineService);
  private readonly canvasService = inject(CanvasService);

  readonly layers = this.timelineService.layers;
  readonly isOpened = signal(true);
  readonly layersManagerScrollTop = signal(0);
  readonly trackScrollTop = signal(0);

  readonly duration = this.timelineService.duration;
  readonly zoom = this.timelineService.zoom;
  readonly isPlaying = this.timelineService.isPlaying;
  readonly time = this.timelineService.time;

  readonly anyLayerSelected = computed(() => false); // TODO: integrate with CanvasService selection

  onTogglePanel(opened: boolean): void {
    this.isOpened.set(opened);
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
}
