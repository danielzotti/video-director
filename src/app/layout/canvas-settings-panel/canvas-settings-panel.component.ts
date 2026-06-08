import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  WidgetImageFitMode,
  WIDGET_IMAGE_FIT_MODES,
  WidgetTextFontFamily,
  WidgetImageContent,
  WidgetTextContent,
  WidgetVideoContent,
  WIDGET_CONTENT_TYPES,
  WIDGET_TEXT_FONT_FAMILIES,
  WidgetContentType,
  WidgetBorderStyle,
  DEFAULT_WIDGET_OPACITY,
  DEFAULT_WIDGET_BACKGROUND_OPACITY,
  DEFAULT_WIDGET_BORDER,
} from '../../models/canvas-widget-state.models';
import { CanvasService } from '../../services/canvas.service';
import { TimelineService } from '../../services/timeline.service';
import { SelectOption, UiSelectComponent, UiSeparatorComponent, UiToggleComponent, UiButtonComponent, UiIconComponent } from '../../ui';
import { CoverPositionControlsComponent } from './cover-position-controls/cover-position-controls.component';
import { CropPositionControlsComponent } from './crop-position-controls/crop-position-controls.component';
import { ProjectSyncBadgeComponent } from '../../components/project-sync-badge/project-sync-badge.component';

type WidgetGeometryField = 'x' | 'y' | 'width' | 'height';
type MediaAnchor = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

@Component({
  selector: 'app-canvas-settings-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, UiToggleComponent, UiSelectComponent, UiSeparatorComponent, UiButtonComponent, UiIconComponent, CoverPositionControlsComponent, CropPositionControlsComponent, ProjectSyncBadgeComponent],
  templateUrl: './canvas-settings-panel.component.html',
  styleUrl: './canvas-settings-panel.component.scss',
})
export class CanvasSettingsPanelComponent {

  private static readonly CONTENT_LABELS: Record<WidgetContentType, string> = {
    text: 'Text',
    image: 'Image',
    video: 'Video',
  };

  private static readonly IMAGE_FIT_MODE_LABELS: Record<WidgetImageFitMode, string> = {
    cover: 'Cover',
    contain: 'Contain',
    crop: 'Crop',
  };

   private static readonly FONT_FAMILY_LABELS: Record<WidgetTextFontFamily, string> = {
     roboto: 'Roboto (Sans)',
     montserrat: 'Montserrat (Sans)',
     exo: 'Exo (Sans)',
     lora: 'Lora (Serif)',
     'fira-code': 'Fira Code (Mono)',
   };

  private static readonly MEDIA_ANCHOR_OFFSETS: Record<MediaAnchor, { x: number; y: number }> = {
    'top-left': { x: 0, y: 0 },
    'top-center': { x: -50, y: 0 },
    'top-right': { x: -100, y: 0 },
    'center-left': { x: 0, y: -50 },
    center: { x: -50, y: -50 },
    'center-right': { x: -100, y: -50 },
    'bottom-left': { x: 0, y: -100 },
    'bottom-center': { x: -50, y: -100 },
    'bottom-right': { x: -100, y: -100 },
  };

   isOpen = input<boolean>(false);
  showBackdrop = input<boolean>(true);
  panelMode = input<'popover' | 'sidebar'>('popover');
  contentOnly = input<boolean>(false);
  title = input<string>('Settings');
  maxHeight = input<string | null>(null);
  closed = output<void>();

