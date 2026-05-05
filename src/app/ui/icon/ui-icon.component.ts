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
  | 'info'
  | 'text-align-left'
  | 'text-align-center'
  | 'text-align-right'
  | 'text'
  | 'image'
  | 'align-top'
  | 'align-center'
  | 'align-bottom'
  | 'border-none'
  | 'border-solid'
  | 'border-dashed'
  | 'border-dotted'
  | 'lock'
  | 'unlock'
  | 'eye'
  | 'eye-off'
  | 'undo'
  | 'redo';

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
        @case ('text-align-left') {
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="17" y2="12"/>
          <line x1="3" y1="18" x2="15" y2="18"/>
        }
        @case ('text-align-center') {
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
          <line x1="6" y1="18" x2="18" y2="18"/>
        }
        @case ('text-align-right') {
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="7" y1="12" x2="21" y2="12"/>
          <line x1="9" y1="18" x2="21" y2="18"/>
        }
        @case ('text') {
          <line x1="5" y1="6" x2="19" y2="6"/>
          <line x1="12" y1="6" x2="12" y2="18"/>
        }
        @case ('image') {
          <rect x="3" y="4" width="18" height="16" rx="2"/>
          <circle cx="9" cy="9" r="1.5"/>
          <path d="M4 17l5-5 3 3 4-4 4 6"/>
        }
        @case ('align-top') {
          <line x1="3" y1="3" x2="21" y2="3"/>
          <line x1="6" y1="8" x2="18" y2="8"/>
          <line x1="6" y1="13" x2="18" y2="13"/>
          <line x1="6" y1="18" x2="18" y2="18"/>
        }
        @case ('align-center') {
          <line x1="6" y1="3" x2="18" y2="3"/>
          <line x1="6" y1="8" x2="18" y2="8"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="6" y1="16" x2="18" y2="16"/>
          <line x1="6" y1="21" x2="18" y2="21"/>
        }
        @case ('align-bottom') {
          <line x1="6" y1="3" x2="18" y2="3"/>
          <line x1="6" y1="8" x2="18" y2="8"/>
          <line x1="6" y1="13" x2="18" y2="13"/>
          <line x1="3" y1="21" x2="21" y2="21"/>
        }
        @case ('border-none') {
          <line x1="4" y1="4" x2="20" y2="20" stroke-width="2.5"/>
          <rect x="3" y="3" width="18" height="18" rx="1" stroke-dasharray="3 3" stroke-width="1.5"/>
        }
        @case ('border-solid') {
          <rect x="3" y="3" width="18" height="18" rx="2"/>
        }
        @case ('border-dashed') {
          <rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 3"/>
        }
        @case ('border-dotted') {
          <rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="1.5 3" stroke-linecap="round"/>
        }
        @case ('lock') {
          <rect x="5" y="11" width="14" height="10" rx="2"/>
          <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
        }
        @case ('unlock') {
          <rect x="5" y="11" width="14" height="10" rx="2"/>
          <path d="M16 11V8a4 4 0 0 0-8 0"/>
        }
        @case ('eye') {
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
          <circle cx="12" cy="12" r="3"/>
        }
        @case ('eye-off') {
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.77 21.77 0 0 1 5.08-5.94"/>
          <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a21.76 21.76 0 0 1-3.17 4.39"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        }
        @case ('undo') {
          <path d="M3 7v6h6"/>
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
        }
        @case ('redo') {
          <path d="M21 7v6h-6"/>
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3-2.3"/>
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

