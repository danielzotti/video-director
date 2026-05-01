import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CanvasService } from '../../services/canvas.service';
import { UiButtonComponent } from '../../ui/button/ui-button.component';
import { UiIconComponent } from '../../ui/icon/ui-icon.component';
import { UiSeparatorComponent } from '../../ui/separator/ui-separator.component';
import { CanvasSettingsPanelComponent } from '../canvas-settings-panel/canvas-settings-panel.component';

@Component({
  selector: 'app-canvas-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, UiButtonComponent, UiIconComponent, UiSeparatorComponent, CanvasSettingsPanelComponent],
  templateUrl: './canvas-toolbar.component.html',
  styleUrl: './canvas-toolbar.component.scss',
})
export class CanvasToolbarComponent {
  protected cs = inject(CanvasService);
  protected settingsOpen = signal(false);

  protected toggleSettings(): void {
    this.settingsOpen.update(v => !v);
  }

  protected closeSettings(): void {
    this.settingsOpen.set(false);
  }
}
