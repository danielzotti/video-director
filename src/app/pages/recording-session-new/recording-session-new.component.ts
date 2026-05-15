import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    ElementRef,
    HostListener,
    inject,
    signal,
    viewChild
} from '@angular/core';
import {v4 as uuid} from 'uuid';
import {WidgetComponent} from '../../components/widget/widget.component';
import {CanvasWidgetDirective} from '../../directives/canvas-widget.directive';
import {CanvasDirective} from '../../directives/canvas.directive';
import {StreamStateItem} from '../../models/stream.model';
import {CanvasWidgetStateService} from '../../services/canvas-widget-state.service';
import {CanvasService} from '../../services/canvas.service';
import {StreamStateService} from '../../services/stream-state.service';
import {CanvasDebugPanelComponent} from '../../components/canvas-debug-panel/canvas-debug-panel.component';
import {CanvasSettingsPanelComponent} from '../../layout/canvas-settings-panel/canvas-settings-panel.component';
import {CanvasLayersPanelComponent} from '../../layout/canvas-layers-panel/canvas-layers-panel.component';
import {CanvasToolbarComponent} from '../../layout/canvas-toolbar/canvas-toolbar.component';
import {ActionsToolbarComponent} from '../../layout/actions-toolbar/actions-toolbar.component';
import {WidgetCreateToolbarComponent} from '../../layout/widget-create-toolbar/widget-create-toolbar.component';
import {TimelinePanelComponent} from '../../components/timeline/timeline-panel/timeline-panel.component';
import {Point2D} from '../../models/geometry.models';

