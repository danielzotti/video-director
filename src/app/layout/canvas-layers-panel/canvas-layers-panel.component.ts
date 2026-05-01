import {ChangeDetectionStrategy, Component, computed, inject, input, output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CanvasWidgetStateService} from '../../services/canvas-widget-state.service';
import {CanvasService} from '../../services/canvas.service';

@Component({
  selector: 'app-canvas-layers-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './canvas-layers-panel.component.html',
  styleUrl: './canvas-layers-panel.component.scss',
})
export class CanvasLayersPanelComponent {
  private readonly widgetsState = inject(CanvasWidgetStateService);
  protected readonly cs = inject(CanvasService);

  isOpen = input<boolean>(false);
  showBackdrop = input<boolean>(true);
  panelMode = input<'popover' | 'sidebar'>('popover');
  title = input<string>('Layers');
  closed = output<void>();

  protected widgetList = this.widgetsState.list;
  protected displayedLayers = computed(() => [...this.widgetList()].sort((a, b) => b.z - a.z));

  protected draggedLayerId: string | null = null;
  protected dragOverLayerId: string | null = null;
  protected dropPosition: 'above' | 'below' | null = null;
  protected renamingLayerId: string | null = null;
  protected renameInput = '';

  protected get isPopoverMode(): boolean {
    return this.panelMode() === 'popover';
  }

  protected get isSidebarMode(): boolean {
    return this.panelMode() === 'sidebar';
  }

  protected getLayerDisplayName(uuid: string): string {
    const widget = this.widgetsState.getById(uuid);
    if (!widget) return `Layer ${uuid}`;
    return widget.name || `Layer ${widget.uuid}`;
  }

  protected getLayerContentIcon(uuid: string): string {
    const widget = this.widgetsState.getById(uuid);
    if (!widget) return '?';
    return widget.content.type === 'text' ? 'T' : '🖼';
  }

  protected getLayerContentType(uuid: string): string {
    const widget = this.widgetsState.getById(uuid);
    if (!widget) return 'unknown';
    return widget.content.type;
  }

  protected getLayerPreview(uuid: string): string {
    const widget = this.widgetsState.getById(uuid);
    if (!widget) {
      return '';
    }

    if (widget.content.type === 'text') {
      return (widget.content.text || '').trim();
    }

    return this.getImageFileName(widget.content.src);
  }

  private getImageFileName(src: string): string {
    const value = (src || '').trim();
    if (!value) {
      return 'Immagine senza nome';
    }

    try {
      const url = new URL(value);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      return pathSegments[pathSegments.length - 1] || 'Immagine senza nome';
    } catch {
      const pathSegments = value.split('/').filter(Boolean);
      return pathSegments[pathSegments.length - 1] || 'Immagine senza nome';
    }
  }

  protected onLayerClick(uuid: string, event: MouseEvent): void {
    event.stopPropagation();
    this.cs.selectWidget(uuid);
  }

  protected onLayerDragStart(uuid: string, event: DragEvent): void {
    event.stopPropagation();
    this.draggedLayerId = uuid;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', uuid);
    }
  }

  protected onLayerDragOver(uuid: string, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const targetElement = event.currentTarget as HTMLElement | null;
    const rect = targetElement?.getBoundingClientRect();
    const isAboveHalf = rect ? event.clientY < rect.top + rect.height / 2 : false;

    this.dragOverLayerId = uuid;
    this.dropPosition = isAboveHalf ? 'above' : 'below';
  }

  protected onLayerDragLeave(event: DragEvent): void {
    event.stopPropagation();
    this.dragOverLayerId = null;
    this.dropPosition = null;
  }

   protected onLayerDrop(targetUuid: string, event: DragEvent): void {
     event.preventDefault();
     event.stopPropagation();

     if (!this.draggedLayerId || this.draggedLayerId === targetUuid) {
       this.draggedLayerId = null;
       this.dragOverLayerId = null;
       this.dropPosition = null;
       return;
     }

     const displayed = this.displayedLayers();
     const sourceDisplayedIndex = displayed.findIndex(w => w.uuid === this.draggedLayerId);
     const targetDisplayedIndex = displayed.findIndex(w => w.uuid === targetUuid);

     if (sourceDisplayedIndex < 0 || targetDisplayedIndex < 0) {
       return;
     }

     const targetInsertionIndex = targetDisplayedIndex + (this.dropPosition === 'below' ? 1 : 0);
     const withoutSource = displayed.filter(w => w.uuid !== this.draggedLayerId);

     const adjustedInsertionIndex = sourceDisplayedIndex < targetInsertionIndex
       ? targetInsertionIndex - 1
       : targetInsertionIndex;

     const clampedInsertionIndex = Math.max(0, Math.min(adjustedInsertionIndex, withoutSource.length));
     const reorderedDisplayed = [
       ...withoutSource.slice(0, clampedInsertionIndex),
       displayed[sourceDisplayedIndex],
       ...withoutSource.slice(clampedInsertionIndex),
     ];

     const sourceNewDisplayedIndex = reorderedDisplayed.findIndex(w => w.uuid === this.draggedLayerId);
     if (sourceNewDisplayedIndex < 0) {
       return;
     }

     // reorderLayerToIndex usa indice con ordine crescente (z basso -> z alto)
     const nextAscendingIndex = reorderedDisplayed.length - 1 - sourceNewDisplayedIndex;
     this.widgetsState.reorderLayerToIndex(this.draggedLayerId, nextAscendingIndex);

     this.draggedLayerId = null;
     this.dragOverLayerId = null;
     this.dropPosition = null;
   }

  protected onLayerDragEnd(event: DragEvent): void {
    event.stopPropagation();
    this.draggedLayerId = null;
    this.dragOverLayerId = null;
    this.dropPosition = null;
  }

  protected startRename(uuid: string, event: MouseEvent): void {
    event.stopPropagation();
    const widget = this.widgetsState.getById(uuid);
    if (!widget) return;

    this.renamingLayerId = uuid;
    this.renameInput = widget.name || '';

    setTimeout(() => {
      const input = document.querySelector(`input[data-uuid="${uuid}"]`) as HTMLInputElement | null;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  protected finishRename(uuid: string): void {
    if (this.renamingLayerId === uuid) {
      this.widgetsState.renameLayer(uuid, this.renameInput.trim());
      this.renamingLayerId = null;
      this.renameInput = '';
    }
  }

  protected cancelRename(): void {
    this.renamingLayerId = null;
    this.renameInput = '';
  }

  protected onRenameKeydown(event: KeyboardEvent, uuid: string): void {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      this.finishRename(uuid);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelRename();
    }
  }

  protected moveLayerUp(uuid: string, event: MouseEvent): void {
    event.stopPropagation();
    this.widgetsState.moveLayerUp(uuid);
  }

  protected moveLayerDown(uuid: string, event: MouseEvent): void {
    event.stopPropagation();
    this.widgetsState.moveLayerDown(uuid);
  }

  protected moveLayerToFront(uuid: string, event: MouseEvent): void {
    event.stopPropagation();
    this.widgetsState.moveLayerToFront(uuid);
  }

  protected moveLayerToBack(uuid: string, event: MouseEvent): void {
    event.stopPropagation();
    this.widgetsState.moveLayerToBack(uuid);
  }
}

