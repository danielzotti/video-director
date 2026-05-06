import {ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CanvasWidgetStateService} from '../../services/canvas-widget-state.service';
import {CanvasService} from '../../services/canvas.service';
import {UiIconComponent} from '../../ui';
import type {UiIconName} from '../../ui';

@Component({
    selector: 'app-canvas-layers-panel',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, UiIconComponent],
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
    maxHeight = input<string | null>(null);
    closed = output<void>();

    protected widgetList = this.widgetsState.list;
    protected displayedLayers = computed(() => [...this.widgetList()].sort((a, b) => b.z - a.z));

    protected draggedLayerId: string | null = null;
    protected dragOverLayerId: string | null = null;
    protected renamingLayerId: string | null = null;
    protected renameInput = '';

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
        const panel = handle.closest<HTMLElement>('.layers-panel');
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

    protected get isPopoverMode(): boolean {
        return this.panelMode() === 'popover';
    }

    protected get isSidebarMode(): boolean {
        return this.panelMode() === 'sidebar';
    }

    protected getLayerDisplayName(uuid: string): string {
        const widget = this.widgetsState.getById(uuid);
        if (!widget) return `Layer ${uuid}`;
        return widget.name || widget.content?.type || `Layer ${widget.uuid}`;
    }

    protected getLayerContentIcon(uuid: string): UiIconName {
        const widget = this.widgetsState.getById(uuid);
        if (!widget) return 'info';
        return widget.content.type === 'text' ? 'text' : 'image';
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

        if (widget.content.type === 'image') {
            return (widget.content.src || '').trim();
        }

        return widget.uuid;
    }

    private getImageFileName(src: string): string {
        const value = (src || '').trim();
        if (!value) {
            return 'Immagine senza nome';
        }

        try {
            const url = new URL(value);
            const pathSegments = url.pathname.split('/').filter(Boolean);
            return pathSegments.at(-1) || 'Immagine senza nome';
        } catch {
            const pathSegments = value.split('/').filter(Boolean);
            return pathSegments.at(-1) || 'Immagine senza nome';
        }
    }

    protected onLayerClick(uuid: string, event: MouseEvent): void {
        event.stopPropagation();
        this.cs.selectWidget(uuid);
    }

    protected isLayerLocked(uuid: string): boolean {
        return !!this.widgetsState.getById(uuid)?.locked;
    }

    protected isLayerVisible(uuid: string): boolean {
        return this.widgetsState.getById(uuid)?.visible ?? true;
    }

    protected toggleLayerLocked(uuid: string, event: MouseEvent): void {
        event.stopPropagation();
        this.cs.setWidgetLocked(uuid, !this.isLayerLocked(uuid));
    }

    protected toggleLayerVisible(uuid: string, event: MouseEvent): void {
        event.stopPropagation();
        this.cs.setWidgetVisible(uuid, !this.isLayerVisible(uuid));
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
        this.dragOverLayerId = uuid;
    }

    protected onLayerDragLeave(event: DragEvent): void {
        event.stopPropagation();
        this.dragOverLayerId = null;
    }

    protected onLayerDrop(targetUuid: string, event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();

        if (!this.draggedLayerId || this.draggedLayerId === targetUuid) {
            this.draggedLayerId = null;
            this.dragOverLayerId = null;
            return;
        }

        const displayed = this.displayedLayers();
        const sourceDisplayedIndex = displayed.findIndex(w => w.uuid === this.draggedLayerId);
        const targetDisplayedIndex = displayed.findIndex(w => w.uuid === targetUuid);

        if (sourceDisplayedIndex < 0 || targetDisplayedIndex < 0) {
            return;
        }

        // Drop non dipende più dalla metà del layer: l'hover completo inserisce prima del target.
        // Comportamento naturale drag&drop: quando vai dall'alto al basso inserisci DOPO il target,
        // quando vai dal basso all'alto inserisci PRIMA del target.
        const targetInsertionIndex = sourceDisplayedIndex < targetDisplayedIndex
            ? targetDisplayedIndex + 1
            : targetDisplayedIndex;
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
    }

    protected onLayerDragEnd(event: DragEvent): void {
        event.stopPropagation();
        this.draggedLayerId = null;
        this.dragOverLayerId = null;
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