  protected cs = inject(CanvasService);
  private readonly timelineService = inject(TimelineService);
  private readonly selectedWidgetComputed = computed(() => this.cs.selectedWidget());
  private readonly selectedTextContentComputed = computed<WidgetTextContent | null>(() => {
    const widget = this.selectedWidgetComputed();
    return widget?.content.type === 'text' ? widget.content : null;
  });
  private readonly selectedImageContentComputed = computed<WidgetImageContent | null>(() => {
    const widget = this.selectedWidgetComputed();
    return widget?.content.type === 'image' ? widget.content : null;
  });
  private readonly selectedVideoContentComputed = computed<WidgetVideoContent | null>(() => {
    const widget = this.selectedWidgetComputed();
    return widget?.content.type === 'video' ? widget.content : null;
  });
  protected readonly geometryDraft = signal<Record<WidgetGeometryField, string>>({
    x: '', y: '', width: '', height: '',
  });
  protected readonly timelineDraft = signal<{ start: string; end: string }>({ start: '0', end: '0' });
  protected readonly durationDraft = signal<{ hours: string; minutes: string; seconds: string; tenths: string }>({
    hours: '0', minutes: '0', seconds: '30', tenths: '0',
  });
  protected readonly isImageDropzoneActive = signal(false);
  protected readonly isVideoDropzoneActive = signal(false);
  protected readonly isImageUrlModalOpen = signal(false);
  protected readonly imageUrlDraft = signal('');
  protected readonly imageUrlError = signal<string | null>(null);
  protected readonly isImageUrlSaving = signal(false);
  protected readonly imageCoverOffsetDraft = signal<{ x: string; y: string }>({ x: '-50', y: '-50' });
  protected readonly videoCoverOffsetDraft = signal<{ x: string; y: string }>({ x: '-50', y: '-50' });
  protected readonly imageCropDraft = signal<{ x: string; y: string; zoom: string }>({ x: '-50', y: '-50', zoom: '1' });
  protected readonly videoCropDraft = signal<{ x: string; y: string; zoom: string }>({ x: '-50', y: '-50', zoom: '1' });

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

    // Sync timeline draft
    effect(() => {
      const widget = this.selectedWidget;
      const duration = this.timelineService.duration();
      if (!widget) {
        this.timelineDraft.set({ start: '0', end: String(duration / 1000) });
        return;
      }
      const start = (widget.timelineStart ?? 0) / 1000;
      const end = (widget.timelineEnd ?? duration) / 1000;
      this.timelineDraft.set({ start: String(start), end: String(end) });
    });

    // Sync duration draft
    effect(() => {
      const ms = this.timelineService.duration();
      this.durationDraft.set(CanvasSettingsPanelComponent.msToDurationParts(ms));
    });

    // Sync image cover offset draft
    effect(() => {
      const imageContent = this.selectedImageContent;
      if (!imageContent || imageContent.fitMode !== 'cover') {
        return;
      }
      this.imageCoverOffsetDraft.set({
        x: String(imageContent.offsetX ?? -50),
        y: String(imageContent.offsetY ?? -50),
      });
    });

