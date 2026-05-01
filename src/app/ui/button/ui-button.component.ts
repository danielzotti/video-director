import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type UiButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger';
export type UiButtonSize = 'sm' | 'md';

@Component({
  selector: 'app-ui-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button [class]="hostClass()" [disabled]="disabled()" [attr.title]="title() || null">
      <ng-content />
    </button>
  `,
  styleUrl: './ui-button.component.scss',
})
export class UiButtonComponent {
  variant  = input<UiButtonVariant>('secondary');
  size     = input<UiButtonSize>('md');
  active   = input<boolean>(false);
  disabled = input<boolean>(false);
  title    = input<string>('');

  protected hostClass = computed(() =>
    [
      'ui-btn',
      `ui-btn--${this.variant()}`,
      `ui-btn--${this.size()}`,
      this.active() ? 'ui-btn--active' : '',
    ]
      .filter(Boolean)
      .join(' ')
  );
}

