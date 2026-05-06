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

  protected async exportToFile(): Promise<void> {
      const projectName = this.cs.projectName() || 'canvas';
    await this.cs.exportToFile(projectName);
  }

  protected async importFromFile(): Promise<void> {
    await this.cs.importFromFile();
  }

  protected async exportCanvasAsImage(): Promise<void> {
    try {
      const projectName = this.cs.projectName() || 'canvas';
      await this.cs.exportCanvasAsImage(projectName);
    } catch (err) {
      console.error('[ActionsToolbar] Export image failed:', err);
    }
  }
}

