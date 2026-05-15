import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TimelineWidget } from '../../../../models/timeline.models';

@Component({
  selector: 'app-timeline-layer-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-layer-item.component.html',
  styleUrl: './timeline-layer-item.component.scss',
})
export class TimelineLayerItemComponent {
  readonly layer = input.required<TimelineWidget>();
  readonly isMainVideo = input(false);
  readonly isChild = input(false);
  readonly isLastChild = input(false);

  readonly layerIsVisibleChanged = output<TimelineWidget>();
  readonly layerIsLockedChanged = output<TimelineWidget>();
  readonly layerClicked = output<string>();
  readonly layerMultiClicked = output<string>();

  onLayerLabelClick(event: MouseEvent): void {
    if (event.shiftKey) {
      this.layerMultiClicked.emit(this.layer().uuid);
    } else {
      this.layerClicked.emit(this.layer().uuid);
    }
  }

  onLayerIsVisibleClick(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.layerIsVisibleChanged.emit({ ...this.layer(), visible: checked });
  }

  onLayerIsLockedClick(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.layerIsLockedChanged.emit({ ...this.layer(), locked: checked });
  }
}

