import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CanvasService } from '../../services/canvas.service';
import { UiButtonComponent } from '../../ui/button/ui-button.component';
import { UiIconComponent } from '../../ui/icon/ui-icon.component';
import { UiSeparatorComponent } from '../../ui/separator/ui-separator.component';

@Component({
  selector: 'app-actions-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButtonComponent, UiIconComponent, UiSeparatorComponent],
  templateUrl: './actions-toolbar.component.html',
  styleUrl: './actions-toolbar.component.scss',
})
export class ActionsToolbarComponent {
  protected readonly cs = inject(CanvasService);

  protected undo(): void {
    this.cs.undo();
  }

  protected redo(): void {
    this.cs.redo();
  }

  protected exportToFile(): void {
    this.cs.exportToFile('project');
  }

  protected importFromFile(): void {
    this.cs.importFromFile();
  }

  protected async exportCanvasAsImage(): Promise<void> {
    try {
      await this.cs.exportCanvasAsImage('canvas');
    } catch (err) {
      console.error('[ActionsToolbar] Export image failed:', err);
    }
  }
}

