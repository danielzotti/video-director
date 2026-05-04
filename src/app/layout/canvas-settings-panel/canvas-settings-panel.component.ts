import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  WidgetImageContent,
  WidgetTextContent,
  WIDGET_CONTENT_TYPES,
  WidgetContentType,
} from '../../models/canvas-widget-state.models';
import { CanvasService } from '../../services/canvas.service';
import { SelectOption, UiSelectComponent, UiSeparatorComponent, UiToggleComponent } from '../../ui';

type WidgetGeometryField = 'x' | 'y' | 'width' | 'height';

@Component({
  selector: 'app-canvas-settings-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, UiToggleComponent, UiSelectComponent, UiSeparatorComponent],
  templateUrl: './canvas-settings-panel.component.html',
  styleUrl: './canvas-settings-panel.component.scss',
})
export class CanvasSettingsPanelComponent {
  private static readonly CONTENT_LABELS: Record<WidgetContentType, string> = {
    text: 'Text',
    image: 'Image',
  };

  isOpen = input<boolean>(false);
  showBackdrop = input<boolean>(true);
  panelMode = input<'popover' | 'sidebar'>('popover');
  contentOnly = input<boolean>(false);
  title = input<string>('Canvas Settings');
  closed = output<void>();

  protected cs = inject(CanvasService);
  protected readonly geometryDraft = signal<Record<WidgetGeometryField, string>>({
    x: '',
    y: '',
    width: '',
    height: '',
  });

  constructor() {
    effect(() => {
      const widget = this.selectedWidget;

      if (!widget) {
        this.geometryDraft.set({ x: '', y: '', width: '', height: '' });
        return;
      }

      this.geometryDraft.set({
        x: String(widget.x),
        y: String(widget.y),
        width: String(widget.width),
        height: String(widget.height),
      });
    });
  }

  protected get snapOptions(): SelectOption[] {
    return this.cs.snapSizeList().map(v => ({ value: v, label: String(v) }));
  }

  protected get contentTypeOptions(): SelectOption[] {
    return WIDGET_CONTENT_TYPES.map((value) => ({
      value,
      label: CanvasSettingsPanelComponent.CONTENT_LABELS[value],
    }));
  }

  protected get hasSelectedWidget(): boolean {
    return this.cs.selectedWidget() !== null;
  }

  protected get isPopoverMode(): boolean {
    return this.panelMode() === 'popover';
  }

  protected get isSidebarMode(): boolean {
    return this.panelMode() === 'sidebar';
  }

  protected get selectedWidget() {
    return this.cs.selectedWidget();
  }

  protected get selectedTextContent(): WidgetTextContent | null {
    const content = this.selectedWidget?.content;
    return content?.type === 'text' ? content : null;
  }

  protected get selectedImageContent(): WidgetImageContent | null {
    const content = this.selectedWidget?.content;
    return content?.type === 'image' ? content : null;
  }

  protected get widgetInputStep(): number {
    return this.cs.canSnapToGrid() ? this.cs.snapSize() : 1;
  }

  protected setSnapSize(val: string | number): void {
    this.cs.setSnapSize(Number(val) || 1);
  }

  protected onCanvasWidthChange(event: Event): void {
    const width = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(width)) {
      return;
    }

    this.cs.canvasResize({ width });
  }

  protected onCanvasHeightChange(event: Event): void {
    const height = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(height)) {
      return;
    }

    this.cs.canvasResize({ height });
  }

  protected setContentType(value: string | number): void {
    if (value !== 'text' && value !== 'image') {
      return;
    }

    this.cs.setSelectedWidgetContentType(value);
  }

  protected onTextChange(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.cs.setSelectedWidgetText(value);
  }

  protected onImageSrcChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cs.setSelectedWidgetImageSrc(value);
  }

  protected onImageAltChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cs.setSelectedWidgetImageAlt(value);
  }

  protected onWidgetNameChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cs.setSelectedWidgetName(value);
  }

  protected onWidgetGeometryInput(event: Event, field: WidgetGeometryField): void {
    const input = event.target as HTMLInputElement;
    this.updateGeometryDraftValue(field, input.value);
  }

  protected onWidgetGeometryCommit(event: Event, field: WidgetGeometryField): void {
    const input = event.target as HTMLInputElement;
    this.updateGeometryDraftValue(field, input.value);

    const value = Number(input.value);

    if (!Number.isFinite(value)) {
      this.syncWidgetFieldValue(input, field);
      return;
    }

    if (field === 'x') {
      this.cs.setSelectedWidgetX(value);
    } else if (field === 'y') {
      this.cs.setSelectedWidgetY(value);
    } else if (field === 'width') {
      this.cs.setSelectedWidgetWidth(value);
    } else {
      this.cs.setSelectedWidgetHeight(value);
    }

    this.syncWidgetFieldValue(input, field);
  }

  protected onNumericEnter(event: Event, field: WidgetGeometryField): void {
    event.preventDefault();
    this.onWidgetGeometryCommit(event, field);

    // Keep focus on the same input after committing with Enter.
    (event.target as HTMLInputElement).focus();
  }


  private updateGeometryDraftValue(field: WidgetGeometryField, value: string): void {
    this.geometryDraft.update((draft) => ({
      ...draft,
      [field]: value,
    }));
  }

  private syncWidgetFieldValue(input: HTMLInputElement, field: WidgetGeometryField): void {
    const widget = this.selectedWidget;
    if (!widget) {
      return;
    }

    input.value = String(widget[field]);
    this.updateGeometryDraftValue(field, input.value);
  }
}
