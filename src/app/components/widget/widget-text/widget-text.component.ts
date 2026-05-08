import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  WidgetTextAlignmentHorizontal,
  WidgetTextAlignmentVertical,
  WidgetTextContent,
  WidgetTextFontFamily,
} from '../../../models/canvas-widget-state.models';

@Component({
  selector: 'app-widget-text',
  standalone: true,
  templateUrl: './widget-text.component.html',
  styleUrl: './widget-text.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetTextComponent {
  private static readonly FONT_FAMILY_MAP: Record<WidgetTextFontFamily, string> = {
    roboto: 'Roboto, Arial, Helvetica, sans-serif',
    montserrat: 'Montserrat, Arial, Helvetica, sans-serif',
    exo: 'Exo, Arial, Helvetica, sans-serif',
    lora: 'Lora, Georgia, "Times New Roman", serif',
    'fira-code': '"Fira Code", "SFMono-Regular", Menlo, Consolas, monospace',
  };

  private static readonly HORIZONTAL_ALIGN_MAP: Record<WidgetTextAlignmentHorizontal, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
  };

  private static readonly VERTICAL_ALIGN_MAP: Record<WidgetTextAlignmentVertical, string> = {
    top: 'flex-start',
    center: 'center',
    bottom: 'flex-end',
  };

  private readonly elRef = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  private readonly textElementRef = viewChild<ElementRef<HTMLElement>>('textContentEl');
  private readonly autoFontSize = signal<number | null>(null);

  private resizeObserver: ResizeObserver | null = null;
  private pendingFontSizeRaf: number | null = null;

  content = input.required<WidgetTextContent>();
  /** Committed widget width from state – used to retrigger autoSize after resize. */
  widgetWidth = input.required<number>();
  /** Committed widget height from state – used to retrigger autoSize after resize. */
  widgetHeight = input.required<number>();

  constructor() {
    effect(() => {
      const content = this.content();
      if (!content.style.autoSize) {
        this.autoFontSize.set(null);
        return;
      }

      // Recompute when text/style or committed widget geometry changes.
      void content.text;
      void content.style.fontFamily;
      void this.widgetWidth();
      void this.widgetHeight();
      this.scheduleAutoFontSizeRecompute();
    });

    afterNextRender(() => {
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.scheduleAutoFontSizeRecompute());
        this.resizeObserver.observe(this.elRef.nativeElement);
      }

      this.scheduleAutoFontSizeRecompute();
    });

    this.destroyRef.onDestroy(() => {
      if (this.pendingFontSizeRaf !== null) {
        cancelAnimationFrame(this.pendingFontSizeRaf);
        this.pendingFontSizeRaf = null;
      }
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
    });
  }

  protected get computedFontSize(): number {
    const content = this.content();
    if (!content.style.autoSize) {
      return content.style.fontSize;
    }
    return this.autoFontSize() ?? Math.max(1, content.style.fontSize);
  }

  protected get computedFontFamily(): string {
    return WidgetTextComponent.FONT_FAMILY_MAP[this.content().style.fontFamily];
  }

  protected get computedColor(): string {
    return this.content().style.color;
  }

  protected get horizontalAlignStyle(): string {
    return WidgetTextComponent.HORIZONTAL_ALIGN_MAP[this.content().style.alignHorizontal];
  }

  protected get verticalAlignStyle(): string {
    return WidgetTextComponent.VERTICAL_ALIGN_MAP[this.content().style.alignVertical];
  }

  protected get whiteSpaceStyle(): string | null {
    return this.content().style.autoSize ? 'pre' : null;
  }

   protected get overflowWrapStyle(): string | null {
     return this.content().style.autoSize ? 'normal' : null;
   }

   protected get computedTextShadow(): string | null {
     const style = this.content().style;
     const shadowBlur = style.textShadowBlur ?? 0;
      const offsetX = style.textShadowOffsetX ?? 0;
      const offsetY = style.textShadowOffsetY ?? 0;
      if (shadowBlur === 0 && offsetX === 0 && offsetY === 0) {
       return null;
     }
     const color = style.textShadowColor ?? '#000000';
     return `${offsetX}px ${offsetY}px ${shadowBlur}px ${color}`;
   }

   private scheduleAutoFontSizeRecompute(): void {
    if (this.pendingFontSizeRaf !== null) {
      cancelAnimationFrame(this.pendingFontSizeRaf);
    }

    this.pendingFontSizeRaf = requestAnimationFrame(() => {
      this.pendingFontSizeRaf = null;
      this.recomputeAutoFontSize();
    });
  }

  private recomputeAutoFontSize(): void {
    const content = this.content();
    const textEl = this.textElementRef()?.nativeElement;

    if (!content.style.autoSize || !textEl) {
      return;
    }

    const availableWidth = Math.floor(textEl.clientWidth);
    const availableHeight = Math.floor(textEl.clientHeight);

    if (availableWidth <= 0 || availableHeight <= 0) {
      this.autoFontSize.set(1);
      return;
    }

    const fits = (size: number): boolean => {
      textEl.style.fontSize = `${size}px`;
      return textEl.scrollWidth <= textEl.clientWidth + 1 && textEl.scrollHeight <= textEl.clientHeight + 1;
    };

    const minSize = 1;
    const maxSize = Math.max(minSize, Math.floor(Math.max(availableWidth, availableHeight) * 2));

    if (!fits(minSize)) {
      this.autoFontSize.set(minSize);
      return;
    }

    let low = minSize;
    let high = maxSize;
    let best = minSize;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (fits(mid)) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    textEl.style.fontSize = `${best}px`;
    this.autoFontSize.set(best);
  }
}

