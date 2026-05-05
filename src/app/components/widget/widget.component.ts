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
  WidgetImageContent,
  WidgetStateItem,
  WidgetTextAlignmentHorizontal,
  WidgetTextAlignmentVertical,
  WidgetTextContent,
  WidgetTextFontFamily,
} from '../../models/canvas-widget-state.models';
import {CanvasService} from '../../services/canvas.service';

@Component({
  selector: 'app-widget',
  standalone: true,
  templateUrl: './widget.component.html',
  styleUrl: './widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetComponent {
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

  private readonly canvasService = inject(CanvasService);
  private readonly destroyRef = inject(DestroyRef);
  elRef = inject(ElementRef);

  private readonly textElementRef = viewChild<ElementRef<HTMLElement>>('textContentEl');
  private readonly autoFontSize = signal<number | null>(null);

  private resizeObserver: ResizeObserver | null = null;
  private pendingFontSizeRaf: number | null = null;

  item = input.required<WidgetStateItem>();
  activeDebug = input(false);

  constructor() {
    effect(() => {
      const content = this.textContent;
      if (!content?.style.autoSize) {
        this.autoFontSize.set(null);
        return;
      }

      // Recompute when text/style or committed widget geometry changes.
      void content.text;
      void content.style.fontFamily;
      void this.item().width;
      void this.item().height;
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

  protected get textContent(): WidgetTextContent | null {
    const content = this.item().content;
    return content.type === 'text' ? content : null;
  }

  protected get imageContent(): WidgetImageContent | null {
    const content = this.item().content;
    return content.type === 'image' ? content : null;
  }

  protected get isImageUrlValid(): boolean {
    if (!this.imageContent) {
      return false;
    }

    return this.canvasService.isValidImageUrl(this.imageContent.src);
  }

  protected get textComputedFontSize(): number {
    const content = this.textContent;
    if (!content) {
      return 12;
    }

    if (!content.style.autoSize) {
      return content.style.fontSize;
    }

    return this.autoFontSize() ?? Math.max(1, content.style.fontSize);
  }

  protected get textComputedFontFamily(): string {
    const content = this.textContent;
    if (!content) {
      return WidgetComponent.FONT_FAMILY_MAP.roboto;
    }

    return WidgetComponent.FONT_FAMILY_MAP[content.style.fontFamily];
  }

  protected get textComputedColor(): string {
    const content = this.textContent;
    return content?.style.color ?? '#000000';
  }

  protected get textHorizontalAlignStyle(): string {
    const content = this.textContent;
    if (!content) {
      return WidgetComponent.HORIZONTAL_ALIGN_MAP.center;
    }

    return WidgetComponent.HORIZONTAL_ALIGN_MAP[content.style.alignHorizontal];
  }

  protected get textVerticalAlignStyle(): string {
    const content = this.textContent;
    if (!content) {
      return WidgetComponent.VERTICAL_ALIGN_MAP.center;
    }

    return WidgetComponent.VERTICAL_ALIGN_MAP[content.style.alignVertical];
  }

  protected get textWhiteSpaceStyle(): string | null {
    const content = this.textContent;
    if (!content?.style.autoSize) {
      return null;
    }

    // Preserve only explicit newlines from textarea without auto wrapping.
    return 'pre';
  }

    protected get textOverflowWrapStyle(): string | null {
      const content = this.textContent;
      if (!content?.style.autoSize) {
        return null;
      }

      return 'normal';
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
    const content = this.textContent;
    const textEl = this.textElementRef()?.nativeElement;

    if (!content?.style.autoSize || !textEl) {
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
