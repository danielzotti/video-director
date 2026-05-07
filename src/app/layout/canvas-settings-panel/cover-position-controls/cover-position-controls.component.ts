import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiButtonComponent } from '../../../ui';

type CoverAnchor = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

@Component({
  selector: 'app-cover-position-controls',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, UiButtonComponent],
  templateUrl: './cover-position-controls.component.html',
  styleUrl: './cover-position-controls.component.scss',
})
export class CoverPositionControlsComponent {
  idPrefix = input<string>('cover');
  offsetX = input<string>('-50');
  offsetY = input<string>('-50');

  anchorSelected = output<CoverAnchor>();
  offsetXChanged = output<number>();
  offsetYChanged = output<number>();

  protected readonly ANCHOR_OFFSET_MAP: Record<CoverAnchor, { x: number; y: number }> = {
    'top-left': { x: 0, y: 0 },
    'top-center': { x: -50, y: 0 },
    'top-right': { x: -100, y: 0 },
    'center-left': { x: 0, y: -50 },
    'center': { x: -50, y: -50 },
    'center-right': { x: -100, y: -50 },
    'bottom-left': { x: 0, y: -100 },
    'bottom-center': { x: -50, y: -100 },
    'bottom-right': { x: -100, y: -100 },
  };

  protected selectAnchor(anchor: CoverAnchor): void {
    this.anchorSelected.emit(anchor);
  }

  protected isAnchorActive(anchor: CoverAnchor): boolean {
    const { x, y } = this.ANCHOR_OFFSET_MAP[anchor];
    return this.offsetX() === String(x) && this.offsetY() === String(y);
  }

  protected onOffsetXChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.offsetXChanged.emit(value);
    }
  }

  protected onOffsetYChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.offsetYChanged.emit(value);
    }
  }
}

