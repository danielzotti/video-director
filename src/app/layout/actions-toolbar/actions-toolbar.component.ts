import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CanvasService } from '../../services/canvas.service';
import { UiButtonComponent } from '../../ui/button/ui-button.component';
import { UiIconComponent } from '../../ui/icon/ui-icon.component';

@Component({
  selector: 'app-actions-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButtonComponent, UiIconComponent],
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
}

