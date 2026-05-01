import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CanvasService } from '../../services/canvas.service';
import { UiToggleComponent } from '../../ui/toggle/ui-toggle.component';
import { UiSelectComponent, SelectOption } from '../../ui/select/ui-select.component';
import { UiSeparatorComponent } from '../../ui/separator/ui-separator.component';

@Component({
  selector: 'app-canvas-settings-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, UiToggleComponent, UiSelectComponent, UiSeparatorComponent],
  templateUrl: './canvas-settings-panel.component.html',
  styleUrl: './canvas-settings-panel.component.scss',
})
export class CanvasSettingsPanelComponent {
  isOpen = input<boolean>(false);
  closed = output<void>();

  protected cs = inject(CanvasService);

  protected get snapOptions(): SelectOption[] {
    return this.cs.snapSizeList().map(v => ({ value: v, label: String(v) }));
  }

  protected setSnapSize(val: string | number): void {
    this.cs.setSnapSize(Number(val) || 1);
  }
}
