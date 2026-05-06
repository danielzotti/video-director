import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import {
  WidgetImageFitMode,
  WIDGET_IMAGE_FIT_MODES,
  WidgetTextFontFamily,
  WidgetImageContent,
  WidgetTextContent,
  WIDGET_CONTENT_TYPES,
  WIDGET_TEXT_FONT_FAMILIES,
  WidgetContentType,
  WidgetBorderStyle,
  WIDGET_BORDER_STYLES,
  DEFAULT_WIDGET_BORDER,
} from '../../models/canvas-widget-state.models';
import { CanvasService } from '../../services/canvas.service';
import { SelectOption, UiSelectComponent, UiSeparatorComponent, UiToggleComponent, UiButtonComponent, UiIconComponent } from '../../ui';

type WidgetGeometryField = 'x' | 'y' | 'width' | 'height';

@Component({
  selector: 'app-canvas-settings-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DecimalPipe, UiToggleComponent, UiSelectComponent, UiSeparatorComponent, UiButtonComponent, UiIconComponent],
  templateUrl: './canvas-settings-panel.component.html',
  styleUrl: './canvas-settings-panel.component.scss',
})
export class CanvasSettingsPanelComponent {

  private static readonly CONTENT_LABELS: Record<WidgetContentType, string> = {
    text: 'Text',
    image: 'Image',
  };

  private static readonly IMAGE_FIT_MODE_LABELS: Record<WidgetImageFitMode, string> = {
    cover: 'Cover',
    contain: 'Contain',
  };

   private static readonly FONT_FAMILY_LABELS: Record<WidgetTextFontFamily, string> = {
     roboto: 'Roboto (Sans)',
     montserrat: 'Montserrat (Sans)',
     exo: 'Exo (Sans)',
     lora: 'Lora (Serif)',
     'fira-code': 'Fira Code (Mono)',
   };

   isOpen = input<boolean>(false);
  showBackdrop = input<boolean>(true);
  panelMode = input<'popover' | 'sidebar'>('popover');
  contentOnly = input<boolean>(false);
  title = input<string>('Canvas Settings');
  maxHeight = input<string | null>(null);
  closed = output<void>();

  protected cs = inject(CanvasService);
  protected readonly geometryDraft = signal<Record<WidgetGeometryField, string>>({
    x: '', y: '', width: '', height: '',
  });
  protected readonly isImageDropzoneActive = signal(false);
  protected readonly isImageUrlModalOpen = signal(false);
  protected readonly imageUrlDraft = signal('');
  protected readonly imageUrlError = signal<string | null>(null);
  protected readonly isImageUrlSaving = signal(false);

  private readonly minPanelHeight = 120;
  private resizeStartY = 0;
  private resizeStartHeight = 0;
  readonly panelHeight = signal<number | null>(null);

  readonly panelHeightStyle = computed(() => {
    const h = this.panelHeight();
    if (h === null) return null;
    const maxH = this.maxHeight();
    if (maxH) {
      const maxPx = Number.parseInt(maxH, 10);
      return Math.min(h, maxPx) + 'px';
    }
    return h + 'px';
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

    // Clamp panelHeight when maxHeight shrinks (panel moved down)
    effect(() => {
      const maxH = this.maxHeight();
      const currentH = this.panelHeight();
      if (!maxH || currentH === null) return;
      const maxPx = Number.parseInt(maxH, 10);
      if (currentH > maxPx) {
        this.panelHeight.set(Math.max(this.minPanelHeight, maxPx));
      }
    });
  }

  protected onResizePointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    const panel = handle.closest<HTMLElement>('.settings-panel');
    if (!panel) return;
    this.resizeStartY = event.clientY;
    this.resizeStartHeight = panel.getBoundingClientRect().height;
    handle.setPointerCapture(event.pointerId);
  }

