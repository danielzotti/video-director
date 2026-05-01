import { ChangeDetectionStrategy, Component, input } from '@angular/core';
@Component({
  selector: 'app-ui-separator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="ui-sep" [class.ui-sep--vertical]="orientation() === 'vertical'" [class.ui-sep--horizontal]="orientation() === 'horizontal'"></span>`,
  styleUrl: './ui-separator.component.scss',
})
export class UiSeparatorComponent {
  orientation = input<'vertical' | 'horizontal'>('vertical');
}
