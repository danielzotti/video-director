import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
@Component({
  selector: 'app-ui-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ui-toggle">
      <span class="ui-toggle__track" [class.ui-toggle__track--on]="checked()">
        <span class="ui-toggle__thumb"></span>
      </span>
      @if (label()) {
        <span class="ui-toggle__label">{{ label() }}</span>
      }
      <input
        class="ui-toggle__input"
        type="checkbox"
        [checked]="checked()"
        (change)="onChanged($event)"
        [attr.aria-label]="label()"
      />
    </label>
  `,
  styleUrl: './ui-toggle.component.scss',
})
export class UiToggleComponent {
  label   = input<string>('');
  checked = input<boolean>(false);
  checkedChange = output<boolean>();
  protected onChanged(event: Event): void {
    this.checkedChange.emit((event.target as HTMLInputElement).checked);
  }
}