  protected onResizePointerMove(event: PointerEvent): void {
    const handle = event.currentTarget as HTMLElement;
    if (!handle.hasPointerCapture(event.pointerId)) return;
    const delta = event.clientY - this.resizeStartY;
    let newHeight = Math.max(this.minPanelHeight, this.resizeStartHeight + delta);
    const maxH = this.maxHeight();
    if (maxH) newHeight = Math.min(newHeight, Number.parseInt(maxH, 10));
    this.panelHeight.set(newHeight);
  }

  protected onResizePointerUp(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
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

  protected get imageFitModeOptions(): SelectOption[] {
    return WIDGET_IMAGE_FIT_MODES.map((value) => ({
      value,
      label: CanvasSettingsPanelComponent.IMAGE_FIT_MODE_LABELS[value],
    }));
  }

   protected get textFontFamilyOptions(): SelectOption[] {
     return WIDGET_TEXT_FONT_FAMILIES.map((value) => ({
       value,
       label: CanvasSettingsPanelComponent.FONT_FAMILY_LABELS[value],
     }));
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

  protected get canSaveSelectedImageToDisk(): boolean {
    return !!this.selectedImageContent?.src.trim();
  }

  protected get canSubmitImageUrl(): boolean {
    return !!this.imageUrlDraft().trim() && !this.isImageUrlSaving();
  }

  protected get hasTransparentBackground(): boolean {
    const background = this.selectedWidget?.background;
    return !background || background === 'transparent';
  }

  protected get selectedBackgroundColor(): string {
    return this.selectedWidget?.background && this.selectedWidget.background !== 'transparent'
      ? this.selectedWidget.background
      : '#ffffff';
  }

  protected get selectedBorderRadius(): number {
    return this.selectedWidget?.borderRadius ?? DEFAULT_WIDGET_BORDER.borderRadius;
  }

  protected get selectedBorderWidth(): number {
    return this.selectedWidget?.borderWidth ?? DEFAULT_WIDGET_BORDER.borderWidth;
  }

  protected get selectedBorderColor(): string {
    return this.selectedWidget?.borderColor ?? DEFAULT_WIDGET_BORDER.borderColor;
  }

  protected get selectedBorderStyle(): WidgetBorderStyle {
    return this.selectedWidget?.borderStyle ?? DEFAULT_WIDGET_BORDER.borderStyle;
  }

  protected get hasBorder(): boolean {
    return (this.selectedWidget?.borderWidth ?? 0) > 0;
  }

  protected get selectedPadding(): number {
    return this.selectedWidget?.padding ?? DEFAULT_WIDGET_BORDER.padding;
  }

  protected get isWidgetLocked(): boolean {
    return !!this.selectedWidget?.locked;
  }

  protected get isWidgetVisible(): boolean {
    return this.selectedWidget?.visible ?? true;
  }

  protected readonly borderStyleOptions = WIDGET_BORDER_STYLES;

  protected get widgetInputStep(): number {
    return this.cs.canSnapToGrid() ? this.cs.snapSize() : 1;
  }

  protected get isProjectDirectorySyncSupported(): boolean {
    return this.cs.isProjectDirectorySyncSupported();
  }

  protected get isProjectDirectoryConnected(): boolean {
    return this.cs.isProjectDirectoryConnected();
  }

  protected get projectDirectoryName(): string {
    return this.cs.projectDirectoryName() ?? '-';
  }

  protected get projectSyncStatusLabel(): string {
    const status = this.cs.projectSyncStatus();

    if (status === 'syncing') {
      return 'Syncing...';
    }

    if (status === 'error') {
      return 'Sync error';
    }

    const lastSync = this.cs.projectLastSyncedAt();
    return lastSync ? `Last sync: ${lastSync.toLocaleTimeString()}` : 'Idle';
  }

  protected get hasPendingProjectChanges(): boolean {
    return this.cs.projectHasPendingChanges();
  }

  protected get projectSyncBadgeVariant(): 'idle' | 'pending' | 'syncing' | 'error' {
    const status = this.cs.projectSyncStatus();
    if (status === 'syncing' || status === 'error') {
      return status;
    }

    return this.hasPendingProjectChanges ? 'pending' : 'idle';
  }

  protected get projectSyncError(): string | null {
    return this.cs.projectSyncError();
  }

  protected get isProjectSyncBusy(): boolean {
    return this.cs.projectSyncStatus() === 'syncing';
  }

  protected get importPromptForDirectory(): boolean {
    return this.cs.importPromptForDirectory();
  }

  protected get projectImportNotice(): { kind: 'info' | 'warning' | 'success' | 'error'; message: string } | null {
    return this.cs.projectImportNotice();
  }

  protected get hasPendingImportBackup(): boolean {
    return this.cs.hasPendingImportBackup();
  }

  protected get pendingImportBackupName(): string {
    return this.cs.pendingImportBackupName();
  }

  protected setSnapSize(val: string | number): void {
    this.cs.setSnapSize(Number(val) || 1);
  }

  protected setImportPromptForDirectory(value: boolean): void {
    this.cs.setImportPromptForDirectory(value);
  }

  protected dismissProjectImportNotice(): void {
    this.cs.dismissProjectImportNotice();
  }

  protected async savePendingImportBackup(): Promise<void> {
    try {
      await this.cs.savePendingImportBackup();
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        return;
      }

      console.error('[CanvasSettingsPanel] savePendingImportBackup failed:', err);
    }
  }

  protected async connectProjectDirectory(): Promise<void> {
    try {
      await this.cs.connectProjectDirectory();
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        return;
      }

      console.error('[CanvasSettingsPanel] connectProjectDirectory failed:', err);
    }
  }

