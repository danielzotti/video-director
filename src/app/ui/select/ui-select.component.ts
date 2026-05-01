import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
export interface SelectOption {
  value: string | number;
  label: string;
}
@Component({
  selector: 'app-ui-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="ui-select">
      @if (label()) {
        <span class="ui-select__label">{{ label() }}</span>
      }
      <span class="ui-select__wrapper">
        <select
          class="ui-select__control"
          [value]="value()"
          (change)="onChanged($event)"
        >
          @for (opt of options(); track opt.value) {
            <option [value]="opt.value" [selected]="opt.value === value()">{{ opt.label }}</option>
          }
        </select>
        <span class="ui-select__arrow">
          <svg viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5">
            <polyline points="1 1 5 5 9 1"/>
          </svg>
        </span>
      </span>
    </label>
  `,
  styleUrl: './ui-select.component.scss',
})
export class UiSelectComponent {
  label   = input<string>('');
  options = input<SelectOption[]>([]);
  value   = input<string | number>('');
  valueChange = output<string | number>();
  protected onChanged(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    const num = Number(raw);
    this.valueChange.emit(isNaN(num) ? raw : num);
  }
}
