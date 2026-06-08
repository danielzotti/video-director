import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    ElementRef,
    HostListener,
    inject,
    signal,
    viewChild,
    WritableSignal,
} from '@angular/core';
import {WidgetComponent} from '../../components/widget/widget.component';
import {CanvasWidgetDirective} from '../../directives/canvas-widget.directive';
import {CanvasDirective} from '../../directives/canvas.directive';
import {CanvasWidgetStateService} from '../../services/canvas-widget-state.service';
import {CanvasService} from '../../services/canvas.service';
import {CanvasDebugPanelComponent} from '../../components/canvas-debug-panel/canvas-debug-panel.component';
import {CanvasSettingsPanelComponent} from '../../layout/canvas-settings-panel/canvas-settings-panel.component';
import {CanvasLayersPanelComponent} from '../../layout/canvas-layers-panel/canvas-layers-panel.component';
import {CanvasToolbarComponent} from '../../layout/canvas-toolbar/canvas-toolbar.component';
import {ActionsToolbarComponent} from '../../layout/actions-toolbar/actions-toolbar.component';
import {WidgetCreateToolbarComponent} from '../../layout/widget-create-toolbar/widget-create-toolbar.component';
import {TimelinePanelComponent} from '../../components/timeline/timeline-panel/timeline-panel.component';
import {Point2D} from '../../models/geometry.models';
import {ProjectSyncBadgeComponent} from '../../components/project-sync-badge/project-sync-badge.component';
import {TimelineService} from '../../services/timeline.service';
import {isWidgetVisibleInTimelineWindow} from '../../utils/timeline-visibility.utils';

