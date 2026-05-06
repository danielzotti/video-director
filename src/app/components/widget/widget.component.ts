import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {
  WidgetImageContent,
  WidgetStateItem,
  WidgetTextContent,
  WidgetVideoContent,
} from '../../models/canvas-widget-state.models';
import {WidgetTextComponent} from './widget-text/widget-text.component';
import {WidgetImageComponent} from './widget-image/widget-image.component';
import {WidgetVideoComponent} from './widget-video/widget-video.component';

@Component({
  selector: 'app-widget',
  standalone: true,
  imports: [WidgetTextComponent, WidgetImageComponent, WidgetVideoComponent],
  templateUrl: './widget.component.html',
  styleUrl: './widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetComponent {
  item = input.required<WidgetStateItem>();
  activeDebug = input(false);

  protected get textContent(): WidgetTextContent {
    return this.item().content as WidgetTextContent;
  }

  protected get imageContent(): WidgetImageContent {
    return this.item().content as WidgetImageContent;
  }

  protected get videoContent(): WidgetVideoContent {
    return this.item().content as WidgetVideoContent;
  }
}
