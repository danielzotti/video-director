import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {CanvasService} from '../../services/canvas.service';
import {UiButtonComponent} from '../../ui/button/ui-button.component';
import {UiIconComponent} from '../../ui/icon/ui-icon.component';

@Component({
  selector: 'app-widget-create-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButtonComponent, UiIconComponent],
  template: `
    <div class="widget-create-toolbar">
      <app-ui-button variant="icon" title="Create text widget" (click)="createTextWidget()">
        <app-ui-icon name="text"></app-ui-icon>
      </app-ui-button>

      <app-ui-button variant="icon" title="Create image widget" (click)="createImageWidget()">
        <app-ui-icon name="image"></app-ui-icon>
      </app-ui-button>

      <app-ui-button variant="icon" title="Create video widget" (click)="createVideoWidget()">
        <app-ui-icon name="video"></app-ui-icon>
      </app-ui-button>
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .widget-create-toolbar {
        display: inline-flex;
        align-items: center;
        gap: var(--ds-space-1);
        padding: 3px;
        background-color: var(--ds-surface-2);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-md);
      }
    `,
  ],
})
export class WidgetCreateToolbarComponent {
  protected readonly cs = inject(CanvasService);

  protected createTextWidget(): void {
    this.cs.createTextWidget();
  }

  protected createImageWidget(): void {
    this.cs.createImageWidget();
  }

  protected createVideoWidget(): void {
    this.cs.createVideoWidget();
  }
}