@Component({
    selector: 'app-recording-session-new',
    standalone: true,
    imports: [
        WidgetComponent,
        CanvasDirective,
        CanvasWidgetDirective,
        CanvasDebugPanelComponent,
        CanvasSettingsPanelComponent,
        CanvasLayersPanelComponent,
        CanvasToolbarComponent,
        ActionsToolbarComponent,
        WidgetCreateToolbarComponent,
        TimelinePanelComponent,
    ],
    templateUrl: './recording-session-new.component.html',
    styleUrl: './recording-session-new.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordingSessionNewComponent {
    streamStateService = inject(StreamStateService);
    widgetStateService = inject(CanvasWidgetStateService);
    public canvasService = inject(CanvasService);
    private readonly editorContentRef = viewChild<ElementRef<HTMLElement>>('editorContent');
    private readonly floatingPanelRef = viewChild<ElementRef<HTMLElement>>('floatingPanel');
    private readonly floatingLayersPanelRef = viewChild<ElementRef<HTMLElement>>('floatingLayersPanel');

    protected readonly floatingPanelPosition = signal<Point2D>({x: 0, y: 0});
    protected readonly floatingLayersPanelPosition = signal<Point2D>({x: 0, y: 0});
    protected readonly isProjectDirectoryPromptOpen = signal(false);

    // Min height for panels: enough to show header (~50px) + some content
    private readonly minPanelHeight = 120;
    private readonly panelMarginBottom = 12;

    protected readonly floatingPanelMaxHeight = computed(() => {
        const boundaryEl = this.editorContentRef()?.nativeElement;
        if (!boundaryEl) return 'auto';

        const boundaryRect = boundaryEl.getBoundingClientRect();
        const panelY = this.floatingPanelPosition().y;

        // Available height = boundary height - panel top position - bottom margin
        const availableHeight = boundaryRect.height - panelY - this.panelMarginBottom;

        // Use max of available or min height
        const maxHeight = Math.max(this.minPanelHeight, availableHeight);

        return `${maxHeight}px`;
    });

    protected readonly floatingLayersPanelMaxHeight = computed(() => {
        const boundaryEl = this.editorContentRef()?.nativeElement;
        if (!boundaryEl) return 'auto';

        const boundaryRect = boundaryEl.getBoundingClientRect();
        const panelY = this.floatingLayersPanelPosition().y;

        // Available height = boundary height - panel top position - bottom margin
        const availableHeight = boundaryRect.height - panelY - this.panelMarginBottom;

        // Use max of available or min height
        const maxHeight = Math.max(this.minPanelHeight, availableHeight);

        return `${maxHeight}px`;
    });

    private floatingPanelDragOffset: Point2D | null = null;
    private isFloatingPanelDragging = false;
    private hasFloatingPanelPosition = false;
    private readonly floatingPanelMargin = 12;

    private floatingLayersPanelDragOffset: Point2D | null = null;
    private isFloatingLayersPanelDragging = false;
    private hasFloatingLayersPanelPosition = false;
    private readonly floatingLayersPanelMargin = 12;
    private hasInitialCanvasCentered = false;
    private hasProjectDirectoryPromptBeenEvaluated = false;

    streamList = computed(() => this.streamStateService.list());
    widgetList = computed(() => this.widgetStateService.list());

    lastUpdate = computed(() => this.streamStateService.lastUpdate());

    constructor() {
        effect(() => {
            this.lastUpdate();
        });

        effect(() => {
            if (this.canvasService.settingsPanelLayout() !== 'floating') {
                this.isFloatingPanelDragging = false;
                this.floatingPanelDragOffset = null;
                return;
            }

            requestAnimationFrame(() => {
                this.initializeOrClampFloatingPanel();
            });
        });

        effect(() => {
            if (this.canvasService.layersPanelLayout() !== 'floating') {
                this.isFloatingLayersPanelDragging = false;
                this.floatingLayersPanelDragOffset = null;
                return;
            }

            requestAnimationFrame(() => {
                this.initializeOrClampFloatingLayersPanel();
            });
        });

        effect(() => {
            if (!this.canvasService.canManageCanvas() || this.hasInitialCanvasCentered) {
                return;
            }

            this.hasInitialCanvasCentered = true;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.canvasService.canvasCenter();
                });
            });
        });

        effect(() => {
            if (this.hasProjectDirectoryPromptBeenEvaluated) {
                return;
            }

            if (!this.canvasService.projectDirectoryRestoreReady()) {
                return;
            }

            this.hasProjectDirectoryPromptBeenEvaluated = true;

            // Restore from the best available backend (IndexedDB > localStorage).
            void this.canvasService.restoreFromPersistenceBackends();

            // Show the folder-sync prompt on EVERY refresh when:
            //  • File System Access API is supported
            //  • No folder is already connected
            // If the API is not supported, IndexedDB is used silently.
            if (!this.canvasService.isProjectDirectorySyncSupported()) {
                return;
            }

            if (this.canvasService.isProjectDirectoryConnected()) {
                return;
            }

            this.isProjectDirectoryPromptOpen.set(true);
        });
    }

    protected async connectProjectDirectoryFromPrompt(): Promise<void> {
        try {
            await this.canvasService.connectProjectDirectory();
            this.isProjectDirectoryPromptOpen.set(false);
        } catch (error) {
            if ((error as DOMException)?.name === 'AbortError') {
                return;
            }

            console.error('[RecordingSessionNew] connectProjectDirectoryFromPrompt failed:', error);
        }
    }

    protected dismissProjectDirectoryPrompt(): void {
        // User chose IndexedDB for this session – just close the prompt.
        // It will reappear on the next page refresh (by design).
        this.isProjectDirectoryPromptOpen.set(false);
    }

    protected closeProjectDirectoryPrompt(): void {
        this.isProjectDirectoryPromptOpen.set(false);
    }


    protected onFloatingPanelPointerDown(event: PointerEvent): void {
        if (this.canvasService.settingsPanelLayout() !== 'floating' || event.button !== 0) {
            return;
        }

        const target = event.target as HTMLElement | null;
        if (!target?.closest('.settings-panel__header')) {
            return;
        }

        const boundaryEl = this.editorContentRef()?.nativeElement;
        const panelEl = this.floatingPanelRef()?.nativeElement;
        if (!boundaryEl || !panelEl) {
            return;
        }

        const boundaryRect = boundaryEl.getBoundingClientRect();
        const panelRect = panelEl.getBoundingClientRect();

        this.isFloatingPanelDragging = true;
        this.floatingPanelDragOffset = {
            x: event.clientX - panelRect.left,
            y: event.clientY - panelRect.top,
        };

        const nextPosition = this.getClampedFloatingPanelPosition(
            {
                x: event.clientX - boundaryRect.left - this.floatingPanelDragOffset.x,
                y: event.clientY - boundaryRect.top - this.floatingPanelDragOffset.y,
            },
            boundaryRect,
            panelRect,
        );

        this.floatingPanelPosition.set(nextPosition);
        event.preventDefault();
    }

    private onWindowPointerMove(event: PointerEvent): void {
        if (!this.isFloatingPanelDragging || !this.floatingPanelDragOffset) {
            return;
        }

        const boundaryEl = this.editorContentRef()?.nativeElement;
        const panelEl = this.floatingPanelRef()?.nativeElement;
        if (!boundaryEl || !panelEl) {
            return;
        }

        const boundaryRect = boundaryEl.getBoundingClientRect();
        const panelRect = panelEl.getBoundingClientRect();

        const nextPosition = this.getClampedFloatingPanelPosition(
            {
                x: event.clientX - boundaryRect.left - this.floatingPanelDragOffset.x,
                y: event.clientY - boundaryRect.top - this.floatingPanelDragOffset.y,
            },
            boundaryRect,
            panelRect,
        );

        this.floatingPanelPosition.set(nextPosition);
    }

    private onWindowPointerUp(): void {
        this.isFloatingPanelDragging = false;
        this.floatingPanelDragOffset = null;
    }

    private onWindowResize(): void {
        if (this.canvasService.settingsPanelLayout() !== 'floating') {
            return;
        }

        this.initializeOrClampFloatingPanel();
    }

    private initializeOrClampFloatingPanel(): void {
        const boundaryEl = this.editorContentRef()?.nativeElement;
        const panelEl = this.floatingPanelRef()?.nativeElement;
        if (!boundaryEl || !panelEl) {
            return;
        }

        const boundaryRect = boundaryEl.getBoundingClientRect();
        const panelRect = panelEl.getBoundingClientRect();

        if (!this.hasFloatingPanelPosition) {
            this.hasFloatingPanelPosition = true;
            this.floatingPanelPosition.set(
                this.getClampedFloatingPanelPosition(
                    {
                        x: boundaryRect.width - panelRect.width - this.floatingPanelMargin,
                        y: this.floatingPanelMargin,
                    },
                    boundaryRect,
                    panelRect,
                ),
            );
            return;
        }

        this.floatingPanelPosition.set(
            this.getClampedFloatingPanelPosition(this.floatingPanelPosition(), boundaryRect, panelRect),
        );
    }

    private getClampedFloatingPanelPosition(position: Point2D, boundaryRect: DOMRect, panelRect: DOMRect): Point2D {
        const maxX = Math.max(0, boundaryRect.width - panelRect.width);
        const maxY = Math.max(0, boundaryRect.height - panelRect.height);

        return {
            x: this.clamp(position.x, 0, maxX),
            y: this.clamp(position.y, 0, maxY),
        };
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.round(Math.min(Math.max(value, min), max));
    }

    protected onFloatingLayersPanelPointerDown(event: PointerEvent): void {
        if (this.canvasService.layersPanelLayout() !== 'floating' || event.button !== 0) {
            return;
        }

        const target = event.target as HTMLElement | null;
        if (!target?.closest('.layers-panel__header')) {
            return;
        }

        const boundaryEl = this.editorContentRef()?.nativeElement;
        const panelEl = this.floatingLayersPanelRef()?.nativeElement;
        if (!boundaryEl || !panelEl) {
            return;
        }

        const boundaryRect = boundaryEl.getBoundingClientRect();
        const panelRect = panelEl.getBoundingClientRect();

        this.isFloatingLayersPanelDragging = true;
        this.floatingLayersPanelDragOffset = {
            x: event.clientX - panelRect.left,
            y: event.clientY - panelRect.top,
        };

        const nextPosition = this.getClampedFloatingLayersPanelPosition(
            {
                x: event.clientX - boundaryRect.left - this.floatingLayersPanelDragOffset.x,
                y: event.clientY - boundaryRect.top - this.floatingLayersPanelDragOffset.y,
            },
            boundaryRect,
            panelRect,
        );

        this.floatingLayersPanelPosition.set(nextPosition);
        event.preventDefault();
    }

    @HostListener('window:pointermove', ['$event'])
    protected onWindowPointerMoveHandler(event: PointerEvent): void {
        // Handle layers panel drag
        if (this.isFloatingLayersPanelDragging && this.floatingLayersPanelDragOffset) {
            const boundaryEl = this.editorContentRef()?.nativeElement;
            const panelEl = this.floatingLayersPanelRef()?.nativeElement;
            if (!boundaryEl || !panelEl) {
                return;
            }

            const boundaryRect = boundaryEl.getBoundingClientRect();
            const panelRect = panelEl.getBoundingClientRect();

            const nextPosition = this.getClampedFloatingLayersPanelPosition(
                {
                    x: event.clientX - boundaryRect.left - this.floatingLayersPanelDragOffset.x,
                    y: event.clientY - boundaryRect.top - this.floatingLayersPanelDragOffset.y,
                },
                boundaryRect,
                panelRect,
            );

            this.floatingLayersPanelPosition.set(nextPosition);
        }

        // Handle settings panel drag
        this.onWindowPointerMove(event);
    }

    @HostListener('window:pointerup')
    protected onWindowPointerUpHandler(): void {
        this.isFloatingLayersPanelDragging = false;
        this.floatingLayersPanelDragOffset = null;
        this.onWindowPointerUp();
    }

    @HostListener('window:resize')
    protected onWindowResizeHandler(): void {
        if (this.canvasService.layersPanelLayout() === 'floating') {
            this.initializeOrClampFloatingLayersPanel();
        }

        this.onWindowResize();
    }

    private initializeOrClampFloatingLayersPanel(): void {
        const boundaryEl = this.editorContentRef()?.nativeElement;
        const panelEl = this.floatingLayersPanelRef()?.nativeElement;
        if (!boundaryEl || !panelEl) {
            return;
        }

        const boundaryRect = boundaryEl.getBoundingClientRect();
        const panelRect = panelEl.getBoundingClientRect();

        if (!this.hasFloatingLayersPanelPosition) {
            this.hasFloatingLayersPanelPosition = true;
            this.floatingLayersPanelPosition.set(
                this.getClampedFloatingLayersPanelPosition(
                    {
                        x: this.floatingLayersPanelMargin,
                        y: this.floatingLayersPanelMargin,
                    },
                    boundaryRect,
                    panelRect,
                ),
            );
            return;
        }

        this.floatingLayersPanelPosition.set(
            this.getClampedFloatingLayersPanelPosition(this.floatingLayersPanelPosition(), boundaryRect, panelRect),
        );
    }

    private getClampedFloatingLayersPanelPosition(position: Point2D, boundaryRect: DOMRect, panelRect: DOMRect): Point2D {
        const maxX = Math.max(0, boundaryRect.width - panelRect.width);
        const maxY = Math.max(0, boundaryRect.height - panelRect.height);

        return {
            x: this.clamp(position.x, 0, maxX),
            y: this.clamp(position.y, 0, maxY),
        };
    }


    async newWebcamStream() {
        alert('TODO: newWebcamStream');
    }

    async newCaptureStream() {
        const mediaStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                displaySurface: 'window',
            },
            audio: false,
        });

        const stream: StreamStateItem = {
            uuid: uuid(),
            type: 'screen',
            mediaStream
        };

        this.streamStateService.addStream(stream);
    }

    stopStreamItem(item: StreamStateItem) {
        this.streamStateService.stopStream(item);
    }

    takeScreenshot(item: StreamStateItem) {
        const video: HTMLVideoElement | null = document.getElementById(item.uuid) as HTMLVideoElement;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        canvas.width = (item.mediaStream?.getVideoTracks()?.[0]?.getSettings().width ?? 100);
        canvas.height = (item.mediaStream?.getVideoTracks()?.[0]?.getSettings().height ?? 100);

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataURI = canvas.toDataURL('image/png');

        const a = document.createElement('a');
        a.href = dataURI;
        a.download = `Image${item.mediaStream?.id ? item.mediaStream.id : ''}.png`;
        a.click();
    }

}
