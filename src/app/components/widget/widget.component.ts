import {ChangeDetectionStrategy, Component, ElementRef, inject, input} from '@angular/core';

@Component({
  selector: 'app-widget',
  standalone: true,
  templateUrl: './widget.component.html',
  styleUrl: './widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetComponent {
  elRef = inject(ElementRef);

  activeDebug = input(false);
}
