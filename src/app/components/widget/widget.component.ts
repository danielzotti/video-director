import {ChangeDetectionStrategy, Component, ElementRef, inject, input} from '@angular/core';
import {WidgetImageContent, WidgetStateItem, WidgetTextContent} from '../../models/canvas-widget-state.models';
import {CanvasService} from '../../services/canvas.service';

@Component({
  selector: 'app-widget',
  standalone: true,
  templateUrl: './widget.component.html',
  styleUrl: './widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetComponent {
  private readonly canvasService = inject(CanvasService);
  elRef = inject(ElementRef);

  item = input.required<WidgetStateItem>();
  activeDebug = input(false);

  protected get textContent(): WidgetTextContent | null {
    const content = this.item().content;
    return content.type === 'text' ? content : null;
  }

  protected get imageContent(): WidgetImageContent | null {
    const content = this.item().content;
    return content.type === 'image' ? content : null;
  }

  protected get isImageUrlValid(): boolean {
    if (!this.imageContent) {
      return false;
    }

    return this.canvasService.isValidImageUrl(this.imageContent.src);
  }
}
