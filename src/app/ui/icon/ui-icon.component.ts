import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type UiIconName =
  | 'zoom-in'
  | 'zoom-out'
  | 'center'
  | 'settings'
  | 'grid'
  | 'magnet'
  | 'border'
  | 'resize'
  | 'debug'
  | 'close'
  | 'check'
  | 'chevron-down'
  | 'info';

@Component({
  selector: 'app-ui-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg xmlns="http://www.w3.org/2000/svg"
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         stroke-width="2"
         stroke-linecap="round"
         stroke-linejoin="round"
         aria-hidden="true">
      @switch (name()) {
        @case ('zoom-in') {
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        }
        @case ('zoom-out') {
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        }
        @case ('center') {
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="2" x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
          <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
        }
        @case ('settings') {
          <line x1="4" y1="21" x2="4" y2="14"/>
          <line x1="4" y1="10" x2="4" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12" y2="3"/>
          <line x1="20" y1="21" x2="20" y2="16"/>
          <line x1="20" y1="12" x2="20" y2="3"/>
          <line x1="1" y1="14" x2="7" y2="14"/>
          <line x1="9" y1="8" x2="15" y2="8"/>
          <line x1="17" y1="16" x2="23" y2="16"/>
        }
        @case ('grid') {
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        }
        @case ('magnet') {
          <path d="M6 15A6 6 0 0 0 18 15"/>
          <line x1="6" y1="15" x2="6" y2="4"/>
          <line x1="18" y1="15" x2="18" y2="4"/>
          <line x1="3" y1="7" x2="6" y2="7"/>
          <line x1="18" y1="7" x2="21" y2="7"/>
        }
        @case ('border') {
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="9" y1="3" x2="9" y2="3.01"/>
          <line x1="15" y1="3" x2="15" y2="3.01"/>
          <line x1="21" y1="9" x2="21" y2="9.01"/>
          <line x1="21" y1="15" x2="21" y2="15.01"/>
          <line x1="15" y1="21" x2="15" y2="21.01"/>
          <line x1="9" y1="21" x2="9" y2="21.01"/>
          <line x1="3" y1="15" x2="3" y2="15.01"/>
          <line x1="3" y1="9" x2="3" y2="9.01"/>
        }
        @case ('resize') {
          <polyline points="15 3 21 3 21 9"/>
          <polyline points="9 21 3 21 3 15"/>
          <line x1="21" y1="3" x2="14" y2="10"/>
          <line x1="3" y1="21" x2="10" y2="14"/>
        }
        @case ('debug') {
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        }
        @case ('close') {
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        }
        @case ('check') {
          <polyline points="20 6 9 17 4 12"/>
        }
        @case ('chevron-down') {
          <polyline points="6 9 12 15 18 9"/>
        }
        @case ('info') {
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        }
      }
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    svg {
      width: var(--ui-icon-size, var(--ds-icon-size-md));
      height: var(--ui-icon-size, var(--ds-icon-size-md));
    }
  `],
})
export class UiIconComponent {
  name = input.required<UiIconName>();
}

