import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TimelineWidget } from '../../../../models/timeline.models';
import { CanvasWidgetStateService } from '../../../../services/canvas-widget-state.service';
import { CanvasService } from '../../../../services/canvas.service';
import { UiIconComponent } from '../../../../ui';
import type { UiIconName } from '../../../../ui';

@Component({
  selector: 'app-timeline-layer-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiIconComponent],
  templateUrl: './timeline-layer-item.component.html',
  styleUrl: './timeline-layer-item.component.scss',
})
export class TimelineLayerItemComponent {
  private readonly widgetsState = inject(CanvasWidgetStateService);
  private readonly canvasService = inject(CanvasService);

  readonly layer = input.required<TimelineWidget>();
  readonly isMainVideo = input(false);
  readonly isChild = input(false);
  readonly isLastChild = input(false);

  readonly layerIsVisibleChanged = output<TimelineWidget>();
  readonly layerIsLockedChanged = output<TimelineWidget>();
  readonly layerClicked = output<string>();
  readonly layerMultiClicked = output<string>();

  readonly isSelected = computed(() => this.canvasService.selectedWidgetId() === this.layer().uuid);

  getLayerDisplayName(): string {
    const widget = this.widgetsState.getById(this.layer().uuid);
    if (!widget) {
      return `Layer ${this.layer().uuid}`;
    }

    return widget.name || widget.content?.type || `Layer ${widget.uuid}`;
  }

  getLayerContentIcon(): UiIconName {
    const widget = this.widgetsState.getById(this.layer().uuid);
    if (!widget) {
      return 'info';
    }

    if (widget.content.type === 'text') {
      return 'text';
    }

    if (widget.content.type === 'image') {
      return 'image';
    }

    return 'video';
  }

  isLayerVisible(): boolean {
    return this.widgetsState.getById(this.layer().uuid)?.visible ?? true;
  }

  isLayerLocked(): boolean {
    return !!this.widgetsState.getById(this.layer().uuid)?.locked;
  }

  onLayerClick(event: MouseEvent): void {
    if (event.shiftKey) {
      this.layerMultiClicked.emit(this.layer().uuid);
    } else {
      this.layerClicked.emit(this.layer().uuid);
    }
  }

  onLayerIsVisibleClick(event: MouseEvent): void {
    event.stopPropagation();
    this.layerIsVisibleChanged.emit({ ...this.layer(), visible: !this.isLayerVisible() });
  }

  onLayerIsLockedClick(event: MouseEvent): void {
    event.stopPropagation();
    this.layerIsLockedChanged.emit({ ...this.layer(), locked: !this.isLayerLocked() });
  }
}