  protected disconnectProjectDirectory(): void {
    this.cs.disconnectProjectDirectory();
  }

  protected async syncProjectDirectoryNow(): Promise<void> {
    try {
      await this.cs.syncProjectToDirectoryNow();
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        return;
      }

      console.error('[CanvasSettingsPanel] syncProjectDirectoryNow failed:', err);
    }
  }

  protected async loadProjectFromDirectory(): Promise<void> {
    try {
      await this.cs.loadProjectFromDirectory();
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        return;
      }

      console.error('[CanvasSettingsPanel] loadProjectFromDirectory failed:', err);
    }
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

  protected onTextFontSizeChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) {
      return;
    }

    this.cs.setSelectedWidgetTextFontSize(value);
  }

  protected onTextColorChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cs.setSelectedWidgetTextColor(value);
  }

  protected setTextFontFamily(value: string | number): void {
    if (value !== 'roboto' && value !== 'montserrat' && value !== 'exo' && value !== 'lora' && value !== 'fira-code') {
      return;
    }

    this.cs.setSelectedWidgetTextFontFamily(value);
  }

  protected setTextHorizontalAlignment(value: string | number): void {
    if (value !== 'left' && value !== 'center' && value !== 'right') {
      return;
    }

    this.cs.setSelectedWidgetTextHorizontalAlignment(value);
  }

  protected setTextVerticalAlignment(value: string | number): void {
    if (value !== 'top' && value !== 'center' && value !== 'bottom') {
      return;
    }

    this.cs.setSelectedWidgetTextVerticalAlignment(value);
  }

  protected setTextAutoSize(value: boolean): void {
    this.cs.setSelectedWidgetTextAutoSize(value);
  }

  protected onImageSrcChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cs.setSelectedWidgetImageSrc(value);
  }

  protected openImageFilePicker(input: HTMLInputElement): void {
    input.value = '';
    input.click();
  }

  protected async onImageFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    await this.importImageFile(file);
  }

  protected onImageDropzoneDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.isImageDropzoneActive.set(true);
  }

  protected onImageDropzoneDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isImageDropzoneActive.set(false);
  }

  protected async onImageDropzoneDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isImageDropzoneActive.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }

    await this.importImageFile(file);
  }

  protected openImageUrlModal(): void {
    this.imageUrlDraft.set('');
    this.imageUrlError.set(null);
    this.isImageUrlModalOpen.set(true);
  }

  protected closeImageUrlModal(): void {
    if (this.isImageUrlSaving()) {
      return;
    }

    this.isImageUrlModalOpen.set(false);
    this.imageUrlError.set(null);
  }

  protected onImageUrlDraftChange(event: Event): void {
    this.imageUrlDraft.set((event.target as HTMLInputElement).value);
    this.imageUrlError.set(null);
  }

  protected async confirmImageUrlModal(): Promise<void> {
    const url = this.imageUrlDraft().trim();
    if (!url) {
      this.imageUrlError.set('Inserisci un URL immagine valido.');
      return;
    }

    this.isImageUrlSaving.set(true);

    try {
      await this.cs.setSelectedWidgetImageFromUrl(url);
      this.closeImageUrlModal();
    } catch {
      this.imageUrlError.set('Impossibile scaricare l\'immagine da questo URL (controlla CORS/URL).');
    } finally {
      this.isImageUrlSaving.set(false);
    }
  }

  protected async saveImageToDisk(): Promise<void> {
    try {
      await this.cs.saveSelectedWidgetImageToDisk();
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') {
        return;
      }
      console.error('[CanvasSettingsPanel] saveImageToDisk failed:', err);
    }
  }

  private async importImageFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      return;
    }

    try {
      await this.cs.setSelectedWidgetImageFromFile(file);
    } catch (err) {
      console.error('[CanvasSettingsPanel] importImageFile failed:', err);
    }
  }

  protected onImageAltChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cs.setSelectedWidgetImageAlt(value);
  }

  protected setImageFitMode(value: string | number): void {
    if (value !== 'cover' && value !== 'contain') {
      return;
    }

    this.cs.setSelectedWidgetImageFitMode(value);
  }

  protected onWidgetNameChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cs.setSelectedWidgetName(value);
  }

  protected setBackgroundTransparent(value: boolean): void {
    if (value) {
      this.cs.setSelectedWidgetBackground(null);
      return;
    }

    this.cs.setSelectedWidgetBackground(this.selectedBackgroundColor);
  }

   protected onWidgetBackgroundColorChange(event: Event): void {
     const color = (event.target as HTMLInputElement).value;
     this.cs.setSelectedWidgetBackground(color || null);
   }

   protected onBorderRadiusChange(event: Event): void {
     const value = Number((event.target as HTMLInputElement).value);
     if (Number.isFinite(value)) { this.cs.setSelectedWidgetBorderRadius(value); }
   }

   protected onBorderWidthChange(event: Event): void {
     const value = Number((event.target as HTMLInputElement).value);
     if (Number.isFinite(value)) { this.cs.setSelectedWidgetBorderWidth(value); }
   }

   protected onBorderColorChange(event: Event): void {
     const color = (event.target as HTMLInputElement).value;
     this.cs.setSelectedWidgetBorderColor(color);
   }


   protected setBorderStyle(style: WidgetBorderStyle): void {
     this.cs.setSelectedWidgetBorderStyle(style);
     // Se si sceglie uno stile != none e width è 0, imposta un valore iniziale
     if (style !== 'none' && !this.hasBorder) {
       this.cs.setSelectedWidgetBorderWidth(1);
     }
   }

   protected onPaddingChange(event: Event): void {
     const value = Number((event.target as HTMLInputElement).value);
     if (Number.isFinite(value)) { this.cs.setSelectedWidgetPadding(value); }
   }

   protected setWidgetLocked(value: boolean): void {
     this.cs.setSelectedWidgetLocked(value);
   }

   protected setWidgetVisible(value: boolean): void {
     this.cs.setSelectedWidgetVisible(value);
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