    // Sync video cover offset draft
    effect(() => {
      const videoContent = this.selectedVideoContent;
      if (!videoContent || videoContent.fitMode !== 'cover') {
        return;
      }
      this.videoCoverOffsetDraft.set({
        x: String(videoContent.offsetX ?? -50),
        y: String(videoContent.offsetY ?? -50),
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

    effect(() => {
      const imageContent = this.selectedImageContent;
      if (!imageContent || imageContent.fitMode !== 'crop') {
        return;
      }

      this.imageCropDraft.set({
        x: String(imageContent.offsetX ?? -50),
        y: String(imageContent.offsetY ?? -50),
        zoom: String(imageContent.cropZoom ?? 1),
      });
    });

    effect(() => {
      const videoContent = this.selectedVideoContent;
      if (!videoContent || videoContent.fitMode !== 'crop') {
        return;
      }

      this.videoCropDraft.set({
        x: String(videoContent.offsetX ?? -50),
        y: String(videoContent.offsetY ?? -50),
        zoom: String(videoContent.cropZoom ?? 1),
      });
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
    return this.selectedWidgetComputed();
  }

  protected get selectedTextContent(): WidgetTextContent | null {
    return this.selectedTextContentComputed();
  }

  protected get selectedImageContent(): WidgetImageContent | null {
    return this.selectedImageContentComputed();
  }

  protected get selectedVideoContent(): WidgetVideoContent | null {
    return this.selectedVideoContentComputed();
  }

  protected get canToggleSelectedVideoPlayback(): boolean {
    const widget = this.selectedWidget;
    return !!widget && widget.content.type === 'video' && this.cs.canControlWidgetVideo(widget.uuid);
  }

  protected get isSelectedVideoPlaying(): boolean {
    const widget = this.selectedWidget;
    if (!widget || widget.content.type !== 'video') {
      return false;
    }

    return this.cs.isWidgetVideoPlaying(widget.uuid);
  }

  protected get selectedVideoCurrentTime(): number {
    const widget = this.selectedWidget;
    if (!widget || widget.content.type !== 'video') {
      return 0;
    }

    return this.cs.getWidgetVideoCurrentTime(widget.uuid);
  }

  protected get selectedVideoDuration(): number {
    const widget = this.selectedWidget;
    if (!widget || widget.content.type !== 'video') {
      return 0;
    }

    return this.cs.getWidgetVideoDuration(widget.uuid);
  }

  protected get selectedVideoVolume(): number {
    const widget = this.selectedWidget;
    if (!widget || widget.content.type !== 'video') {
      return 1;
    }

    return this.cs.getWidgetVideoVolume(widget.uuid);
  }

  protected formatTime(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
    const background = this.selectedWidget?.background;
    if (!background || background === 'transparent') {
      return '#ffffff';
    }

    const rgb = this.parseColorToRgb(background);
    return rgb ? this.rgbToHex(rgb) : '#ffffff';
  }

  protected get selectedBackgroundOpacity(): number {
    return this.selectedWidget?.backgroundOpacity ?? DEFAULT_WIDGET_BACKGROUND_OPACITY;
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

   protected get selectedShadowColor(): string {
     return this.selectedWidget?.shadowColor ?? DEFAULT_WIDGET_BORDER.shadowColor ?? '#000000';
   }

   protected get selectedShadowBlur(): number {
     return this.selectedWidget?.shadowBlur ?? DEFAULT_WIDGET_BORDER.shadowBlur ?? 0;
   }

   protected get selectedShadowOffsetX(): number {
     return this.selectedWidget?.shadowOffsetX ?? DEFAULT_WIDGET_BORDER.shadowOffsetX ?? 0;
   }

   protected get selectedShadowOffsetY(): number {
     return this.selectedWidget?.shadowOffsetY ?? DEFAULT_WIDGET_BORDER.shadowOffsetY ?? 0;
   }

   protected get hasShadow(): boolean {
     return (this.selectedWidget?.shadowBlur ?? 0) > 0;
   }

   protected get isWidgetLocked(): boolean {
     return !!this.selectedWidget?.locked;
   }

  protected get isWidgetVisible(): boolean {
    return this.selectedWidget?.visible ?? true;
  }

  protected get selectedWidgetOpacity(): number {
    return this.selectedWidget?.opacity ?? DEFAULT_WIDGET_OPACITY;
  }


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

  protected get hasPendingProjectChanges(): boolean {
    return this.cs.projectHasPendingChanges();
  }

  protected get isProjectDirectoryAutoSyncEnabled(): boolean {
    return this.cs.projectDirectoryAutoSyncEnabled();
  }


  protected get activeStorageBackendLabel(): string {
    const backend = this.cs.activeStorageBackend();
    switch (backend) {
      case 'sync-folder': return 'Folder sync';
      case 'indexeddb':   return 'IndexedDB';
      case 'localstorage': return 'Emergency (localStorage)';
    }
  }

  protected get activeStorageBackend() {
    return this.cs.activeStorageBackend();
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

  protected get projectName(): string {
    return this.cs.projectName();
  }

  protected setProjectName(value: string): void {
    this.cs.setProjectName(value);
  }

  protected onProjectNameInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.setProjectName(value);
  }

  protected setSnapSize(val: string | number): void {
    this.cs.setSnapSize(Number(val) || 1);
  }

  protected setImportPromptForDirectory(value: boolean): void {
    this.cs.setImportPromptForDirectory(value);
  }

  protected setProjectDirectoryAutoSyncEnabled(value: boolean): void {
    this.cs.setProjectDirectoryAutoSyncEnabled(value);
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
    const width = this.readInputNumber(event);
    if (width === null) {
      return;
    }

    this.setCanvasDimension('width', width);
  }

  protected onCanvasHeightChange(event: Event): void {
    const height = this.readInputNumber(event);
    if (height === null) {
      return;
    }

    this.setCanvasDimension('height', height);
  }

  protected setContentType(value: string | number): void {
    if (value !== 'text' && value !== 'image' && value !== 'video') {
      return;
    }

    this.cs.setSelectedWidgetContentType(value);
  }

  protected onTextChange(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.cs.setSelectedWidgetText(value);
  }

  protected onTextFontSizeChange(event: Event): void {
    const value = this.readInputNumber(event);
    if (value === null) {
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

   protected setTextBold(value: boolean): void {
     this.cs.setSelectedWidgetTextBold(value);
   }

   protected setTextItalic(value: boolean): void {
     this.cs.setSelectedWidgetTextItalic(value);
   }

    protected setTextUnderline(value: boolean): void {
      this.cs.setSelectedWidgetTextUnderline(value);
    }

    protected setTextAutoSize(value: boolean): void {
      this.cs.setSelectedWidgetTextAutoSize(value);
    }

      protected onTextLineHeightChange(event: Event): void {
       const value = this.readInputNumber(event);
       if (value === null) {
         return;
       }

       this.cs.setSelectedWidgetTextLineHeight(value);
     }

     protected get selectedTextShadowColor(): string {
       const textContent = this.selectedTextContent;
       return textContent?.style.textShadowColor ?? '#000000';
     }

     protected get selectedTextShadowBlur(): number {
       const textContent = this.selectedTextContent;
       return textContent?.style.textShadowBlur ?? 0;
     }

     protected get selectedTextShadowOffsetX(): number {
       const textContent = this.selectedTextContent;
       return textContent?.style.textShadowOffsetX ?? 0;
     }

     protected get selectedTextShadowOffsetY(): number {
       const textContent = this.selectedTextContent;
       return textContent?.style.textShadowOffsetY ?? 0;
     }

     protected get hasTextShadow(): boolean {
       const textContent = this.selectedTextContent;
       return (textContent?.style.textShadowBlur ?? 0) > 0;
     }

     protected onTextShadowColorChange(event: Event): void {
       const color = (event.target as HTMLInputElement).value;
       this.cs.setSelectedWidgetTextShadowColor(color);
     }

     protected onTextShadowBlurChange(event: Event): void {
       const value = this.readInputNumber(event);
       if (value !== null) { this.cs.setSelectedWidgetTextShadowBlur(value); }
     }

     protected onTextShadowOffsetXChange(event: Event): void {
       const value = this.readInputNumber(event);
       if (value !== null) { this.cs.setSelectedWidgetTextShadowOffsetX(value); }
     }

     protected onTextShadowOffsetYChange(event: Event): void {
       const value = this.readInputNumber(event);
       if (value !== null) { this.cs.setSelectedWidgetTextShadowOffsetY(value); }
     }

   protected openImageFilePicker(input: HTMLInputElement): void {
      this.resetAndOpenFilePicker(input);
  }

  protected async onImageFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    await this.importImageFile(file);
  }

  protected onImageDropzoneDragOver(event: DragEvent): void {
    this.handleDropzoneDragOver(event, this.isImageDropzoneActive);
  }

  protected onImageDropzoneDragLeave(event: DragEvent): void {
    this.handleDropzoneDragLeave(event, this.isImageDropzoneActive);
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
      this.imageUrlError.set('Enter a valid image URL.');
      return;
    }

    this.isImageUrlSaving.set(true);

    try {
      await this.cs.setSelectedWidgetImageFromUrl(url);
      this.isImageUrlSaving.set(false);
      this.closeImageUrlModal();
    } catch {
      this.imageUrlError.set('Unable to download the image from this URL (check CORS/URL).');
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

  private async importVideoFile(file: File): Promise<void> {
    if (!file.type.startsWith('video/')) {
      return;
    }

    try {
      await this.cs.setSelectedWidgetVideoFromFile(file);
    } catch (err) {
      console.error('[CanvasSettingsPanel] importVideoFile failed:', err);
    }
  }

  protected onImageAltChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cs.setSelectedWidgetImageAlt(value);
  }

  protected setImageFitMode(value: string | number): void {
    if (value !== 'cover' && value !== 'contain' && value !== 'crop') {
      return;
    }

    this.cs.setSelectedWidgetImageFitMode(value);
  }

  // Cover mode offset management for images
  protected setImageCoverAnchor(anchor: MediaAnchor): void {
    const { x, y } = this.getOffsetsFromAnchor(anchor);
    this.cs.setSelectedWidgetImageOffsetX(x);
    this.cs.setSelectedWidgetImageOffsetY(y);
  }

  protected setImageCropAnchor(anchor: MediaAnchor): void {
    this.setImageCoverAnchor(anchor);
  }

  protected onImageOffsetXChange(value: number | Event): void {
    const numericValue = this.resolveNumericInput(value);
    if (numericValue !== null) {
      this.cs.setSelectedWidgetImageOffsetX(numericValue);
    }
  }

  protected onImageOffsetYChange(value: number | Event): void {
    const numericValue = this.resolveNumericInput(value);
    if (numericValue !== null) {
      this.cs.setSelectedWidgetImageOffsetY(numericValue);
    }
  }

  protected onImageCropZoomChange(value: number | Event): void {
    const numericValue = this.resolveNumericInput(value);
    if (numericValue !== null) {
      this.cs.setSelectedWidgetImageCropZoom(numericValue);
    }
  }

  protected onVideoPosterChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cs.setSelectedWidgetVideoPoster(value);
  }

  protected setVideoFitMode(value: string | number): void {
    if (value !== 'cover' && value !== 'contain' && value !== 'crop') {
      return;
    }

    this.cs.setSelectedWidgetVideoFitMode(value);
  }

  // Cover mode offset management for videos
  protected setVideoCoverAnchor(anchor: MediaAnchor): void {
    const { x, y } = this.getOffsetsFromAnchor(anchor);
    this.cs.setSelectedWidgetVideoOffsetX(x);
    this.cs.setSelectedWidgetVideoOffsetY(y);
  }

  protected setVideoCropAnchor(anchor: MediaAnchor): void {
    this.setVideoCoverAnchor(anchor);
  }

   protected onVideoOffsetXChange(value: number | Event): void {
     const numericValue = this.resolveNumericInput(value);
     if (numericValue !== null) {
       this.cs.setSelectedWidgetVideoOffsetX(numericValue);
     }
   }

   protected onVideoOffsetYChange(value: number | Event): void {
     const numericValue = this.resolveNumericInput(value);
     if (numericValue !== null) {
       this.cs.setSelectedWidgetVideoOffsetY(numericValue);
     }
   }

   protected onVideoCropZoomChange(value: number | Event): void {
     const numericValue = this.resolveNumericInput(value);
     if (numericValue !== null) {
       this.cs.setSelectedWidgetVideoCropZoom(numericValue);
     }
   }

  protected setVideoAutoplay(value: boolean): void {
    this.cs.setSelectedWidgetVideoAutoplay(value);
  }

  protected setVideoLoop(value: boolean): void {
    this.cs.setSelectedWidgetVideoLoop(value);
  }

  protected setVideoMuted(value: boolean): void {
    this.cs.setSelectedWidgetVideoMuted(value);
  }

  protected setVideoControls(value: boolean): void {
    this.cs.setSelectedWidgetVideoControls(value);
  }

  protected toggleSelectedVideoPlayback(): void {
    const widget = this.selectedWidget;
    if (!widget || widget.content.type !== 'video') {
      return;
    }

    this.cs.toggleWidgetVideoPlayback(widget.uuid);
  }

  protected onVideoSeekInput(event: Event): void {
    const widget = this.selectedWidget;
    if (!widget || widget.content.type !== 'video') {
      return;
    }

    const time = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(time)) {
      this.cs.seekWidgetVideo(widget.uuid, time);
    }
  }

  protected onVideoVolumeInput(event: Event): void {
    const widget = this.selectedWidget;
    if (!widget || widget.content.type !== 'video') {
      return;
    }

    const volume = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(volume)) {
      this.cs.setWidgetVideoVolume(widget.uuid, volume);
    }
  }

  protected openVideoFilePicker(input: HTMLInputElement): void {
    this.resetAndOpenFilePicker(input);
  }

  protected async onVideoFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    await this.importVideoFile(file);
  }

  protected onVideoDropzoneDragOver(event: DragEvent): void {
    this.handleDropzoneDragOver(event, this.isVideoDropzoneActive);
  }

  protected onVideoDropzoneDragLeave(event: DragEvent): void {
    this.handleDropzoneDragLeave(event, this.isVideoDropzoneActive);
  }

  protected async onVideoDropzoneDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isVideoDropzoneActive.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }

    await this.importVideoFile(file);
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

  protected onWidgetBackgroundOpacityChange(event: Event): void {
    const value = this.readInputNumber(event);
    if (value === null) {
      return;
    }

    this.cs.setSelectedWidgetBackgroundOpacity(value);
  }

  private parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
    const value = color.trim();
    if (!value) {
      return null;
    }

    const hex = value.match(/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i);
    if (hex) {
      const raw = hex[1];
      if (raw.length === 3) {
        return {
          r: Number.parseInt(raw[0] + raw[0], 16),
          g: Number.parseInt(raw[1] + raw[1], 16),
          b: Number.parseInt(raw[2] + raw[2], 16),
        };
      }

      return {
        r: Number.parseInt(raw.slice(0, 2), 16),
        g: Number.parseInt(raw.slice(2, 4), 16),
        b: Number.parseInt(raw.slice(4, 6), 16),
      };
    }

    const rgb = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i);
    if (!rgb) {
      return null;
    }

    return {
      r: Math.max(0, Math.min(255, Number(rgb[1]))),
      g: Math.max(0, Math.min(255, Number(rgb[2]))),
      b: Math.max(0, Math.min(255, Number(rgb[3]))),
    };
  }