interface FloatingPanelDragState {
    position: WritableSignal<Point2D>;
    dragOffset: Point2D | null;
    isDragging: boolean;
    hasPosition: boolean;
    margin: number;
    headerSelector: string;
    anchor: 'top-left' | 'top-right';
    getPanelElement: () => HTMLElement | null;
}

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
        ProjectSyncBadgeComponent,
    ],
    templateUrl: './recording-session-new.component.html',
    styleUrl: './recording-session-new.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordingSessionNewComponent {
    widgetStateService = inject(CanvasWidgetStateService);
    public canvasService = inject(CanvasService);
    private readonly timelineService = inject(TimelineService);
    private readonly editorContentRef = viewChild<ElementRef<HTMLElement>>('editorContent');
    private readonly floatingPanelRef = viewChild<ElementRef<HTMLElement>>('floatingPanel');
    private readonly floatingLayersPanelRef = viewChild<ElementRef<HTMLElement>>('floatingLayersPanel');

    protected readonly floatingPanelPosition = signal<Point2D>({x: 0, y: 0});
    protected readonly floatingLayersPanelPosition = signal<Point2D>({x: 0, y: 0});
    protected readonly isProjectDirectoryPromptOpen = signal(false);
    protected readonly visibleWidgetIdsAtTimelineTime = computed(() => {
        const currentTime = this.timelineService.time();
        const duration = this.timelineService.duration();

        return new Set(
            this.widgetStateService
                .list()
                .filter(widget => isWidgetVisibleInTimelineWindow({
                    widget,
                    timeMs: currentTime,
                    durationMs: duration,
                }))
                .map(widget => widget.uuid),
        );
    });

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

    private readonly floatingPanelMargin = 12;
    private readonly settingsPanelDragState: FloatingPanelDragState = {
        position: this.floatingPanelPosition,
        dragOffset: null,
        isDragging: false,
        hasPosition: false,
        margin: this.floatingPanelMargin,
        headerSelector: '.settings-panel__header',
        anchor: 'top-right',
        getPanelElement: () => this.floatingPanelRef()?.nativeElement ?? null,
    };
    private readonly layersPanelDragState: FloatingPanelDragState = {
        position: this.floatingLayersPanelPosition,
        dragOffset: null,
        isDragging: false,
        hasPosition: false,
        margin: this.floatingPanelMargin,
        headerSelector: '.layers-panel__header',
        anchor: 'top-left',
        getPanelElement: () => this.floatingLayersPanelRef()?.nativeElement ?? null,
    };
    private hasInitialCanvasCentered = false;
    private hasProjectDirectoryPromptBeenEvaluated = false;


    constructor() {
        effect(() => {
            this.syncFloatingPanelLayout(
                this.canvasService.settingsPanelLayout() === 'floating',
                this.settingsPanelDragState,
            );
        });

        effect(() => {
            this.syncFloatingPanelLayout(
                this.canvasService.layersPanelLayout() === 'floating',
                this.layersPanelDragState,
            );
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
        if (this.canvasService.settingsPanelLayout() !== 'floating') {
            return;
        }

        this.startFloatingPanelDrag(this.settingsPanelDragState, event);
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.round(Math.min(Math.max(value, min), max));
    }

    protected onFloatingLayersPanelPointerDown(event: PointerEvent): void {
        if (this.canvasService.layersPanelLayout() !== 'floating') {
            return;
        }

        this.startFloatingPanelDrag(this.layersPanelDragState, event);
    }

    @HostListener('window:pointermove', ['$event'])
    protected onWindowPointerMoveHandler(event: PointerEvent): void {
        this.moveFloatingPanel(this.layersPanelDragState, event);
        this.moveFloatingPanel(this.settingsPanelDragState, event);
    }

    @HostListener('window:pointerup')
    protected onWindowPointerUpHandler(): void {
        this.stopFloatingPanelDrag(this.layersPanelDragState);
        this.stopFloatingPanelDrag(this.settingsPanelDragState);
    }

    @HostListener('window:resize')
    protected onWindowResizeHandler(): void {
        if (this.canvasService.layersPanelLayout() === 'floating') {
            this.initializeOrClampFloatingPanel(this.layersPanelDragState);
        }

        if (this.canvasService.settingsPanelLayout() === 'floating') {
            this.initializeOrClampFloatingPanel(this.settingsPanelDragState);
        }
    }

    private syncFloatingPanelLayout(isFloating: boolean, state: FloatingPanelDragState): void {
        if (!isFloating) {
            this.stopFloatingPanelDrag(state);
            return;
        }

        requestAnimationFrame(() => {
            this.initializeOrClampFloatingPanel(state);
        });
    }

    private startFloatingPanelDrag(state: FloatingPanelDragState, event: PointerEvent): void {
        if (event.button !== 0) {
            return;
        }

        const target = event.target as HTMLElement | null;
        if (!target?.closest(state.headerSelector)) {
            return;
        }

        const boundaryEl = this.editorContentRef()?.nativeElement;
        const panelEl = state.getPanelElement();
        if (!boundaryEl || !panelEl) {
            return;
        }

        const boundaryRect = boundaryEl.getBoundingClientRect();
        const panelRect = panelEl.getBoundingClientRect();

        state.isDragging = true;
        state.dragOffset = {
            x: event.clientX - panelRect.left,
            y: event.clientY - panelRect.top,
        };

        const nextPosition = this.getClampedFloatingPanelPosition(
            {
                x: event.clientX - boundaryRect.left - state.dragOffset.x,
                y: event.clientY - boundaryRect.top - state.dragOffset.y,
            },
            boundaryRect,
            panelRect,
        );

        state.position.set(nextPosition);
        event.preventDefault();
    }

    private moveFloatingPanel(state: FloatingPanelDragState, event: PointerEvent): void {
        if (!state.isDragging || !state.dragOffset) {
            return;
        }

        const boundaryEl = this.editorContentRef()?.nativeElement;
        const panelEl = state.getPanelElement();
        if (!boundaryEl || !panelEl) {
            return;
        }

        const boundaryRect = boundaryEl.getBoundingClientRect();
        const panelRect = panelEl.getBoundingClientRect();

        const nextPosition = this.getClampedFloatingPanelPosition(
            {
                x: event.clientX - boundaryRect.left - state.dragOffset.x,
                y: event.clientY - boundaryRect.top - state.dragOffset.y,
            },
            boundaryRect,
            panelRect,
        );

        state.position.set(nextPosition);
    }

    private stopFloatingPanelDrag(state: FloatingPanelDragState): void {
        state.isDragging = false;
        state.dragOffset = null;
    }

    private initializeOrClampFloatingPanel(state: FloatingPanelDragState): void {
        const boundaryEl = this.editorContentRef()?.nativeElement;
        const panelEl = state.getPanelElement();
        if (!boundaryEl || !panelEl) {
            return;
        }

        const boundaryRect = boundaryEl.getBoundingClientRect();
        const panelRect = panelEl.getBoundingClientRect();

        if (!state.hasPosition) {
            state.hasPosition = true;
            const initialPosition: Point2D = state.anchor === 'top-right'
                ? {
                    x: boundaryRect.width - panelRect.width - state.margin,
                    y: state.margin,
                }
                : {
                    x: state.margin,
                    y: state.margin,
                };

            state.position.set(this.getClampedFloatingPanelPosition(initialPosition, boundaryRect, panelRect));
            return;
        }

        state.position.set(this.getClampedFloatingPanelPosition(state.position(), boundaryRect, panelRect));
    }

    private getClampedFloatingPanelPosition(position: Point2D, boundaryRect: DOMRect, panelRect: DOMRect): Point2D {
        const maxX = Math.max(0, boundaryRect.width - panelRect.width);
        const maxY = Math.max(0, boundaryRect.height - panelRect.height);

        return {
            x: this.clamp(position.x, 0, maxX),
            y: this.clamp(position.y, 0, maxY),
        };
    }


}
