import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CanvasService, LayersPanelLayout, SettingsPanelLayout } from '../../services/canvas.service';
import { UiButtonComponent } from '../../ui/button/ui-button.component';
import { UiIconComponent } from '../../ui/icon/ui-icon.component';
import { UiSeparatorComponent } from '../../ui/separator/ui-separator.component';
import { SelectOption, UiSelectComponent } from '../../ui/select/ui-select.component';

@Component({
  selector: 'app-canvas-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, UiButtonComponent, UiIconComponent, UiSeparatorComponent, UiSelectComponent],
  templateUrl: './canvas-toolbar.component.html',
  styleUrl: './canvas-toolbar.component.scss',
})
export class CanvasToolbarComponent {
  protected cs = inject(CanvasService);
  protected readonly settingsPanelLayoutOptions: SelectOption[] = [
    { value: 'floating', label: 'Floating' },
    { value: 'fixed-right', label: 'Fixed right' },
    { value: 'closed', label: 'Closed' },
  ];
  protected readonly layersPanelLayoutOptions: SelectOption[] = [
    { value: 'floating', label: 'Floating' },
    { value: 'fixed-left', label: 'Fixed left' },
    { value: 'closed', label: 'Closed' },
  ];

  protected zoomIn(): void {
    const focalPoint = this.getViewportCenter();
    this.cs.canvasZoomIn(undefined, focalPoint);
  }

  protected zoomOut(): void {
    const focalPoint = this.getViewportCenter();
    this.cs.canvasZoomOut(undefined, focalPoint);
  }

  protected reset(): void {
    this.cs.canvasZoomReset();
  }

  protected center(): void {
    this.cs.canvasCenter();
  }

  protected setSettingsPanelLayout(value: string | number): void {
    if (!this.isSettingsPanelLayout(value)) {
      return;
    }

    this.cs.setSettingsPanelLayout(value);
  }

  protected setLayersPanelLayout(value: string | number): void {
    if (!this.isLayersPanelLayout(value)) {
      return;
    }

    this.cs.setLayersPanelLayout(value);
  }

  private isSettingsPanelLayout(value: string | number): value is SettingsPanelLayout {
    return value === 'floating' || value === 'fixed-right' || value === 'closed';
  }

  private isLayersPanelLayout(value: string | number): value is LayersPanelLayout {
    return value === 'floating' || value === 'fixed-left' || value === 'closed';
  }

  private getViewportCenter() {
    const wrapper = this.cs.canvasWrapperEl;
    if (!wrapper) {
      return undefined;
    }

    const rect = wrapper.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }
}