  private rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
    return `#${this.toHexByte(r)}${this.toHexByte(g)}${this.toHexByte(b)}`;
  }

  private toHexByte(value: number): string {
    return Math.round(value).toString(16).padStart(2, '0');
  }

  protected onBorderRadiusChange(event: Event): void {
    const value = this.readInputNumber(event);
    if (value !== null) { this.cs.setSelectedWidgetBorderRadius(value); }
  }

  protected onBorderWidthChange(event: Event): void {
    const value = this.readInputNumber(event);
    if (value !== null) { this.cs.setSelectedWidgetBorderWidth(value); }
  }

  protected onBorderColorChange(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    this.cs.setSelectedWidgetBorderColor(color);
  }

  protected setBorderStyle(style: WidgetBorderStyle): void {
    this.cs.setSelectedWidgetBorderStyle(style);
    // If style is enabled and width is zero, apply a default border width.
    if (style !== 'none' && !this.hasBorder) {
      this.cs.setSelectedWidgetBorderWidth(1);
    }
  }

   protected onPaddingChange(event: Event): void {
     const value = this.readInputNumber(event);
     if (value !== null) { this.cs.setSelectedWidgetPadding(value); }
   }

   protected onShadowColorChange(event: Event): void {
     const color = (event.target as HTMLInputElement).value;
     this.cs.setSelectedWidgetShadowColor(color);
   }

   protected onShadowBlurChange(event: Event): void {
     const value = this.readInputNumber(event);
     if (value !== null) { this.cs.setSelectedWidgetShadowBlur(value); }
   }

   protected onShadowOffsetXChange(event: Event): void {
     const value = this.readInputNumber(event);
     if (value !== null) { this.cs.setSelectedWidgetShadowOffsetX(value); }
   }

   protected onShadowOffsetYChange(event: Event): void {
     const value = this.readInputNumber(event);
     if (value !== null) { this.cs.setSelectedWidgetShadowOffsetY(value); }
   }

   protected setWidgetLocked(value: boolean): void {
    this.cs.setSelectedWidgetLocked(value);
  }

  protected setWidgetVisible(value: boolean): void {
    this.cs.setSelectedWidgetVisible(value);
  }

  protected onWidgetOpacityChange(event: Event): void {
    const value = this.readInputNumber(event);
    if (value === null) {
      return;
    }

    this.cs.setSelectedWidgetOpacity(value);
  }

  protected onTimelineStartInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.timelineDraft.update(d => ({ ...d, start: value }));
  }

  protected onTimelineEndInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.timelineDraft.update(d => ({ ...d, end: value }));
  }

  protected commitTimelineStart(event: Event): void {
    const input = event.target as HTMLInputElement;
    const widget = this.selectedWidget;
    if (!widget) return;
    const sec = Number(input.value);
    if (!Number.isFinite(sec)) {
      this.timelineDraft.update(d => ({ ...d, start: String((widget.timelineStart ?? 0) / 1000) }));
      return;
    }
    const endMs = widget.timelineEnd ?? this.timelineService.duration();
    this.timelineService.updateLayerTiming(widget.uuid, sec * 1000, endMs);
  }

  protected commitTimelineEnd(event: Event): void {
    const input = event.target as HTMLInputElement;
    const widget = this.selectedWidget;
    if (!widget) return;
    const sec = Number(input.value);
    if (!Number.isFinite(sec)) {
      const duration = this.timelineService.duration();
      this.timelineDraft.update(d => ({ ...d, end: String((widget.timelineEnd ?? duration) / 1000) }));
      return;
    }
    const startMs = widget.timelineStart ?? 0;
    this.timelineService.updateLayerTiming(widget.uuid, startMs, sec * 1000);
  }

  protected onTimelineStartEnter(event: Event): void {
    event.preventDefault();
    this.commitTimelineStart(event);
    (event.target as HTMLInputElement).focus();
  }

  protected onTimelineEndEnter(event: Event): void {
    event.preventDefault();
    this.commitTimelineEnd(event);
    (event.target as HTMLInputElement).focus();
  }

  protected deleteSelectedWidget(): void {
    this.cs.deleteSelectedWidget();
  }

  protected duplicateSelectedWidget(): void {
    this.cs.duplicateSelectedWidget();
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

    this.commitWidgetGeometryValue(field, value);

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

  private getOffsetsFromAnchor(anchor: MediaAnchor): { x: number; y: number } {
    return CanvasSettingsPanelComponent.MEDIA_ANCHOR_OFFSETS[anchor];
  }

  private readInputNumber(event: Event): number | null {
    const value = Number((event.target as HTMLInputElement).value);
    return Number.isFinite(value) ? value : null;
  }

  private resetAndOpenFilePicker(input: HTMLInputElement): void {
    input.value = '';
    input.click();
  }

  private handleDropzoneDragOver(event: DragEvent, isActive: { set: (value: boolean) => void }): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    isActive.set(true);
  }

  private handleDropzoneDragLeave(event: DragEvent, isActive: { set: (value: boolean) => void }): void {
    event.preventDefault();
    isActive.set(false);
  }

  private setCanvasDimension(dimension: 'width' | 'height', value: number): void {
    this.cs.canvasResize({ [dimension]: value });
  }

  private commitWidgetGeometryValue(field: WidgetGeometryField, value: number): void {
    switch (field) {
      case 'x':
        this.cs.setSelectedWidgetX(value);
        return;
      case 'y':
        this.cs.setSelectedWidgetY(value);
        return;
      case 'width':
        this.cs.setSelectedWidgetWidth(value);
        return;
      case 'height':
        this.cs.setSelectedWidgetHeight(value);
        return;
    }
  }

  private resolveNumericInput(value: number | Event): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    return this.readInputNumber(value);
  }

  // --- Timeline duration helpers ---

  private static msToDurationParts(ms: number): { hours: string; minutes: string; seconds: string; tenths: string } {
    const total = Math.max(0, ms);
    const hours = Math.floor(total / 3_600_000);
    const minutes = Math.floor((total % 3_600_000) / 60_000);
    const seconds = Math.floor((total % 60_000) / 1_000);
    const tenths = Math.floor((total % 1_000) / 100);
    return { hours: String(hours), minutes: String(minutes), seconds: String(seconds), tenths: String(tenths) };
  }

  private static durationPartsToMs(hours: number, minutes: number, seconds: number, tenths: number): number {
    return (
      Math.max(0, hours) * 3_600_000 +
      Math.max(0, minutes) * 60_000 +
      Math.max(0, seconds) * 1_000 +
      Math.max(0, tenths) * 100
    );
  }

  protected onDurationPartInput(event: Event, part: 'hours' | 'minutes' | 'seconds' | 'tenths'): void {
    const value = (event.target as HTMLInputElement).value;
    this.durationDraft.update(d => ({ ...d, [part]: value }));
  }

  protected commitDuration(): void {
    const d = this.durationDraft();
    const hours = Number(d.hours);
    const minutes = Number(d.minutes);
    const seconds = Number(d.seconds);
    const tenths = Number(d.tenths);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds) || !Number.isFinite(tenths)) {
      // Revert draft to current service value
      this.durationDraft.set(CanvasSettingsPanelComponent.msToDurationParts(this.timelineService.duration()));
      return;
    }

    const ms = CanvasSettingsPanelComponent.durationPartsToMs(hours, minutes, seconds, tenths);
    if (ms < 1000) {
      // Minimum 1 second — revert
      this.durationDraft.set(CanvasSettingsPanelComponent.msToDurationParts(this.timelineService.duration()));
      return;
    }

    this.timelineService.setDuration(ms);
  }

  protected onDurationPartEnter(event: Event): void {
    event.preventDefault();
    this.commitDuration();
    (event.target as HTMLInputElement).blur();
  }
}
