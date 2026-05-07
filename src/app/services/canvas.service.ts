import {computed, effect, inject, Injectable, Renderer2, RendererFactory2, signal} from '@angular/core';
import {
    DEFAULT_WIDGET_TEXT_STYLE,
    DEFAULT_WIDGET_TEXT,
    DEFAULT_WIDGET_VIDEO_CONTENT,
    WidgetImageFitMode,
    WidgetTextAlignmentHorizontal,
    WidgetTextAlignmentVertical,
    WidgetTextFontFamily,
    WidgetContentType,
    WidgetStateItem,
    WidgetBorderStyle,
    WidgetImageContent,
    WidgetVideoContent,
} from '../models/canvas-widget-state.models';
import {AxisGuides, Point2D, Rect2D, ResizeHandle, Size2D} from '../models/geometry.models';
import {CanvasWidgetStateService} from './canvas-widget-state.service';
import {CanvasWidgetDragService} from './canvas-widget-drag.service';
import {CanvasWidgetResizeService} from './canvas-widget-resize.service';
import {CanvasViewportService} from './canvas-viewport.service';
import {MathService} from './math.service';
import {
    clampRectInsideCanvas,
    screenToCanvasPoint,
    snapPointToGrid,
} from '../utils/canvas-geometry.utils';
import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';
import {v4 as uuid} from 'uuid';

export interface CanvasServiceInitModel {
    canvas: HTMLElement;
    canvasWrapper?: HTMLElement;
    allowExitBorders?: boolean;
    allowSnapToGrid?: boolean;
    allowSnapToObjects?: boolean;
    allowSnapToBorder?: boolean;
    allowWidgetResize?: boolean;
    allowWidgetMove?: boolean;
    allowShowGrid?: boolean;
    allowShowContainer?: boolean;
    width?: number;
    height?: number;
    snapSize?: number;
    zoom?: number;
}

export type ResizePosition = ResizeHandle;
export type SettingsPanelLayout = 'floating' | 'fixed-right' | 'closed';
export type LayersPanelLayout = 'floating' | 'fixed-left' | 'closed';
type PointerLikeEvent = MouseEvent | PointerEvent;

interface FileSystemFileHandleLike {
    getFile: () => Promise<File>;
    createWritable?: () => Promise<{
        write: (data: Blob) => Promise<void>;
        close: () => Promise<void>;
    }>;
}

interface FileSystemDirectoryHandleLike {
    name?: string;
    getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemDirectoryHandleLike>;
    getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandleLike>;
    entries?: () => AsyncIterable<[string, unknown]>;
    removeEntry?: (name: string, options?: { recursive?: boolean }) => Promise<void>;
    queryPermission?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
    requestPermission?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
}

interface FileSystemAccessApi {
    showOpenFilePicker?: (options?: {
        multiple?: boolean;
        excludeAcceptAllOption?: boolean;
        types?: {
            description?: string;
            accept: Record<string, string[]>;
        }[];
    }) => Promise<FileSystemFileHandleLike[]>;
    showSaveFilePicker?: (options?: {
        suggestedName?: string;
        excludeAcceptAllOption?: boolean;
        types?: {
            description?: string;
            accept: Record<string, string[]>;
        }[];
    }) => Promise<FileSystemFileHandleLike>;
    showDirectoryPicker?: (options?: {
        id?: string;
        mode?: 'read' | 'readwrite';
        startIn?: string;
    }) => Promise<FileSystemDirectoryHandleLike>;
}

interface CanvasSnapshot {
    width: number;
    height: number;
    zoom: number;
    top: number;
    left: number;
    snapSize: number;
    canExitBorders: boolean;
    canSnapToGrid: boolean;
    canSnapToObjects: boolean;
    canSnapToBorder: boolean;
    canResizeWidget: boolean;
    canMoveWidget: boolean;
    showGrid: boolean;
    showContainer: boolean;
    debugMode: boolean;
    debugPanelVisible: boolean;
    settingsPanelLayout: SettingsPanelLayout;
    layersPanelLayout: LayersPanelLayout;
    selectedWidgetId: string | null;
    projectName: string;
}

interface EditorStateSnapshot {
    canvas: CanvasSnapshot;
    widgets: WidgetStateItem[];
}

type ImportArchivePersistResult =
    | { status: 'saved'; directoryHandle: FileSystemDirectoryHandleLike }
    | { status: 'skipped' }
    | { status: 'cancelled' }
    | { status: 'unsupported' }
    | { status: 'error'; message: string };

type ProjectImportNotice = {
    kind: 'info' | 'warning' | 'success' | 'error';
    message: string;
};

type ArrowMoveKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

@Injectable({
    providedIn: 'root'
})
export class CanvasService {

    private static readonly TEXT_FONT_FAMILY_MAP: Record<WidgetTextFontFamily, string> = {
        roboto: 'Roboto, Arial, Helvetica, sans-serif',
        montserrat: 'Montserrat, Arial, Helvetica, sans-serif',
        exo: 'Exo, Arial, Helvetica, sans-serif',
        lora: 'Lora, Georgia, "Times New Roman", serif',
        'fira-code': '"Fira Code", "SFMono-Regular", Menlo, Consolas, monospace',
    };

    public readonly WIDGET_DRAGGING_CLASS = "app-canvas-widget-dragging" // TODO: should be customizable
    public readonly CANVAS_DRAGGING_CLASS = "app-canvas-dragging" // TODO: should be customizable
    public readonly WIDGET_RESIZING_CLASS = "app-canvas-widget-resizing" // TODO: should be customizable
    public readonly WIDGET_RESIZER_CLASS = "app-canvas-widget-resizer" // TODO: should be customizable

    public canvasEl: HTMLElement | null = null;
    public canvasWrapperEl: HTMLElement | null = null;

    public readonly widgetsState = inject(CanvasWidgetStateService);
    private readonly widgetDragService = inject(CanvasWidgetDragService);
    private readonly widgetResizeService = inject(CanvasWidgetResizeService);
    private readonly viewportService = inject(CanvasViewportService);
    private readonly mathService = inject(MathService);

    public canManageCanvas = signal(false);
    public canExitBorders = signal(false);
    public canSnapToGrid = signal(false);
    public canSnapToObjects = signal(true);
    public canSnapToBorder = signal(true);
    public canResizeWidget = signal(false);
    public canMoveWidget = signal(true);
    public showGrid = signal(false);
    public showContainer = signal(false);
    public debugMode = signal(false);
    public debugPanelVisible = signal(false);
    public settingsPanelLayout = signal<SettingsPanelLayout>('fixed-right');
    public layersPanelLayout = signal<LayersPanelLayout>('fixed-left');

    public isDraggingCanvas = signal(false);
    public isDraggingWidget = signal(false);
    public isResizingWidget = signal(false);
    public isSpacePressed = signal(false);
    public widgetResizingPosition = signal<ResizePosition | null>(null);
    public selectedWidgetId = signal<string | null>(null);
    public objectSnapGuides = signal<AxisGuides>({});

    public zoom = signal(1);
    public width = signal(800);
    public height = signal(600);
    public top = signal(0);
    public left = signal(0);
    public snapSize = signal(1);

    public readonly snapSizeList = computed<number[]>(() => {
        return this.mathService.divisorsInCommon(this.width(), this.height()) ?? [1];
    });

    public readonly selectedWidget = computed<WidgetStateItem | null>(() => {
        const selectedId = this.selectedWidgetId();
        return selectedId ? this.widgetsState.getById(selectedId) ?? null : null;
    });

    private readonly objectSnapDistance = 8;
    private readonly borderSnapDistance = 8;

    private canvasDragStartPointer: Point2D | null = null;
    private canvasDragStartOffset: Point2D | null = null;
    private activeWidgetEl: HTMLElement | null = null;
    private widgetDragOffset: Point2D | null = null;
    private resizeStartPointer: Point2D | null = null;
    private resizeStartRect: Rect2D | null = null;
    private resizeStartAspectRatio: number | null = null;

    private readonly renderer: Renderer2 = inject(RendererFactory2).createRenderer(null, null);

    private readonly STORAGE_KEY = 'video-director.editor-state.v1';
    private readonly PROJECT_STATE_FILE = 'state.json';
    private readonly PROJECT_SYNC_DIR = 'sync';
    private readonly PROJECT_ASSETS_DIR = 'assets';
    private readonly PROJECT_MANAGED_ASSET_PREFIX = 'widget-';
    private readonly PROJECT_ARCHIVE_EXTENSION = 'zip';
    private readonly PROJECT_HANDLE_DB_NAME = 'video-director.fs-handles.v1';
    private readonly PROJECT_HANDLE_STORE_NAME = 'handles';
    private readonly PROJECT_HANDLE_KEY = 'project-directory';
    private readonly PROJECT_DIRECTORY_PROMPT_SEEN_KEY = 'video-director.project-directory-connect-prompt.v1';
    private readonly HISTORY_LIMIT = 100;
    private readonly undoStack = signal<EditorStateSnapshot[]>([]);
    private readonly redoStack = signal<EditorStateSnapshot[]>([]);
    public readonly canUndo = computed(() => this.undoStack().length > 0);
    public readonly canRedo = computed(() => this.redoStack().length > 0);
    private readonly widgetVideoElements = new Map<string, HTMLVideoElement>();
    private readonly widgetVideoPlayback = signal<Record<string, boolean>>({});
    private readonly widgetVideoTime = signal<Record<string, number>>({});
    private readonly widgetVideoDuration = signal<Record<string, number>>({});
    private readonly widgetVideoVolume = signal<Record<string, number>>({});

    private currentSnapshot: EditorStateSnapshot | null = null;
    private isApplyingSnapshot = false;
    private isHistoryReady = false;
    private pendingSnapshot: EditorStateSnapshot | null = null;
    private isSnapshotFlushScheduled = false;

    private projectDirectoryHandle: FileSystemDirectoryHandleLike | null = null;
    private readonly projectSyncDebounceMs = 700;
    private projectSyncTimeout: ReturnType<typeof setTimeout> | null = null;
    private isProjectSyncInFlight = false;
    private isProjectSyncQueued = false;

    public projectName = signal<string>('Untitled Project');
    public projectDirectoryName = signal<string | null>(null);
    public projectDirectoryRestoreReady = signal(false);
    public projectSyncStatus = signal<'idle' | 'syncing' | 'error'>('idle');
    public projectLastSyncedAt = signal<Date | null>(null);
    public projectSyncError = signal<string | null>(null);
    public projectHasPendingChanges = signal(false);
    public importPromptForDirectory = signal(true);
    public projectImportNotice = signal<ProjectImportNotice | null>(null);
    private pendingImportBackupBlob = signal<Blob | null>(null);
    private pendingImportBackupFileName = signal('project-import-sync-backup.zip');
    public readonly hasPendingImportBackup = computed(() => !!this.pendingImportBackupBlob());
    public readonly pendingImportBackupName = computed(() => this.pendingImportBackupFileName());

    constructor() {
        void this.restoreProjectDirectoryConnection();

        effect(() => {
            if (!this.canManageCanvas()) {
                return;
            }

            if (!this.isHistoryReady) {
                return;
            }

            const snapshot = this.buildSnapshot();
            this.pendingSnapshot = snapshot;
            this.scheduleSnapshotFlush();
        });
    }

    public init({
                    canvas,
                    canvasWrapper,
                    allowExitBorders = false,
                    allowSnapToGrid = true,
                    allowSnapToObjects = false,
                    allowSnapToBorder = false,
                    allowShowGrid = true,
                    allowShowContainer = true,
                    width = 800,
                    height = 600,
                    snapSize = 1,
                    allowWidgetResize = true,
                    allowWidgetMove = true,
                    zoom = 1,
                }: CanvasServiceInitModel) {
        this.isHistoryReady = false;
        this.canvasEl = canvas;
        this.canvasWrapperEl = canvasWrapper ?? null;

        const savedSnapshot = this.loadSnapshotFromStorage();

        this.canManageCanvas.set(true); // !!this.canvasWrapperEl

        if (savedSnapshot) {
            this.applySnapshot(savedSnapshot);
        } else {
            this.canExitBorders.set(allowExitBorders);
            this.canSnapToGrid.set(allowSnapToGrid);
            this.canSnapToObjects.set(allowSnapToObjects);
            this.canSnapToBorder.set(allowSnapToBorder);
            this.canResizeWidget.set(allowWidgetResize);
            this.canMoveWidget.set(allowWidgetMove);
            this.showGrid.set(allowShowGrid);
            this.showContainer.set(allowShowContainer);

            this.width.set(width);
            this.height.set(height);
            this.zoom.set(this.viewportService.clampZoom(zoom));
            this.snapSize.set(allowSnapToGrid ? Math.max(1, snapSize) : 1);
        }

        this.renderer.setStyle(this.canvasEl, 'position', 'relative');
        this.renderer.setStyle(this.canvasEl, 'top', '0px');
        this.renderer.setStyle(this.canvasEl, 'left', '0px');
        this.renderer.setStyle(this.canvasEl, 'width', `${this.width()}px`);
        this.renderer.setStyle(this.canvasEl, 'height', `${this.height()}px`);
        this.renderer.setStyle(this.canvasEl, 'transform', `scale(${this.zoom()})`);
        this.renderer.setStyle(this.canvasEl, 'transformOrigin', 'top left');

        if (this.canvasWrapperEl) {
            this.renderer.setStyle(this.canvasWrapperEl, 'overflow', 'hidden');
        }

        if (!savedSnapshot && allowSnapToGrid) {
            this.resetWidgetToSnapSize();
        }

        if (!savedSnapshot) {
            this.canvasCenter();
        }

        this.undoStack.set([]);
        this.redoStack.set([]);
        this.currentSnapshot = this.buildSnapshot();
        this.writeSnapshotToStorage(this.currentSnapshot);
        this.isHistoryReady = true;

        if (savedSnapshot && this.projectDirectoryHandle) {
            void this.hydrateCurrentSnapshotAssetSourcesFromConnectedDirectory();
        }
    }

    public undo() {
        const stack = this.undoStack();
        if (stack.length === 0) {
            return;
        }

        const previous = stack[stack.length - 1];
        const current = this.buildSnapshot();

        this.undoStack.set(stack.slice(0, -1));
        this.redoStack.update((items) => this.limitHistory([...items, current]));
        this.applySnapshot(previous);
        this.currentSnapshot = this.buildSnapshot();
        this.writeSnapshotToStorage(this.currentSnapshot);
    }

    public redo() {
        const stack = this.redoStack();
        if (stack.length === 0) {
            return;
        }

        const next = stack[stack.length - 1];
        const current = this.buildSnapshot();

        this.redoStack.set(stack.slice(0, -1));
        this.undoStack.update((items) => this.limitHistory([...items, current]));
        this.applySnapshot(next);
        this.currentSnapshot = this.buildSnapshot();
        this.writeSnapshotToStorage(this.currentSnapshot);
    }

    public isProjectDirectorySyncSupported(): boolean {
        return !!this.getFileSystemAccessApi()?.showDirectoryPicker;
    }

    public isProjectDirectoryConnected(): boolean {
        return !!this.projectDirectoryHandle;
    }

    public async connectProjectDirectory(): Promise<void> {
        const fsApi = this.getFileSystemAccessApi();
        if (!fsApi?.showDirectoryPicker) {
            throw new Error('Directory sync is not supported by this browser.');
        }

        const directoryHandle = await fsApi.showDirectoryPicker({
            id: 'video-director-project-folder',
            mode: 'readwrite',
        });

        this.projectDirectoryHandle = directoryHandle;
        this.projectDirectoryName.set(directoryHandle.name ?? 'Selected folder');
        this.projectSyncError.set(null);
        await this.persistProjectDirectoryHandle(directoryHandle);
        this.markProjectDirectoryPromptAsConnectedChoice();

        const isDirectoryEmpty = await this.isDirectoryEmpty(directoryHandle);
        if (isDirectoryEmpty) {
            await this.syncProjectToDirectoryNow();
            return;
        }

        await this.loadProjectFromDirectory();
    }

    public disconnectProjectDirectory(): void {
        this.projectDirectoryHandle = null;
        this.projectDirectoryName.set(null);
        this.projectSyncStatus.set('idle');
        this.projectSyncError.set(null);
        this.projectLastSyncedAt.set(null);
        this.projectHasPendingChanges.set(false);
        void this.clearPersistedProjectDirectoryHandle();

        if (this.projectSyncTimeout) {
            clearTimeout(this.projectSyncTimeout);
            this.projectSyncTimeout = null;
        }
    }

    public async loadProjectFromDirectory(): Promise<void> {
        const directoryHandle = this.projectDirectoryHandle;
        if (!directoryHandle) {
            throw new Error('No project folder connected.');
        }

        this.projectSyncStatus.set('syncing');
        this.projectSyncError.set(null);

        try {
            const projectFile = await directoryHandle.getFileHandle(this.PROJECT_STATE_FILE, {create: false});
            const raw = await (await projectFile.getFile()).text();
            const parsed = JSON.parse(raw) as Partial<EditorStateSnapshot>;

            if (!parsed.canvas || !Array.isArray(parsed.widgets)) {
                throw new Error('Invalid project file format.');
            }

            const hydratedSnapshot = await this.hydrateSnapshotAssetsFromDirectory(
                {
                    canvas: parsed.canvas as CanvasSnapshot,
                    widgets: parsed.widgets as WidgetStateItem[],
                },
                directoryHandle,
            );

            this.applySnapshot(hydratedSnapshot);
            this.currentSnapshot = this.buildSnapshot();
            this.writeSnapshotToStorage(this.currentSnapshot);
            this.undoStack.set([]);
            this.redoStack.set([]);
            this.projectSyncStatus.set('idle');
            this.projectLastSyncedAt.set(new Date());
            this.projectHasPendingChanges.set(false);
        } catch (error) {
            this.projectSyncStatus.set('error');
            this.projectSyncError.set(error instanceof Error ? error.message : 'Unable to load project from directory.');
            throw error;
        }
    }

    public async syncProjectToDirectoryNow(): Promise<void> {
        const directoryHandle = this.projectDirectoryHandle;
        if (!directoryHandle) {
            throw new Error('No project folder connected.');
        }

        if (this.isProjectSyncInFlight) {
            this.isProjectSyncQueued = true;
            return;
        }

        this.isProjectSyncInFlight = true;
        this.projectSyncStatus.set('syncing');
        this.projectSyncError.set(null);

        try {
            const directorySnapshot = await this.createDirectorySnapshot(directoryHandle);
            await this.writeSnapshotToDirectory(directoryHandle, directorySnapshot);
            this.projectSyncStatus.set('idle');
            this.projectLastSyncedAt.set(new Date());
            this.projectHasPendingChanges.set(false);
        } catch (error) {
            this.projectSyncStatus.set('error');
            this.projectSyncError.set(error instanceof Error ? error.message : 'Unable to sync project to directory.');
            throw error;
        } finally {
            this.isProjectSyncInFlight = false;

            if (this.isProjectSyncQueued) {
                this.isProjectSyncQueued = false;
                void this.syncProjectToDirectoryNow();
            }
        }
    }

    public setSpacePressed(pressed: boolean) {
        this.isSpacePressed.set(pressed);
    }

    public canvasResize({width, height}: { width?: number; height?: number; }) {
        if (typeof width === 'number') {
            this.width.set(Math.max(1, Math.round(width)));
        }
        if (typeof height === 'number') {
            this.height.set(Math.max(1, Math.round(height)));
        }

        if (this.canvasEl) {
            this.renderer.setStyle(this.canvasEl, 'width', `${this.width()}px`);
            this.renderer.setStyle(this.canvasEl, 'height', `${this.height()}px`);
        }
    }

    public canvasZoomIn(value?: number, focalPoint?: Point2D) {
        this.canvasZoomBy(value ?? 0.25, focalPoint);
    }

    public canvasZoomOut(value?: number, focalPoint?: Point2D) {
        this.canvasZoomBy(-(value ?? 0.25), focalPoint);
    }

    public canvasZoomReset() {
        this.zoom.set(1);
        this.canvasCenter();
    }

    public canvasFitToViewport() {
        if (!this.canvasWrapperEl) {
            this.zoom.set(1);
            this.top.set(0);
            this.left.set(0);
            return;
        }

        const wrapperRect = this.canvasWrapperEl.getBoundingClientRect();
        const nextZoom = this.viewportService.fitCanvasZoom({
            wrapper: {width: wrapperRect.width, height: wrapperRect.height},
            canvas: {width: this.width(), height: this.height()},
        });

        this.zoom.set(nextZoom);
        this.canvasCenter();
    }

    public canvasCenter() {
        if (!this.canvasWrapperEl) {
            this.top.set(0);
            this.left.set(0);
            return;
        }

        const wrapperRect = this.canvasWrapperEl.getBoundingClientRect();
        const center = this.viewportService.centerCanvas({
            wrapper: {width: wrapperRect.width, height: wrapperRect.height},
            canvas: {width: this.width(), height: this.height()},
            zoom: this.zoom(),
        });

        this.left.set(center.x);
        this.top.set(center.y);
    }

    public setSnapSize(value: number) {
        this.snapSize.set(Math.max(1, value));
        this.resetWidgetToSnapSize();
    }

    public setExitBorders(value: boolean) {
        this.canExitBorders.set(value);
    }

    public setSnapToGrid(value: boolean) {
        this.canSnapToGrid.set(value);

        if (value) {
            this.resetWidgetToSnapSize();
            return;
        }

        if (this.canSnapToObjects()) {
            this.objectSnapGuides.set({});
        }
    }

    public setSnapToObjects(value: boolean) {
        this.canSnapToObjects.set(value);
        if (!value) {
            this.objectSnapGuides.set({});
        }
    }

    public setSnapToBorder(value: boolean) {
        this.canSnapToBorder.set(value);
        if (!value) {
            this.objectSnapGuides.set({});
        }
    }

    public setWidgetResize(value: boolean) {
        this.canResizeWidget.set(value);
    }

    public setWidgetMove(value: boolean) {
        this.canMoveWidget.set(value);
    }

    public setShowGrid(value: boolean) {
        this.showGrid.set(value);
    }

    public setShowContainer(value: boolean) {
        this.showContainer.set(value);
    }

    public setDebugMode(value: boolean) {
        this.debugMode.set(value);
    }


    public setDebugPanelVisible(value: boolean) {
        this.debugPanelVisible.set(value);
    }

    public setSettingsPanelLayout(value: SettingsPanelLayout) {
        this.settingsPanelLayout.set(value);
    }

    public setLayersPanelLayout(value: LayersPanelLayout) {
        this.layersPanelLayout.set(value);
    }

    public selectWidget(widgetId: string | null) {
        this.selectedWidgetId.set(widgetId);
    }

    public setProjectName(name: string): void {
        this.projectName.set(name.trim() || 'Untitled Project');
    }

    public deleteSelectedWidget(): void {
        const selectedId = this.selectedWidgetId();
        if (!selectedId) {
            return;
        }

        this.deleteWidget(selectedId);
    }

    public deleteWidget(widgetId: string): void {
        const widget = this.widgetsState.getById(widgetId);
        if (!widget) {
            return;
        }

        this.unregisterWidgetVideoElement(widgetId);

        this.widgetsState.remove({uuid: widgetId});

        if (this.selectedWidgetId() === widgetId) {
            this.selectedWidgetId.set(null);
        }

        this.objectSnapGuides.set({});
    }

    public getWidgetRenderZIndex(widget: Pick<WidgetStateItem, 'uuid' | 'z'>): number {
        if (this.selectedWidgetId() !== widget.uuid) {
            return widget.z;
        }

        const maxLayerZ = this.widgetsState
            .list()
            .reduce((maxZ, item) => Math.max(maxZ, item.z), 0);

        return Math.max(maxLayerZ, widget.z) + 1;
    }

    public createTextWidget(): void {
        this.createWidget('text');
    }

    public createImageWidget(): void {
        this.createWidget('image');
    }

    public createVideoWidget(): void {
        this.createWidget('video');
    }

    public setSelectedWidgetContentType(type: WidgetContentType) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type === type) {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: this.createDefaultWidgetContent(type),
        });
    }

    public setSelectedWidgetText(text: string) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'text') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                text,
            },
        });
    }

    public setSelectedWidgetImageSrc(src: string) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'image') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                src,
            },
        });
    }

    public setSelectedWidgetImageAlt(alt: string) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'image') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                alt,
            },
        });
    }

    public setSelectedWidgetImageFitMode(fitMode: WidgetImageFitMode) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'image') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                fitMode,
            },
        });
    }

    public setSelectedWidgetVideoSrc(src: string) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'video') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                src,
            },
        });
    }

    public setSelectedWidgetVideoPoster(poster: string) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'video') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                poster,
            },
        });
    }

    public setSelectedWidgetVideoFitMode(fitMode: WidgetImageFitMode) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'video') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                fitMode,
            },
        });
    }

    public setSelectedWidgetVideoAutoplay(autoplay: boolean) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'video') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                autoplay,
            },
        });
    }

    public setSelectedWidgetVideoLoop(loop: boolean) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'video') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                loop,
            },
        });
    }

    public setSelectedWidgetVideoMuted(muted: boolean) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'video') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                muted,
            },
        });

        const element = this.widgetVideoElements.get(widget.uuid);
        if (!element) {
            return;
        }

        this.applyWidgetVideoAudioState(widget.uuid, element, this.getWidgetVideoVolume(widget.uuid));
    }

    public setSelectedWidgetVideoControls(controls: boolean) {
         const widget = this.selectedWidget();
         if (!widget || widget.content.type !== 'video') {
             return;
         }

         this.widgetsState.update({
             ...widget,
             content: {
                 ...widget.content,
                 controls,
             },
         });
     }

    public setSelectedWidgetImageOffsetX(offsetX: number) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'image' || !Number.isFinite(offsetX)) {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                offsetX,
            },
        });
    }

    public setSelectedWidgetImageOffsetY(offsetY: number) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'image' || !Number.isFinite(offsetY)) {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                offsetY,
            },
        });
    }

    public setSelectedWidgetVideoOffsetX(offsetX: number) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'video' || !Number.isFinite(offsetX)) {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                offsetX,
            },
        });
    }

    public setSelectedWidgetVideoOffsetY(offsetY: number) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'video' || !Number.isFinite(offsetY)) {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                offsetY,
            },
        });
    }

     public setSelectedWidgetTextFontSize(fontSize: number) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'text' || !Number.isFinite(fontSize)) {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                style: {
                    ...widget.content.style,
                    fontSize: Math.max(8, Math.round(fontSize)),
                },
            },
        });
    }

    public setSelectedWidgetTextFontFamily(fontFamily: WidgetTextFontFamily) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'text') {
            return;
        }

        const nextFontSize = widget.content.style.autoSize
            ? this.computeAutoTextFontSize({
                text: widget.content.text,
                fontFamily,
                widgetWidth: widget.width,
                widgetHeight: widget.height,
                widgetPadding: widget.padding ?? 0,
                widgetBorderWidth: widget.borderWidth ?? 0,
            })
            : widget.content.style.fontSize;

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                style: {
                    ...widget.content.style,
                    fontFamily,
                    fontSize: nextFontSize,
                },
            },
        });
    }

    public setSelectedWidgetTextColor(color: string) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'text') {
            return;
        }

        const nextColor = color.trim() || DEFAULT_WIDGET_TEXT_STYLE.color;

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                style: {
                    ...widget.content.style,
                    color: nextColor,
                },
            },
        });
    }

    public setSelectedWidgetTextAutoSize(autoSize: boolean) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'text') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                style: {
                    ...widget.content.style,
                    autoSize,
                },
            },
        });
    }

    public setSelectedWidgetTextHorizontalAlignment(alignHorizontal: WidgetTextAlignmentHorizontal) {
        const widget = this.selectedWidget();
        if (!widget || widget.content.type !== 'text') {
            return;
        }

        this.widgetsState.update({
            ...widget,
            content: {
                ...widget.content,
                style: {
                    ...widget.content.style,
                    alignHorizontal,
                },
            },
        });
    }

     public setSelectedWidgetTextVerticalAlignment(alignVertical: WidgetTextAlignmentVertical) {
         const widget = this.selectedWidget();
         if (!widget || widget.content.type !== 'text') {
             return;
         }

         this.widgetsState.update({
             ...widget,
             content: {
                 ...widget.content,
                 style: {
                     ...widget.content.style,
                     alignVertical,
                 },
             },
         });
     }

     public setSelectedWidgetTextBold(bold: boolean) {
         const widget = this.selectedWidget();
         if (!widget || widget.content.type !== 'text') {
             return;
         }

         this.widgetsState.update({
             ...widget,
             content: {
                 ...widget.content,
                 style: {
                     ...widget.content.style,
                     bold,
                 },
             },
         });
     }

     public setSelectedWidgetTextItalic(italic: boolean) {
         const widget = this.selectedWidget();
         if (!widget || widget.content.type !== 'text') {
             return;
         }

         this.widgetsState.update({
             ...widget,
             content: {
                 ...widget.content,
                 style: {
                     ...widget.content.style,
                     italic,
                 },
             },
         });
     }

     public setSelectedWidgetTextUnderline(underline: boolean) {
         const widget = this.selectedWidget();
         if (!widget || widget.content.type !== 'text') {
             return;
         }

         this.widgetsState.update({
             ...widget,
             content: {
                 ...widget.content,
                 style: {
                     ...widget.content.style,
                     underline,
                 },
             },
         });
     }

     public setSelectedWidgetTextLineHeight(lineHeight: number) {
         const widget = this.selectedWidget();
         if (!widget || widget.content.type !== 'text' || !Number.isFinite(lineHeight)) {
             return;
         }

         this.widgetsState.update({
             ...widget,
             content: {
                 ...widget.content,
                 style: {
                     ...widget.content.style,
                     lineHeight: Math.max(0.5, lineHeight),
                 },
             },
         });
     }

     public setSelectedWidgetName(name: string) {
        const widget = this.selectedWidget();
        if (!widget) {
            return;
        }

        this.widgetsState.renameLayer(widget.uuid, name);
    }

    public setSelectedWidgetBackground(background: string | null) {
        const widget = this.selectedWidget();
        if (!widget) {
            return;
        }
        this.widgetsState.update({
            ...widget,
            background: background && background.trim() ? background.trim() : undefined,
        });
    }

    public setSelectedWidgetBorderRadius(borderRadius: number) {
        const widget = this.selectedWidget();
        if (!widget) {
            return;
        }
        this.widgetsState.update({...widget, borderRadius: Math.max(0, borderRadius)});
    }

    public setSelectedWidgetBorderWidth(borderWidth: number) {
        const widget = this.selectedWidget();
        if (!widget) {
            return;
        }
        this.widgetsState.update({...widget, borderWidth: Math.max(0, borderWidth)});
    }

    public setSelectedWidgetBorderColor(borderColor: string) {
        const widget = this.selectedWidget();
        if (!widget) {
            return;
        }
        this.widgetsState.update({...widget, borderColor});
    }

    public setSelectedWidgetBorderStyle(borderStyle: WidgetBorderStyle) {
        const widget = this.selectedWidget();
        if (!widget) {
            return;
        }
        this.widgetsState.update({...widget, borderStyle});
    }

    public setSelectedWidgetPadding(padding: number) {
        const widget = this.selectedWidget();
        if (!widget) {
            return;
        }
        this.widgetsState.update({...widget, padding: Math.max(0, padding)});
    }

    public setSelectedWidgetLocked(locked: boolean) {
        const widget = this.selectedWidget();
        if (!widget) {
            return;
        }

        this.widgetsState.update({...widget, locked});
    }

    public setWidgetLocked(widgetId: string, locked: boolean) {
        const widget = this.widgetsState.getById(widgetId);
        if (!widget) {
            return;
        }

        this.widgetsState.update({...widget, locked});
    }

    public setSelectedWidgetVisible(visible: boolean) {
        const widget = this.selectedWidget();
        if (!widget) {
            return;
        }

        this.widgetsState.update({...widget, visible});
    }

    public setWidgetVisible(widgetId: string, visible: boolean) {
        const widget = this.widgetsState.getById(widgetId);
        if (!widget) {
            return;
        }

        this.widgetsState.update({...widget, visible});
    }

    public setSelectedWidgetX(value: number) {
        this.updateSelectedWidgetRect({x: value});
    }

    public setSelectedWidgetY(value: number) {
        this.updateSelectedWidgetRect({y: value});
    }

    public setSelectedWidgetWidth(value: number) {
        this.updateSelectedWidgetRect({width: value});
    }

    public setSelectedWidgetHeight(value: number) {
        this.updateSelectedWidgetRect({height: value});
    }

    public moveSelectedWidgetByArrowKey({key, shiftKey}: { key: ArrowMoveKey; shiftKey: boolean }): boolean {
        const widget = this.selectedWidget();
        if (!widget) {
            return false;
        }

        if (widget.locked || !this.canMoveWidget() || this.isDraggingWidget() || this.isResizingWidget()) {
            return true;
        }

        const step = this.canSnapToGrid()
            ? Math.max(1, this.snapSize()) * (shiftKey ? 10 : 1)
            : (shiftKey ? 10 : 1);

        const delta: Point2D = {x: 0, y: 0};

        if (key === 'ArrowLeft') {
            delta.x = -step;
        } else if (key === 'ArrowRight') {
            delta.x = step;
        } else if (key === 'ArrowUp') {
            delta.y = -step;
        } else {
            delta.y = step;
        }

        this.updateSelectedWidgetRect({
            x: widget.x + delta.x,
            y: widget.y + delta.y,
        });

        return true;
    }

    public isValidImageUrl(src: string): boolean {
        const value = src.trim();
        if (!value) {
            return false;
        }

        if (value.startsWith('data:image/') || value.startsWith('blob:')) {
            return true;
        }

        try {
            const url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    public isValidVideoUrl(src: string): boolean {
        const value = src.trim();
        if (!value) {
            return false;
        }

        if (value.startsWith('data:video/') || value.startsWith('blob:')) {
            return true;
        }

        try {
            const url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    public registerWidgetVideoElement(widgetId: string, element: HTMLVideoElement): void {
        this.widgetVideoElements.set(widgetId, element);
        this.setWidgetVideoPlaybackState(widgetId, !element.paused && !element.ended);
        this.setWidgetVideoTimeState(widgetId, element.currentTime || 0);
        this.setWidgetVideoDurationState(widgetId, isFinite(element.duration) ? element.duration : 0);

        const rememberedVolume = this.widgetVideoVolume()[widgetId];
        const nextVolume = typeof rememberedVolume === 'number' ? rememberedVolume : element.volume;
        this.setWidgetVideoVolumeState(widgetId, nextVolume);
        this.applyWidgetVideoAudioState(widgetId, element, nextVolume);
    }

    public unregisterWidgetVideoElement(widgetId: string, element?: HTMLVideoElement): void {
        const registeredElement = this.widgetVideoElements.get(widgetId);
        if (!registeredElement) {
            return;
        }

        if (element && registeredElement !== element) {
            return;
        }

        this.widgetVideoElements.delete(widgetId);
        this.setWidgetVideoPlaybackState(widgetId, false);
        this.widgetVideoTime.update((s) => { const n = {...s}; delete n[widgetId]; return n; });
        this.widgetVideoDuration.update((s) => { const n = {...s}; delete n[widgetId]; return n; });
        this.widgetVideoVolume.update((s) => { const n = {...s}; delete n[widgetId]; return n; });
    }

    public isWidgetVideoPlaying(widgetId: string): boolean {
        return this.widgetVideoPlayback()[widgetId] ?? false;
    }

    public canControlWidgetVideo(widgetId: string): boolean {
        return this.widgetVideoElements.has(widgetId);
    }

    public getWidgetVideoCurrentTime(widgetId: string): number {
        return this.widgetVideoTime()[widgetId] ?? 0;
    }

    public getWidgetVideoDuration(widgetId: string): number {
        return this.widgetVideoDuration()[widgetId] ?? 0;
    }

    public getWidgetVideoVolume(widgetId: string): number {
        return this.widgetVideoVolume()[widgetId] ?? 1;
    }

    public setWidgetVideoTimeState(widgetId: string, time: number): void {
        this.widgetVideoTime.update((state) => {
            if (state[widgetId] === time) {
                return state;
            }

            return {...state, [widgetId]: time};
        });
    }

    public setWidgetVideoDurationState(widgetId: string, duration: number): void {
        this.widgetVideoDuration.update((state) => {
            if (state[widgetId] === duration) {
                return state;
            }

            return {...state, [widgetId]: duration};
        });
    }

    public setWidgetVideoVolumeState(widgetId: string, volume: number): void {
        this.widgetVideoVolume.update((state) => {
            if (state[widgetId] === volume) {
                return state;
            }

            return {...state, [widgetId]: volume};
        });
    }

    public seekWidgetVideo(widgetId: string, time: number): void {
        const element = this.widgetVideoElements.get(widgetId);
        if (!element) {
            return;
        }

        const clamped = Math.max(0, Math.min(time, isFinite(element.duration) ? element.duration : 0));
        element.currentTime = clamped;
        this.setWidgetVideoTimeState(widgetId, clamped);
    }

    public setWidgetVideoVolume(widgetId: string, volume: number): void {
        const element = this.widgetVideoElements.get(widgetId);
        if (!element) {
            return;
        }

        const clamped = Math.max(0, Math.min(1, volume));
        this.setWidgetVideoVolumeState(widgetId, clamped);
        this.applyWidgetVideoAudioState(widgetId, element, clamped);
    }

    private applyWidgetVideoAudioState(widgetId: string, element: HTMLVideoElement, volume: number): void {
        const clamped = Math.max(0, Math.min(1, volume));
        element.volume = clamped;

        const widget = this.widgetsState.getById(widgetId);
        const mutedBySettings = !!widget && widget.content.type === 'video' && widget.content.muted;
        element.muted = mutedBySettings || clamped === 0;
    }

    public setWidgetVideoPlaybackState(widgetId: string, isPlaying: boolean): void {
        this.widgetVideoPlayback.update((state) => {
            if ((state[widgetId] ?? false) === isPlaying) {
                return state;
            }

            return {
                ...state,
                [widgetId]: isPlaying,
            };
        });
    }

    public toggleWidgetVideoPlayback(widgetId: string): void {
        const widget = this.widgetsState.getById(widgetId);
        if (!widget || widget.content.type !== 'video') {
            return;
        }

        const element = this.widgetVideoElements.get(widgetId);
        if (!element) {
            return;
        }

        if (element.paused || element.ended) {
            void element.play()
                .then(() => this.setWidgetVideoPlaybackState(widgetId, true))
                .catch(() => this.setWidgetVideoPlaybackState(widgetId, false));
            return;
        }

        element.pause();
        this.setWidgetVideoPlaybackState(widgetId, false);
    }

    public async setSelectedWidgetImageFromFile(file: File): Promise<void> {
        const selected = this.selectedWidget();
        if (!selected || selected.content.type !== 'image') {
            return;
        }

        if (!file.type.startsWith('image/')) {
            return;
        }

        const dataUrl = await this.blobToDataUrl(file);
        this.applySelectedWidgetImageDataUrl({dataUrl, fallbackName: file.name});
        // Eagerly write to the project folder if connected so the asset is on disk immediately.
        await this.eagerWriteImageToProjectFolder(selected.uuid, file);
    }

    public async setSelectedWidgetVideoFromFile(file: File): Promise<void> {
        const selected = this.selectedWidget();
        if (!selected || selected.content.type !== 'video') {
            return;
        }

        if (!file.type.startsWith('video/')) {
            return;
        }

        const dataUrl = await this.blobToDataUrl(file);
        this.applySelectedWidgetVideoDataUrl(dataUrl);
        await this.eagerWriteVideoToProjectFolder(selected.uuid, file);
    }

    public async setSelectedWidgetImageFromUrl(url: string): Promise<void> {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) {
            throw new Error('Image URL is empty');
        }

        let imageBlob: Blob;

        try {
            const response = await fetch(trimmedUrl, {mode: 'cors', credentials: 'omit'});
            if (!response.ok) {
                throw new Error(`Image fetch failed: ${response.status}`);
            }

            imageBlob = await response.blob();
        } catch (error) {
            throw new Error('Unable to fetch image from URL', {cause: error});
        }

        if (!imageBlob.type.startsWith('image/')) {
            throw new Error('The provided URL is not an image resource');
        }

        const fallbackName = this.resolveFileNameFromSource(trimmedUrl, 'image-from-url');
        const dataUrl = await this.blobToDataUrl(imageBlob);
        this.applySelectedWidgetImageDataUrl({dataUrl, fallbackName});
        // Eagerly write to the project folder if connected so the asset is on disk immediately.
        const widgetUuid = this.selectedWidget()?.uuid;
        if (widgetUuid) {
            await this.eagerWriteImageToProjectFolder(widgetUuid, imageBlob);
        }
    }

    public async saveSelectedWidgetImageToDisk(): Promise<void> {
        const selected = this.selectedWidget();
        if (!selected || selected.content.type !== 'image') {
            return;
        }

        const source = selected.content.src.trim();
        if (!source) {
            return;
        }

        const imageBlob = await this.resolveImageBlobFromSource(source);
        if (!imageBlob) {
            console.error('[CanvasService] saveSelectedWidgetImageToDisk: failed to read source image');
            return;
        }

        const preferredName = selected.name?.trim()
            || selected.content.alt?.trim()
            || `widget-${selected.uuid}`;

        const fileName = this.normalizeImageFileName(preferredName, imageBlob.type);
        await this.writeBlobToDisk(imageBlob, fileName);
    }

    private applySelectedWidgetImageDataUrl({dataUrl, fallbackName}: { dataUrl: string; fallbackName: string }): void {
        const selected = this.selectedWidget();
        if (!selected || selected.content.type !== 'image') {
            return;
        }

        const latest = this.widgetsState.getById(selected.uuid);

        if (!latest || latest.content.type !== 'image') {
            return;
        }

        const nextAlt = latest.content.alt?.trim()
            ? latest.content.alt
            : fallbackName.replace(/\.[^/.]+$/, '');

        this.widgetsState.update({
            ...latest,
            content: {
                ...latest.content,
                src: dataUrl,
                alt: nextAlt,
            },
        });
    }

    private applySelectedWidgetVideoDataUrl(dataUrl: string): void {
        const selected = this.selectedWidget();
        if (!selected || selected.content.type !== 'video') {
            return;
        }

        const latest = this.widgetsState.getById(selected.uuid);

        if (!latest || latest.content.type !== 'video') {
            return;
        }

        this.widgetsState.update({
            ...latest,
            content: {
                ...latest.content,
                src: dataUrl,
            },
        });
    }

    /**
     * If a project folder is connected, eagerly writes the image blob to the managed
     * assets directory so it is on disk immediately rather than waiting for the next
     * debounced sync cycle.  The widget state src remains as a data URL for in-browser
     * rendering; the compact storage snapshot (localStorage) will reference the asset
     * path instead.  Failures are silently swallowed — the debounced sync is the
     * authoritative write path and will retry.
     */
    private async eagerWriteImageToProjectFolder(widgetUuid: string, blob: Blob): Promise<void> {
        const directoryHandle = this.projectDirectoryHandle;
        if (!directoryHandle) {
            return;
        }

        try {
            const assetsDirectory = await directoryHandle.getDirectoryHandle(this.PROJECT_ASSETS_DIR, {create: true});
            const extension = this.mimeTypeToExtension(blob.type || 'image/png');
            const assetName = `${this.PROJECT_MANAGED_ASSET_PREFIX}${widgetUuid}.${extension}`;
            await this.writeBlobToDirectory(assetsDirectory, assetName, blob);
        } catch {
            // Non-critical: debounced sync will write on the next cycle.
        }
    }

    private async eagerWriteVideoToProjectFolder(widgetUuid: string, blob: Blob): Promise<void> {
        const directoryHandle = this.projectDirectoryHandle;
        if (!directoryHandle) {
            return;
        }

        try {
            const assetsDirectory = await directoryHandle.getDirectoryHandle(this.PROJECT_ASSETS_DIR, {create: true});
            const extension = this.mimeTypeToExtension(blob.type || 'video/mp4');
            const assetName = `${this.PROJECT_MANAGED_ASSET_PREFIX}${widgetUuid}.${extension}`;
            await this.writeBlobToDirectory(assetsDirectory, assetName, blob);
        } catch {
            // Non-critical: debounced sync will write on the next cycle.
        }
    }

    public resetWidgetToSnapSize() {
        const snap = this.snapSize();

        for (const widget of this.widgetsState.list()) {
            if (widget.locked) {
                continue;
            }

            const snapped = snapPointToGrid({point: {x: widget.x, y: widget.y}, snap});
            this.widgetsState.update({
                ...widget,
                x: snapped.x,
                y: snapped.y,
                width: Math.max(snap, Math.round(widget.width / snap) * snap),
                height: Math.max(snap, Math.round(widget.height / snap) * snap),
            });
        }
    }

    public canvasDragStart({el, event}: { el: HTMLElement, event: PointerLikeEvent }) {
        if (!this.canvasEl || !this.canvasWrapperEl) {
            return;
        }

        const canPan = event.button === 1 || event.button === 0;
        if (!canPan) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.isDraggingCanvas.set(true);
        el.classList.add(this.CANVAS_DRAGGING_CLASS);

        this.canvasDragStartPointer = {x: event.clientX, y: event.clientY};
        this.canvasDragStartOffset = {x: this.left(), y: this.top()};
    }

    public canvasDrag({el, event}: { el: HTMLElement, event: PointerLikeEvent }) {
        if (!el.classList.contains(this.CANVAS_DRAGGING_CLASS) || !this.canvasDragStartPointer || !this.canvasDragStartOffset) {
            return;
        }

        const dx = event.clientX - this.canvasDragStartPointer.x;
        const dy = event.clientY - this.canvasDragStartPointer.y;

        this.left.set(Math.round(this.canvasDragStartOffset.x + dx));
        this.top.set(Math.round(this.canvasDragStartOffset.y + dy));
    }

    public canvasDragEnd({el}: { el: HTMLElement, event?: PointerLikeEvent }) {
        if (!el.classList.contains(this.CANVAS_DRAGGING_CLASS)) {
            return;
        }

        el.classList.remove(this.CANVAS_DRAGGING_CLASS);
        this.isDraggingCanvas.set(false);
        this.canvasDragStartPointer = null;
        this.canvasDragStartOffset = null;
    }

    public handleGlobalPointerMove(event: PointerLikeEvent) {
        if (this.isDraggingWidget()) {
            const widgetId = this.selectedWidgetId();
            const widget = widgetId ? this.widgetsState.getById(widgetId) : null;

            if (!widget || !this.activeWidgetEl) {
                return;
            }

            this.widgetDrag({
                widget,
                el: this.activeWidgetEl,
                event,
            });
            return;
        }

        if (this.isResizingWidget()) {
            const widgetId = this.selectedWidgetId();
            const widget = widgetId ? this.widgetsState.getById(widgetId) : null;

            if (!widget || !this.activeWidgetEl) {
                return;
            }

            this.widgetResize({
                widget,
                el: this.activeWidgetEl,
                event,
            });
        }
    }

    public handleGlobalPointerUp(event: PointerLikeEvent) {
        if (this.isDraggingWidget()) {
            const widgetId = this.selectedWidgetId();
            const widget = widgetId ? this.widgetsState.getById(widgetId) : null;

            if (!widget || !this.activeWidgetEl) {
                return;
            }

            this.widgetDragEnd({
                widget,
                el: this.activeWidgetEl,
                event,
            });
            return;
        }

        if (this.isResizingWidget()) {
            const widgetId = this.selectedWidgetId();
            const widget = widgetId ? this.widgetsState.getById(widgetId) : null;

            if (!widget || !this.activeWidgetEl) {
                return;
            }

            this.widgetResizeEnd({
                widget,
                el: this.activeWidgetEl,
                event,
            });
        }
    }

    public widgetDragStart({widget, el, event}: { widget: WidgetStateItem, el: HTMLElement, event: PointerLikeEvent }) {
        if (event.button !== 0 || !this.canvasEl || this.isSpacePressed()) {
            return;
        }

        if (widget.locked) {
            return;
        }

        // Selection is independent from drag permission.
        this.selectWidget(widget.uuid);

        if (!this.canMoveWidget()) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.isDraggingWidget.set(true);
        this.activeWidgetEl = el;
        el.classList.add(this.WIDGET_DRAGGING_CLASS);
        el.style.zIndex = '9999';

        const pointerCanvas = this.getPointerCanvasPoint(event);
        this.widgetDragOffset = this.widgetDragService.createDragOffset({
            pointerCanvas,
            widget,
        });

        this.objectSnapGuides.set({});
    }

    public widgetDrag({widget, el, event}: { widget: WidgetStateItem, el: HTMLElement, event: PointerLikeEvent }) {
        if (!el.classList.contains(this.WIDGET_DRAGGING_CLASS) || !this.widgetDragOffset) {
            return;
        }

        const pointerCanvas = this.getPointerCanvasPoint(event);
        const siblings = this.widgetsState.list().filter((item) => item.uuid !== widget.uuid);
        const moveResult = this.widgetDragService.computeNextPosition({
            pointerCanvas,
            dragOffset: this.widgetDragOffset,
            widget,
            siblings,
            snapToGrid: this.canSnapToGrid(),
            snapSize: this.snapSize(),
            snapToObjects: this.canSnapToObjects(),
            objectSnapDistance: this.objectSnapDistance,
            snapToBorder: this.canSnapToBorder(),
            borderSnapDistance: this.borderSnapDistance,
            zoom: this.zoom(),
            canExitBorders: this.canExitBorders(),
            canvas: {width: this.width(), height: this.height()},
        });

        const next = moveResult.point;
        this.objectSnapGuides.set(this.canSnapToObjects() || this.canSnapToBorder() ? moveResult.guides : {});

        el.style.left = `${next.x}px`;
        el.style.top = `${next.y}px`;
    }

    public widgetDragEnd({widget, el}: { widget: WidgetStateItem, el: HTMLElement, event?: PointerLikeEvent }) {
        if (!el.classList.contains(this.WIDGET_DRAGGING_CLASS)) {
            return;
        }

        el.classList.remove(this.WIDGET_DRAGGING_CLASS);
        el.style.zIndex = this.getWidgetRenderZIndex(widget).toString();
        this.isDraggingWidget.set(false);
        this.activeWidgetEl = null;
        this.widgetDragOffset = null;
        this.objectSnapGuides.set({});

        const stateWidget = this.widgetsState.getById(widget.uuid);
        if (!stateWidget) {
            return;
        }

        this.widgetsState.update({
            ...stateWidget,
            ...this.widgetDragService.readElementPosition(el),
        });
    }

    public widgetResizeStart({widget, el, event, position}: {
        widget: WidgetStateItem,
        el: HTMLElement,
        event: PointerLikeEvent,
        position: ResizePosition
    }) {
        if (event.button !== 0 || !this.canResizeWidget() || widget.locked || this.isSpacePressed()) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.isResizingWidget.set(true);
        this.widgetResizingPosition.set(position);
        this.selectWidget(widget.uuid);
        this.activeWidgetEl = el;
        el.classList.add(this.WIDGET_RESIZING_CLASS);
        el.style.zIndex = '9999';

        this.resizeStartPointer = this.getPointerCanvasPoint(event);
        this.resizeStartRect = this.widgetResizeService.readElementRect(el, {
            width: this.snapSize(),
            height: this.snapSize(),
        });
        this.resizeStartAspectRatio = this.resizeStartRect.height > 0
            ? this.resizeStartRect.width / this.resizeStartRect.height
            : null;
    }

    public widgetResize({el, event}: { widget: WidgetStateItem, el: HTMLElement, event: PointerLikeEvent }) {
        if (!el.classList.contains(this.WIDGET_RESIZING_CLASS) || !this.resizeStartPointer || !this.resizeStartRect) {
            return;
        }

        const position = this.widgetResizingPosition();
        if (!position) {
            return;
        }

        const pointerCanvas = this.getPointerCanvasPoint(event);
        const delta = {
            x: pointerCanvas.x - this.resizeStartPointer.x,
            y: pointerCanvas.y - this.resizeStartPointer.y,
        };

        const nextRect = this.widgetResizeService.computeNextRect({
            handle: position,
            initialRect: this.resizeStartRect,
            delta,
            min: {width: this.snapSize(), height: this.snapSize()},
            snapToGrid: this.canSnapToGrid(),
            snapSize: this.snapSize(),
            canExitBorders: this.canExitBorders(),
            canvas: {width: this.width(), height: this.height()},
            keepAspectRatio: event.shiftKey,
            aspectRatio: this.resizeStartAspectRatio ?? undefined,
            snapToObjects: this.canSnapToObjects(),
            objectSnapDistance: this.objectSnapDistance,
            snapToBorder: this.canSnapToBorder(),
            borderSnapDistance: this.borderSnapDistance,
            siblings: this.widgetsState.list().filter(w => w.uuid !== this.selectedWidgetId()),
            zoom: this.zoom(),
        });

        this.objectSnapGuides.set(
            this.canSnapToObjects() || this.canSnapToBorder() ? nextRect.guides : {}
        );

        el.style.width = `${nextRect.rect.width}px`;
        el.style.height = `${nextRect.rect.height}px`;
        el.style.left = `${nextRect.rect.x}px`;
        el.style.top = `${nextRect.rect.y}px`;
    }

    public widgetResizeEnd({widget, el, event}: {
        widget: WidgetStateItem,
        el: HTMLElement,
        event?: PointerLikeEvent
    }) {
        event?.stopPropagation();

        if (!el.classList.contains(this.WIDGET_RESIZING_CLASS)) {
            return;
        }

        el.classList.remove(this.WIDGET_RESIZING_CLASS);
        el.style.zIndex = this.getWidgetRenderZIndex(widget).toString();
        this.isResizingWidget.set(false);
        this.widgetResizingPosition.set(null);
        this.activeWidgetEl = null;
        this.resizeStartPointer = null;
        this.resizeStartRect = null;
        this.resizeStartAspectRatio = null;
        this.objectSnapGuides.set({});

        const stateWidget = this.widgetsState.getById(widget.uuid);
        if (!stateWidget) {
            return;
        }

        const rect = this.widgetResizeService.readElementRect(el, {
            width: this.snapSize(),
            height: this.snapSize(),
        });

        this.widgetsState.update({
            ...stateWidget,
            width: rect.width,
            height: rect.height,
            x: rect.x,
            y: rect.y,
        });
    }

    private canvasZoomBy(delta: number, focalPoint?: Point2D) {
        const oldZoom = this.zoom();
        const nextZoom = this.viewportService.clampZoom(Math.round((oldZoom + delta) * 100) / 100);

        if (oldZoom === nextZoom || !this.canvasEl) {
            return;
        }

        if (!focalPoint || !this.canvasWrapperEl) {
            this.zoom.set(nextZoom);
            return;
        }

        const canvasRect = this.canvasEl.getBoundingClientRect();
        const wrapperRect = this.canvasWrapperEl.getBoundingClientRect();

        const next = this.viewportService.zoomFromFocalPoint({
            delta,
            oldZoom,
            focalPoint,
            canvasOffset: {x: canvasRect.left, y: canvasRect.top},
            wrapperOffset: {x: wrapperRect.left, y: wrapperRect.top},
        });

        this.zoom.set(next.zoom);
        this.left.set(next.left);
        this.top.set(next.top);
    }

    private updateSelectedWidgetRect(patch: Partial<Rect2D>) {
        const widget = this.selectedWidget();
        if (!widget) {
            return;
        }

        if (widget.locked) {
            return;
        }

        const isMovePatch = typeof patch.x === 'number' || typeof patch.y === 'number';
        if (isMovePatch && !this.canMoveWidget()) {
            return;
        }

        const isResizePatch = typeof patch.width === 'number' || typeof patch.height === 'number';
        if (isResizePatch && !this.canResizeWidget()) {
            return;
        }

        const snap = this.canSnapToGrid() ? Math.max(1, this.snapSize()) : 1;

        let next: Rect2D = {
            x: Math.round(patch.x ?? widget.x),
            y: Math.round(patch.y ?? widget.y),
            width: Math.max(1, Math.round(patch.width ?? widget.width)),
            height: Math.max(1, Math.round(patch.height ?? widget.height)),
        };

        if (this.canSnapToGrid()) {
            const snappedPoint = snapPointToGrid({
                point: {x: next.x, y: next.y},
                snap,
            });

            next = {
                ...next,
                x: snappedPoint.x,
                y: snappedPoint.y,
                width: Math.max(snap, Math.round(next.width / snap) * snap),
                height: Math.max(snap, Math.round(next.height / snap) * snap),
            };
        }

        if (!this.canExitBorders()) {
            next = clampRectInsideCanvas({
                rect: next,
                canvas: {
                    width: this.width(),
                    height: this.height(),
                },
            });
        }

        this.widgetsState.update({
            ...widget,
            ...next,
        });
    }

    private scheduleSnapshotFlush() {
        if (this.isSnapshotFlushScheduled) {
            return;
        }

        this.isSnapshotFlushScheduled = true;

        queueMicrotask(() => {
            this.isSnapshotFlushScheduled = false;

            if (!this.pendingSnapshot) {
                return;
            }

            this.commitSnapshot(this.pendingSnapshot);
            this.pendingSnapshot = null;
        });
    }

    private commitSnapshot(nextSnapshot: EditorStateSnapshot) {
        if (this.isApplyingSnapshot) {
            this.currentSnapshot = nextSnapshot;
            this.writeSnapshotToStorage(nextSnapshot);
            this.scheduleProjectDirectorySync();
            return;
        }

        if (this.currentSnapshot && this.areSnapshotsEqual(this.currentSnapshot, nextSnapshot)) {
            return;
        }

        if (this.currentSnapshot) {
            const previousSnapshot = this.currentSnapshot;
            this.undoStack.update((items) => this.limitHistory([...items, previousSnapshot]));
            this.redoStack.set([]);
        }

        this.currentSnapshot = nextSnapshot;
        this.writeSnapshotToStorage(nextSnapshot);
        this.scheduleProjectDirectorySync();
    }

    private scheduleProjectDirectorySync(): void {
        if (!this.projectDirectoryHandle) {
            return;
        }

        this.projectHasPendingChanges.set(true);

        if (this.projectSyncTimeout) {
            clearTimeout(this.projectSyncTimeout);
        }

        this.projectSyncTimeout = setTimeout(() => {
            this.projectSyncTimeout = null;
            void this.syncProjectToDirectoryNow();
        }, this.projectSyncDebounceMs);
    }

    private limitHistory(items: EditorStateSnapshot[]): EditorStateSnapshot[] {
        if (items.length <= this.HISTORY_LIMIT) {
            return items;
        }

        return items.slice(items.length - this.HISTORY_LIMIT);
    }

    private buildSnapshot(): EditorStateSnapshot {
        return {
            canvas: {
                width: this.width(),
                height: this.height(),
                zoom: this.zoom(),
                top: this.top(),
                left: this.left(),
                snapSize: this.snapSize(),
                canExitBorders: this.canExitBorders(),
                canSnapToGrid: this.canSnapToGrid(),
                canSnapToObjects: this.canSnapToObjects(),
                canSnapToBorder: this.canSnapToBorder(),
                canResizeWidget: this.canResizeWidget(),
                canMoveWidget: this.canMoveWidget(),
                showGrid: this.showGrid(),
                showContainer: this.showContainer(),
                debugMode: this.debugMode(),
                debugPanelVisible: this.debugPanelVisible(),
                settingsPanelLayout: this.settingsPanelLayout(),
                layersPanelLayout: this.layersPanelLayout(),
                selectedWidgetId: this.selectedWidgetId(),
                projectName: this.projectName(),
            },
            widgets: this.widgetsState.list().map((widget) => this.cloneWidget(widget)),
        };
    }

    private applySnapshot(snapshot: EditorStateSnapshot) {
        this.isApplyingSnapshot = true;

        const canvas = snapshot.canvas;

        this.width.set(Math.max(1, Math.round(canvas.width)));
        this.height.set(Math.max(1, Math.round(canvas.height)));
        this.zoom.set(this.viewportService.clampZoom(canvas.zoom));
        this.top.set(Math.round(canvas.top));
        this.left.set(Math.round(canvas.left));
        this.snapSize.set(Math.max(1, Math.round(canvas.snapSize)));

        this.canExitBorders.set(canvas.canExitBorders);
        this.canSnapToGrid.set(canvas.canSnapToGrid);
        this.canSnapToObjects.set(canvas.canSnapToObjects);
        this.canSnapToBorder.set(canvas.canSnapToBorder);
        this.canResizeWidget.set(canvas.canResizeWidget);
        this.canMoveWidget.set(canvas.canMoveWidget);
        this.showGrid.set(canvas.showGrid);
        this.showContainer.set(canvas.showContainer);
        this.debugMode.set(canvas.debugMode);
        this.debugPanelVisible.set(canvas.debugPanelVisible);
        this.settingsPanelLayout.set(canvas.settingsPanelLayout);
        this.layersPanelLayout.set(canvas.layersPanelLayout);
        this.projectName.set(canvas.projectName ?? 'Untitled Project');

        this.widgetsState.replaceAll(snapshot.widgets.map((widget) => this.cloneWidget(widget)));

        const selectedWidgetExists = !!canvas.selectedWidgetId && !!this.widgetsState.getById(canvas.selectedWidgetId);
        this.selectedWidgetId.set(selectedWidgetExists ? canvas.selectedWidgetId : null);
        this.objectSnapGuides.set({});

        this.isApplyingSnapshot = false;
    }

    private cloneWidget(widget: WidgetStateItem): WidgetStateItem {
        if (widget.content.type === 'text') {
            return {
                ...widget,
                content: {
                    ...widget.content,
                    style: {...widget.content.style},
                },
            };
        }

        return {
            ...widget,
            content: {...widget.content},
        };
    }

    private areSnapshotsEqual(a: EditorStateSnapshot, b: EditorStateSnapshot): boolean {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    private loadSnapshotFromStorage(): EditorStateSnapshot | null {
        const storage = this.getLocalStorage();
        if (!storage) {
            return null;
        }

        const raw = storage.getItem(this.STORAGE_KEY);
        if (!raw) {
            return null;
        }

        try {
            const parsed = JSON.parse(raw) as Partial<EditorStateSnapshot>;

            if (!parsed.canvas || !Array.isArray(parsed.widgets)) {
                return null;
            }

            return {
                canvas: parsed.canvas as CanvasSnapshot,
                widgets: parsed.widgets as WidgetStateItem[],
            };
        } catch {
            return null;
        }
    }

    private writeSnapshotToStorage(snapshot: EditorStateSnapshot) {
        const storage = this.getLocalStorage();
        if (!storage) {
            return;
        }

        const storageSnapshot = this.createStorageSnapshot(snapshot);
        storage.setItem(this.STORAGE_KEY, JSON.stringify(storageSnapshot));
    }

    private createStorageSnapshot(snapshot: EditorStateSnapshot): EditorStateSnapshot {
        if (!this.projectDirectoryHandle) {
            return {
                canvas: {...snapshot.canvas},
                widgets: snapshot.widgets.map((widget) => this.cloneWidget(widget)),
            };
        }

        return {
            canvas: {...snapshot.canvas},
            widgets: snapshot.widgets.map((widget) => {
                if (!this.isMediaContent(widget.content)) {
                    return this.cloneWidget(widget);
                }

                const source = widget.content.src.trim();
                const isManagedAssetSource = source.startsWith(`${this.PROJECT_ASSETS_DIR}/`);
                const isExternalUrl = source.startsWith('http://') || source.startsWith('https://');
                const isInlineOrBlobSource = source.startsWith('data:') || source.startsWith('blob:');

                if (!source || isManagedAssetSource || isExternalUrl || !isInlineOrBlobSource) {
                    return this.cloneWidget(widget);
                }

                const fallbackExtension = widget.content.type === 'video' ? 'mp4' : 'png';
                const extension = this.resolveManagedAssetSourceExtension(source, fallbackExtension);

                return {
                    ...this.cloneWidget(widget),
                    content: {
                        ...widget.content,
                        src: `${this.PROJECT_ASSETS_DIR}/${this.PROJECT_MANAGED_ASSET_PREFIX}${widget.uuid}.${extension}`,
                    },
                };
            }),
        };
    }

    private resolveManagedAssetSourceExtension(source: string, fallbackExtension: string): string {
        if (source.startsWith('data:')) {
            const mimeMatch = source.match(/^data:([^;]+);base64,/);
            if (mimeMatch?.[1]) {
                return this.mimeTypeToExtension(mimeMatch[1]);
            }
            return fallbackExtension;
        }

        if (source.startsWith('blob:')) {
            return fallbackExtension;
        }

        try {
            const url = new URL(source);
            const fileName = url.pathname.split('/').filter(Boolean).pop() ?? '';
            const extension = fileName.split('.').pop()?.toLowerCase();
            return extension && /^[a-z0-9]+$/.test(extension) ? extension : fallbackExtension;
        } catch {
            return fallbackExtension;
        }
    }

    private async createDirectorySnapshot(directoryHandle: FileSystemDirectoryHandleLike): Promise<EditorStateSnapshot> {
        const snapshot = this.buildSnapshot();
        const assetsDirectory = await directoryHandle.getDirectoryHandle(this.PROJECT_ASSETS_DIR, {create: true});
        const usedAssetNames = new Set<string>();

        const widgets = await Promise.all(snapshot.widgets.map(async (widget) => {
            if (!this.isMediaContent(widget.content)) {
                return this.cloneWidget(widget);
            }

            const source = widget.content.src.trim();
            if (!source) {
                return this.cloneWidget(widget);
            }

            const blob = await this.resolveImageBlobFromSource(source);
            if (!blob) {
                return this.cloneWidget(widget);
            }

            const fallbackMimeType = widget.content.type === 'video' ? 'video/mp4' : 'image/png';
            const extension = this.mimeTypeToExtension(blob.type || fallbackMimeType);
            const assetName = `${this.PROJECT_MANAGED_ASSET_PREFIX}${widget.uuid}.${extension}`;
            await this.writeBlobToDirectory(assetsDirectory, assetName, blob);
            usedAssetNames.add(assetName);

            return {
                ...this.cloneWidget(widget),
                content: {
                    ...widget.content,
                    src: `${this.PROJECT_ASSETS_DIR}/${assetName}`,
                },
            };
        }));

        await this.cleanupUnusedAssetsInDirectory(assetsDirectory, usedAssetNames);

        return {
            canvas: {...snapshot.canvas},
            widgets,
        };
    }

    private async cleanupUnusedAssetsInDirectory(
        assetsDirectory: FileSystemDirectoryHandleLike,
        usedAssetNames: Set<string>,
    ): Promise<void> {
        if (!assetsDirectory.entries || !assetsDirectory.removeEntry) {
            return;
        }

        for await (const [entryName] of assetsDirectory.entries()) {
            if (!entryName.startsWith(this.PROJECT_MANAGED_ASSET_PREFIX)) {
                continue;
            }

            if (usedAssetNames.has(entryName)) {
                continue;
            }

            await assetsDirectory.removeEntry(entryName);
        }
    }

    private async isDirectoryEmpty(directoryHandle: FileSystemDirectoryHandleLike): Promise<boolean> {
        if (!directoryHandle.entries) {
            return false;
        }

        for await (const _entry of directoryHandle.entries()) {
            return false;
        }

        return true;
    }

    private async hydrateSnapshotAssetsFromDirectory(
        snapshot: EditorStateSnapshot,
        directoryHandle: FileSystemDirectoryHandleLike,
    ): Promise<EditorStateSnapshot> {
        const widgets = await Promise.all(snapshot.widgets.map(async (widget) => {
            if (!this.isMediaContent(widget.content)) {
                return this.cloneWidget(widget);
            }

            const source = widget.content.src.trim();
            if (!source.startsWith(`${this.PROJECT_ASSETS_DIR}/`)) {
                return this.cloneWidget(widget);
            }

            try {
                const assetName = source.slice((`${this.PROJECT_ASSETS_DIR}/`).length);
                const assetsDirectory = await directoryHandle.getDirectoryHandle(this.PROJECT_ASSETS_DIR, {create: false});
                const fileHandle = await assetsDirectory.getFileHandle(assetName, {create: false});
                const file = await fileHandle.getFile();
                const dataUrl = await this.blobToDataUrl(file);

                return {
                    ...this.cloneWidget(widget),
                    content: {
                        ...widget.content,
                        src: dataUrl,
                    },
                };
            } catch {
                return this.cloneWidget(widget);
            }
        }));

        return {
            canvas: {...snapshot.canvas},
            widgets,
        };
    }

    private async writeSnapshotToDirectory(
        directoryHandle: FileSystemDirectoryHandleLike,
        snapshot: EditorStateSnapshot,
    ): Promise<void> {
        const fileHandle = await directoryHandle.getFileHandle(this.PROJECT_STATE_FILE, {create: true});
        if (!fileHandle.createWritable) {
            throw new Error('The selected folder does not support write operations.');
        }

        const writable = await fileHandle.createWritable();
        await writable.write(new Blob([JSON.stringify(snapshot, null, 2)], {type: 'application/json'}));
        await writable.close();
    }

    private async writeBlobToDirectory(
        directoryHandle: FileSystemDirectoryHandleLike,
        fileName: string,
        blob: Blob,
    ): Promise<void> {
        const fileHandle = await directoryHandle.getFileHandle(fileName, {create: true});
        if (!fileHandle.createWritable) {
            throw new Error('Cannot write asset file to the selected directory.');
        }

        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
    }

    private getLocalStorage(): Storage | null {
        try {
            if (typeof window === 'undefined' || !window.localStorage) {
                return null;
            }

            return window.localStorage;
        } catch {
            return null;
        }
    }

    private markProjectDirectoryPromptAsConnectedChoice(): void {
        this.getLocalStorage()?.setItem(this.PROJECT_DIRECTORY_PROMPT_SEEN_KEY, '0');
    }

    private async restoreProjectDirectoryConnection(): Promise<void> {
        try {
            const restoredHandle = await this.readPersistedProjectDirectoryHandle();
            if (!restoredHandle) {
                return;
            }

            const permission = await this.resolveDirectoryPermission(restoredHandle, false);
            if (permission !== 'granted') {
                await this.clearPersistedProjectDirectoryHandle();
                return;
            }

            this.projectDirectoryHandle = restoredHandle;
            this.projectDirectoryName.set(restoredHandle.name ?? 'Selected folder');
            this.projectSyncStatus.set('idle');
            this.projectSyncError.set(null);

            if (this.isHistoryReady) {
                void this.hydrateCurrentSnapshotAssetSourcesFromConnectedDirectory();
            }
        } finally {
            this.projectDirectoryRestoreReady.set(true);
        }
    }

    private async hydrateCurrentSnapshotAssetSourcesFromConnectedDirectory(): Promise<void> {
        const directoryHandle = this.projectDirectoryHandle;
        if (!directoryHandle) {
            return;
        }

        const currentSnapshot = this.buildSnapshot();
        const hasManagedAssetReferences = currentSnapshot.widgets.some((widget) => {
            return this.isMediaContent(widget.content)
                && widget.content.src.trim().startsWith(`${this.PROJECT_ASSETS_DIR}/`);
        });

        if (!hasManagedAssetReferences) {
            return;
        }

        const hydratedSnapshot = await this.hydrateSnapshotAssetsFromDirectory(currentSnapshot, directoryHandle);
        if (this.areSnapshotsEqual(currentSnapshot, hydratedSnapshot)) {
            return;
        }

        const wasHistoryReady = this.isHistoryReady;
        this.isHistoryReady = false;
        this.applySnapshot(hydratedSnapshot);
        this.currentSnapshot = this.buildSnapshot();
        this.writeSnapshotToStorage(this.currentSnapshot);
        this.isHistoryReady = wasHistoryReady;
    }

    private async resolveDirectoryPermission(
        directoryHandle: FileSystemDirectoryHandleLike,
        requestIfPrompt: boolean,
    ): Promise<'granted' | 'denied' | 'prompt'> {
        if (!directoryHandle.queryPermission) {
            return 'granted';
        }

        const current = await directoryHandle.queryPermission({mode: 'readwrite'});
        if (current !== 'prompt' || !requestIfPrompt || !directoryHandle.requestPermission) {
            return current;
        }

        return directoryHandle.requestPermission({mode: 'readwrite'});
    }

    private async persistProjectDirectoryHandle(directoryHandle: FileSystemDirectoryHandleLike): Promise<void> {
        const db = await this.openProjectHandleDb();
        if (!db) {
            return;
        }

        try {
            await new Promise<void>((resolve) => {
                const tx = db.transaction(this.PROJECT_HANDLE_STORE_NAME, 'readwrite');
                try {
                    tx.objectStore(this.PROJECT_HANDLE_STORE_NAME).put(directoryHandle, this.PROJECT_HANDLE_KEY);
                } catch {
                    resolve();
                    return;
                }
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
                tx.onabort = () => resolve();
            });
        } finally {
            db.close();
        }
    }

    private async readPersistedProjectDirectoryHandle(): Promise<FileSystemDirectoryHandleLike | null> {
        const db = await this.openProjectHandleDb();
        if (!db) {
            return null;
        }

        try {
            return await new Promise<FileSystemDirectoryHandleLike | null>((resolve) => {
                const tx = db.transaction(this.PROJECT_HANDLE_STORE_NAME, 'readonly');
                const req = tx.objectStore(this.PROJECT_HANDLE_STORE_NAME).get(this.PROJECT_HANDLE_KEY);

                req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandleLike | undefined) ?? null);
                req.onerror = () => resolve(null);
                tx.onabort = () => resolve(null);
            });
        } finally {
            db.close();
        }
    }

    private async clearPersistedProjectDirectoryHandle(): Promise<void> {
        const db = await this.openProjectHandleDb();
        if (!db) {
            return;
        }

        try {
            await new Promise<void>((resolve) => {
                const tx = db.transaction(this.PROJECT_HANDLE_STORE_NAME, 'readwrite');
                tx.objectStore(this.PROJECT_HANDLE_STORE_NAME).delete(this.PROJECT_HANDLE_KEY);
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
                tx.onabort = () => resolve();
            });
        } finally {
            db.close();
        }
    }

    private openProjectHandleDb(): Promise<IDBDatabase | null> {
        return new Promise((resolve) => {
            if (typeof indexedDB === 'undefined') {
                resolve(null);
                return;
            }

            let request: IDBOpenDBRequest;
            try {
                request = indexedDB.open(this.PROJECT_HANDLE_DB_NAME, 1);
            } catch {
                resolve(null);
                return;
            }

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.PROJECT_HANDLE_STORE_NAME)) {
                    db.createObjectStore(this.PROJECT_HANDLE_STORE_NAME);
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        });
    }

    public async exportToFile(filename?: string): Promise<void> {
        const finalFilename = filename ?? this.projectName();
        const archiveSnapshot = await this.createArchiveSnapshot();
        const archiveEntries = await this.buildProjectArchiveEntries(archiveSnapshot);
        const archive = zipSync(archiveEntries, {level: 6});
        const blob = new Blob([this.toArrayBuffer(archive)], {type: 'application/zip'});
        this.downloadBlob(blob, `${finalFilename}.${this.PROJECT_ARCHIVE_EXTENSION}`);
    }

    public async importFromFile(): Promise<void> {
        const file = await this.pickProjectArchiveFile();
        if (!file) {
            return;
        }

        this.projectImportNotice.set(null);
        this.projectSyncError.set(null);

        try {
            const archiveBuffer = await file.arrayBuffer();
            const archiveEntries = unzipSync(new Uint8Array(archiveBuffer));
            const snapshot = this.readSnapshotFromProjectArchive(archiveEntries);
            const hydratedSnapshot = await this.hydrateSnapshotAssetsFromArchive(snapshot, archiveEntries);

            const persistResult = await this.persistArchiveToSelectedDirectory(archiveEntries);
            if (persistResult.status === 'saved') {
                this.projectDirectoryHandle = persistResult.directoryHandle;
                this.projectDirectoryName.set(persistResult.directoryHandle.name ?? this.PROJECT_SYNC_DIR);
                this.projectSyncStatus.set('idle');
                this.projectSyncError.set(null);
                this.projectLastSyncedAt.set(new Date());
                this.projectHasPendingChanges.set(false);
                await this.persistProjectDirectoryHandle(persistResult.directoryHandle);
                this.clearPendingImportBackup();
                this.projectImportNotice.set({
                    kind: 'success',
                    message: 'Project imported and synced to the selected sync folder.',
                });
            } else if (persistResult.status === 'skipped') {
                this.projectSyncStatus.set('idle');
                this.projectSyncError.set(null);
                this.storePendingImportBackup(archiveEntries, 'project-import-sync-backup.zip');
                this.projectImportNotice.set({
                    kind: 'info',
                    message: 'Project imported in memory. Folder write was skipped by preference. Save the backup zip or connect a folder later.',
                });
            } else if (persistResult.status === 'cancelled') {
                this.projectSyncStatus.set('idle');
                this.projectSyncError.set(null);
                this.storePendingImportBackup(archiveEntries, 'project-import-sync-backup.zip');
                this.projectImportNotice.set({
                    kind: 'warning',
                    message: 'Folder selection was cancelled. Project imported in memory only. Save the backup zip to keep sync files.',
                });
            } else if (persistResult.status === 'unsupported') {
                this.projectSyncStatus.set('idle');
                this.projectSyncError.set(null);
                this.storePendingImportBackup(archiveEntries, 'project-import-sync-backup.zip');
                this.projectImportNotice.set({
                    kind: 'warning',
                    message: 'This browser cannot write project files to a local folder. Save the backup zip manually.',
                });
            } else {
                this.projectSyncStatus.set('error');
                this.projectSyncError.set(persistResult.message);
                this.projectImportNotice.set({
                    kind: 'error',
                    message: 'Project imported in memory, but writing sync files failed.',
                });
            }

            this.applySnapshot(hydratedSnapshot);
            this.currentSnapshot = this.buildSnapshot();
            this.writeSnapshotToStorage(this.currentSnapshot);
            this.undoStack.set([]);
            this.redoStack.set([]);
        } catch (err) {
            this.projectImportNotice.set({
                kind: 'error',
                message: 'Project import failed. The zip file may be invalid.',
            });
            console.error('[CanvasService] Failed to import project .zip', err);
        }
    }

    public setImportPromptForDirectory(value: boolean): void {
        this.importPromptForDirectory.set(value);
    }

    public dismissProjectImportNotice(): void {
        this.projectImportNotice.set(null);
    }

    public async savePendingImportBackup(): Promise<void> {
        const blob = this.pendingImportBackupBlob();
        if (!blob) {
            return;
        }

        await this.writeBlobToDisk(blob, this.pendingImportBackupFileName());
        this.clearPendingImportBackup();
        this.projectImportNotice.set({
            kind: 'success',
            message: 'Backup zip saved to disk.',
        });
    }

    private async createArchiveSnapshot(): Promise<{ snapshot: EditorStateSnapshot; assets: Map<string, Blob> }> {
        const snapshot = this.buildSnapshot();
        const assets = new Map<string, Blob>();

        const widgets = await Promise.all(snapshot.widgets.map(async (widget) => {
            if (!this.isMediaContent(widget.content)) {
                return this.cloneWidget(widget);
            }

            const source = widget.content.src.trim();
            if (!source) {
                return this.cloneWidget(widget);
            }

            const blob = await this.resolveImageBlobFromSource(source);
            if (!blob) {
                return this.cloneWidget(widget);
            }

            const fallbackMimeType = widget.content.type === 'video' ? 'video/mp4' : 'image/png';
            const extension = this.mimeTypeToExtension(blob.type || fallbackMimeType);
            const assetName = `${this.PROJECT_MANAGED_ASSET_PREFIX}${widget.uuid}.${extension}`;
            assets.set(assetName, blob);

            return {
                ...this.cloneWidget(widget),
                content: {
                    ...widget.content,
                    src: `${this.PROJECT_ASSETS_DIR}/${assetName}`,
                },
            };
        }));

        return {
            snapshot: {
                canvas: {...snapshot.canvas},
                widgets,
            },
            assets,
        };
    }

    private async buildProjectArchiveEntries(
        archiveSnapshot: { snapshot: EditorStateSnapshot; assets: Map<string, Blob> },
    ): Promise<Record<string, Uint8Array>> {
        const entries: Record<string, Uint8Array> = {};
        const statePath = `${this.PROJECT_SYNC_DIR}/${this.PROJECT_STATE_FILE}`;
        entries[statePath] = strToU8(JSON.stringify(archiveSnapshot.snapshot, null, 2));

        for (const [assetName, blob] of archiveSnapshot.assets.entries()) {
            const assetPath = `${this.PROJECT_SYNC_DIR}/${this.PROJECT_ASSETS_DIR}/${assetName}`;
            const buffer = await blob.arrayBuffer();
            entries[assetPath] = new Uint8Array(buffer);
        }

        return entries;
    }

    private async pickProjectArchiveFile(): Promise<File | null> {
        const fsApi = this.getFileSystemAccessApi();

        if (fsApi?.showOpenFilePicker) {
            try {
                const [handle] = await fsApi.showOpenFilePicker({
                    multiple: false,
                    excludeAcceptAllOption: false,
                    types: [{
                        description: 'Video Director Project Archive',
                        accept: {'application/zip': ['.zip']},
                    }],
                });

                if (!handle) {
                    return null;
                }

                return await handle.getFile();
            } catch {
                return null;
            }
        }

        return await new Promise<File | null>((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.zip,application/zip';
            input.onchange = () => resolve(input.files?.[0] ?? null);
            input.click();
        });
    }

    private readSnapshotFromProjectArchive(archiveEntries: Record<string, Uint8Array>): EditorStateSnapshot {
        const stateEntry = archiveEntries[`${this.PROJECT_SYNC_DIR}/${this.PROJECT_STATE_FILE}`]
            ?? archiveEntries[this.PROJECT_STATE_FILE];

        if (!stateEntry) {
            throw new Error('Invalid project archive: missing sync/state.json.');
        }

        const parsed = JSON.parse(strFromU8(stateEntry)) as Partial<EditorStateSnapshot>;
        if (!parsed.canvas || !Array.isArray(parsed.widgets)) {
            throw new Error('Invalid project archive: state payload is malformed.');
        }

        return {
            canvas: parsed.canvas as CanvasSnapshot,
            widgets: parsed.widgets as WidgetStateItem[],
        };
    }

    private async hydrateSnapshotAssetsFromArchive(
        snapshot: EditorStateSnapshot,
        archiveEntries: Record<string, Uint8Array>,
    ): Promise<EditorStateSnapshot> {
        const widgets = await Promise.all(snapshot.widgets.map(async (widget) => {
            if (!this.isMediaContent(widget.content)) {
                return this.cloneWidget(widget);
            }

            const source = widget.content.src.trim();
            const normalizedSource = source.startsWith(`${this.PROJECT_SYNC_DIR}/`)
                ? source.slice(this.PROJECT_SYNC_DIR.length + 1)
                : source;

            if (!normalizedSource.startsWith(`${this.PROJECT_ASSETS_DIR}/`)) {
                return this.cloneWidget(widget);
            }

            const archivePath = `${this.PROJECT_SYNC_DIR}/${normalizedSource}`;
            const bytes = archiveEntries[archivePath] ?? archiveEntries[normalizedSource];
            if (!bytes) {
                return this.cloneWidget(widget);
            }

            const blob = new Blob([this.toArrayBuffer(bytes)], {type: this.mimeTypeFromFileName(normalizedSource)});
            const dataUrl = await this.blobToDataUrl(blob);

            return {
                ...this.cloneWidget(widget),
                content: {
                    ...widget.content,
                    src: dataUrl,
                },
            };
        }));

        return {
            canvas: {...snapshot.canvas},
            widgets,
        };
    }

    private async persistArchiveToSelectedDirectory(
        archiveEntries: Record<string, Uint8Array>,
    ): Promise<ImportArchivePersistResult> {
        if (!this.importPromptForDirectory()) {
            return {status: 'skipped'};
        }

        const fsApi = this.getFileSystemAccessApi();
        if (!fsApi?.showDirectoryPicker) {
            return {status: 'unsupported'};
        }

        try {
            const selectedRootDirectory = await fsApi.showDirectoryPicker({
                id: 'video-director-import-folder',
                mode: 'readwrite',
            });
            const syncDirectory = await selectedRootDirectory.getDirectoryHandle(this.PROJECT_SYNC_DIR, {create: true});
            const importedManagedAssets = this.collectManagedAssetNamesFromArchive(archiveEntries);

            for (const [entryPath, bytes] of Object.entries(archiveEntries)) {
                const normalizedPath = entryPath.replace(/\\/g, '/').replace(/^\.\//, '');
                if (!normalizedPath.startsWith(`${this.PROJECT_SYNC_DIR}/`)) {
                    continue;
                }

                const pathWithinSync = normalizedPath.slice(this.PROJECT_SYNC_DIR.length + 1);
                await this.writeArchiveBytesToDirectory(syncDirectory, pathWithinSync, bytes);
            }

            const assetsDirectory = await syncDirectory.getDirectoryHandle(this.PROJECT_ASSETS_DIR, {create: true});
            await this.cleanupUnusedAssetsInDirectory(assetsDirectory, importedManagedAssets);

            return {status: 'saved', directoryHandle: syncDirectory};
        } catch (error) {
            if ((error as DOMException)?.name === 'AbortError') {
                return {status: 'cancelled'};
            }

            return {
                status: 'error',
                message: 'Unable to save imported project files to the selected folder.',
            };
        }
    }

    private collectManagedAssetNamesFromArchive(archiveEntries: Record<string, Uint8Array>): Set<string> {
        const usedAssets = new Set<string>();

        for (const archivePath of Object.keys(archiveEntries)) {
            const normalizedPath = archivePath.replace(/\\/g, '/').replace(/^\.\//, '');
            const syncAssetPrefix = `${this.PROJECT_SYNC_DIR}/${this.PROJECT_ASSETS_DIR}/`;
            if (!normalizedPath.startsWith(syncAssetPrefix)) {
                continue;
            }

            const assetName = normalizedPath.slice(syncAssetPrefix.length);
            if (!assetName.startsWith(this.PROJECT_MANAGED_ASSET_PREFIX)) {
                continue;
            }

            usedAssets.add(assetName);
        }

        return usedAssets;
    }

    private saveArchiveWithFallback(archiveEntries: Record<string, Uint8Array>): Blob {
        const archive = zipSync(archiveEntries, {level: 6});
        return new Blob([this.toArrayBuffer(archive)], {type: 'application/zip'});
    }

    private storePendingImportBackup(
        archiveEntries: Record<string, Uint8Array>,
        suggestedName: string,
    ): void {
        const backupBlob = this.saveArchiveWithFallback(archiveEntries);
        this.pendingImportBackupBlob.set(backupBlob);
        this.pendingImportBackupFileName.set(suggestedName);
    }

    private clearPendingImportBackup(): void {
        this.pendingImportBackupBlob.set(null);
    }

    private async writeArchiveBytesToDirectory(
        rootDirectory: FileSystemDirectoryHandleLike,
        path: string,
        bytes: Uint8Array,
    ): Promise<void> {
        const cleanPath = path.replace(/^\//, '');
        const segments = cleanPath.split('/').filter(Boolean);
        const fileName = segments.pop();

        if (!fileName) {
            return;
        }

        let currentDirectory = rootDirectory;
        for (const segment of segments) {
            currentDirectory = await currentDirectory.getDirectoryHandle(segment, {create: true});
        }

        const fileHandle = await currentDirectory.getFileHandle(fileName, {create: true});
        if (!fileHandle.createWritable) {
            throw new Error('The selected folder does not support write operations.');
        }

        const writable = await fileHandle.createWritable();
        await writable.write(new Blob([this.toArrayBuffer(bytes)]));
        await writable.close();
    }

    private toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
        return new Uint8Array(bytes).buffer;
    }

    // 1×1 transparent PNG used as placeholder when an image cannot be fetched
    private static readonly TRANSPARENT_PNG =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    public async exportCanvasAsImage(filename?: string): Promise<void> {
        const source = this.canvasEl;
        if (!source) {
            console.error('[CanvasService] exportCanvasAsImage: canvasEl is null');
            return;
        }

        const finalFilename = filename ?? this.projectName();
        const exportWidth = this.width();
        const exportHeight = this.height();

        // Work on a detached clone so pan/zoom offsets from the live canvas never affect export bounds.
        const exportNode = source.cloneNode(true) as HTMLElement;
        exportNode.classList.remove('canvas--show-grid');
        exportNode.querySelectorAll('.app-canvas-widget--selected').forEach((node) => {
            node.classList.remove('app-canvas-widget--selected');
        });
        exportNode.querySelectorAll('.app-canvas-widget--show-container').forEach((node) => {
            node.classList.remove('app-canvas-widget--show-container');
        });
        exportNode.querySelectorAll('.canvas-guide, .app-canvas-widget-resizer, .canvas-info, .widget-debug-info').forEach((node) => {
            node.remove();
        });

        // Force a normalized viewport-independent layout on the clone.
        exportNode.style.position = 'relative';
        exportNode.style.top = '0px';
        exportNode.style.left = '0px';
        exportNode.style.transform = 'none';
        exportNode.style.transformOrigin = 'top left';
        exportNode.style.outline = 'none';
        exportNode.style.width = `${exportWidth}px`;
        exportNode.style.height = `${exportHeight}px`;

        const sandbox = document.createElement('div');
        sandbox.style.position = 'fixed';
        sandbox.style.left = '-100000px';
        sandbox.style.top = '0';
        sandbox.style.width = `${exportWidth}px`;
        sandbox.style.height = `${exportHeight}px`;
        sandbox.style.overflow = 'hidden';
        sandbox.style.opacity = '0';
        sandbox.style.pointerEvents = 'none';
        sandbox.appendChild(exportNode);
        document.body.appendChild(sandbox);

        const restoredImages = await this.inlineExternalImages(exportNode);
        const capturedVideos = await this.captureVideoFrames(exportNode);

        try {
            const {toPng} = await import('html-to-image');

            const dataUrl = await toPng(exportNode, {
                width: exportWidth,
                height: exportHeight,
                pixelRatio: window.devicePixelRatio || 1,
                cacheBust: true,
                imagePlaceholder: CanvasService.TRANSPARENT_PNG,
                fetchRequestInit: {mode: 'cors', credentials: 'omit'},
            });

            const anchor = document.createElement('a');
            anchor.href = dataUrl;
            anchor.download = `${finalFilename}.png`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
        } catch (err) {
            console.error('[CanvasService] exportCanvasAsImage failed:', err);
            throw err;
        } finally {
            restoredImages.forEach(({img, originalSrc}) => {
                img.src = originalSrc;
            });
            document.body.removeChild(sandbox);
        }
    }

    /**
     * For every <img> inside `root` whose src is an external URL, attempts to
     * convert it to an inline data: URL so that html-to-image never has to issue
     * a cross-origin fetch itself (which would throw a CORS TypeError).
     *
     * Strategy (waterfall, first success wins):
     *  1. Draw the already-loaded img element to an offscreen canvas → toDataURL()
     *     Works instantly for same-origin images or images previously loaded with CORS.
     *  2. fetch() with mode:'cors' → FileReader → data URL
     *     Works for cross-origin servers that send Access-Control-Allow-Origin.
     *  3. Load a fresh <img crossOrigin="anonymous"> and draw to canvas.
     *     A second attempt in case the browser cache had a non-CORS entry.
     *  4. Transparent 1×1 PNG placeholder.
     *     Prevents html-to-image from crashing; image slot stays empty.
     */
    private async inlineExternalImages(
        root: HTMLElement,
    ): Promise<{ img: HTMLImageElement; originalSrc: string }[]> {
        const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
        const restored: { img: HTMLImageElement; originalSrc: string }[] = [];

        await Promise.allSettled(
            imgs.map(async (img) => {
                const src = img.getAttribute('src') ?? '';
                if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
                    return; // already local
                }

                restored.push({img, originalSrc: src});

                const dataUrl =
                    this.imgElementToDataUrl(img) ??
                    (await this.fetchToDataUrl(src)) ??
                    (await this.crossOriginImgToDataUrl(src)) ??
                    CanvasService.TRANSPARENT_PNG;

                img.src = dataUrl;
                // Wait for the browser to decode the replacement before html-to-image
                // reads the DOM
                await img.decode().catch(() => undefined);
            }),
        );

        return restored;
    }

    /** Strategy 1 – draw an already-loaded img to an offscreen canvas. */
    private imgElementToDataUrl(img: HTMLImageElement): string | null {
        if (!img.complete || img.naturalWidth === 0) {
            return null;
        }
        try {
            const offscreen = document.createElement('canvas');
            offscreen.width = img.naturalWidth;
            offscreen.height = img.naturalHeight;
            const ctx = offscreen.getContext('2d');
            if (!ctx) {
                return null;
            }
            ctx.drawImage(img, 0, 0);
            return offscreen.toDataURL(); // throws SecurityError for tainted canvas
        } catch {
            return null; // cross-origin → tainted canvas
        }
    }

    /** Strategy 2 – fetch the URL with CORS and convert the blob to a data URL. */
    private async fetchToDataUrl(url: string): Promise<string | null> {
        try {
            const resp = await fetch(url, {mode: 'cors', credentials: 'omit'});
            if (!resp.ok) {
                return null;
            }
            const blob = await resp.blob();
            return await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch {
            return null;
        }
    }

    /** Strategy 3 – load a fresh Image with crossOrigin=anonymous and draw to canvas.
     *  The browser cache may have a non-CORS entry; a fresh load with the CORS flag
     *  forces a new request that (for CORS-enabled servers) returns CORS headers. */
    private crossOriginImgToDataUrl(src: string): Promise<string | null> {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(this.imgElementToDataUrl(img));
            img.onerror = () => resolve(null);
            // Cache-bust to bypass any cached non-CORS response
            img.src = src + (src.includes('?') ? '&' : '?') + '__cb=' + Date.now();
        });
    }

    private async resolveImageBlobFromSource(source: string): Promise<Blob | null> {
        if (source.startsWith('data:')) {
            return this.dataUrlToBlob(source);
        }

        if (source.startsWith('blob:')) {
            try {
                const response = await fetch(source);
                if (!response.ok) {
                    return null;
                }
                return await response.blob();
            } catch {
                return null;
            }
        }

        try {
            const response = await fetch(source, {mode: 'cors', credentials: 'omit'});
            if (!response.ok) {
                return null;
            }
            return await response.blob();
        } catch {
            return null;
        }
    }

    private dataUrlToBlob(dataUrl: string): Blob | null {
        const parts = dataUrl.split(',');
        if (parts.length < 2) {
            return null;
        }

        const header = parts[0];
        const body = parts[1];
        const mimeMatch = header.match(/^data:(.+?);base64$/);
        if (!mimeMatch) {
            return null;
        }

        const mimeType = mimeMatch[1] || 'application/octet-stream';
        const binary = atob(body);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }

        return new Blob([bytes], {type: mimeType});
    }

    private blobToDataUrl(blob: Blob): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result;
                if (typeof result !== 'string') {
                    reject(new Error('Unable to convert blob to data URL'));
                    return;
                }

                resolve(result);
            };
            reader.onerror = () => reject(reader.error ?? new Error('Unable to convert blob to data URL'));
            reader.readAsDataURL(blob);
        });
    }

    private resolveFileNameFromSource(source: string, fallback: string): string {
        if (source.startsWith('data:') || source.startsWith('blob:')) {
            return fallback;
        }

        try {
            const url = new URL(source);
            const pathname = url.pathname.split('/').filter(Boolean).pop();
            return pathname && pathname.trim() ? pathname : fallback;
        } catch {
            return fallback;
        }
    }

    private normalizeImageFileName(baseName: string, mimeType: string): string {
        const cleaned = (baseName || 'widget-image').trim().replace(/\s+/g, '-');
        const hasExtension = /\.[a-z0-9]+$/i.test(cleaned);

        if (hasExtension) {
            return cleaned;
        }

        const extension = this.mimeTypeToExtension(mimeType);
        return `${cleaned}.${extension}`;
    }

    private mimeTypeToExtension(mimeType: string): string {
        const map: Record<string, string> = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/webp': 'webp',
            'image/gif': 'gif',
            'image/svg+xml': 'svg',
            'image/bmp': 'bmp',
            'video/mp4': 'mp4',
            'video/webm': 'webm',
            'video/ogg': 'ogv',
            'video/quicktime': 'mov',
        };

        return map[mimeType] ?? 'png';
    }

    private mimeTypeFromFileName(fileName: string): string {
        const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
        const map: Record<string, string> = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            webp: 'image/webp',
            gif: 'image/gif',
            svg: 'image/svg+xml',
            bmp: 'image/bmp',
            mp4: 'video/mp4',
            webm: 'video/webm',
            ogv: 'video/ogg',
            mov: 'video/quicktime',
        };

        return map[extension] ?? 'application/octet-stream';
    }

    private downloadBlob(blob: Blob, fileName: string): void {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    private async writeBlobToDisk(blob: Blob, fileName: string): Promise<void> {
        const fsApi = this.getFileSystemAccessApi();

        if (fsApi?.showSaveFilePicker) {
            const extension = '.' + (fileName.split('.').pop() ?? 'png');
            const handle = await fsApi.showSaveFilePicker({
                suggestedName: fileName,
                excludeAcceptAllOption: false,
                types: [{
                    description: 'Image file',
                    accept: {
                        [blob.type || 'image/png']: [extension],
                    },
                }],
            });

            if (!handle.createWritable) {
                return;
            }

            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        }

        this.downloadBlob(blob, fileName);
    }


    private getFileSystemAccessApi(): FileSystemAccessApi | null {
        if (typeof window === 'undefined') {
            return null;
        }

        return window as unknown as FileSystemAccessApi;
    }

    private computeAutoTextFontSize({
                                        text,
                                        fontFamily,
                                        widgetWidth,
                                        widgetHeight,
                                        widgetPadding,
                                        widgetBorderWidth,
                                    }: {
        text: string;
        fontFamily: WidgetTextFontFamily;
        widgetWidth: number;
        widgetHeight: number;
        widgetPadding: number;
        widgetBorderWidth: number;
    }): number {
        if (typeof document === 'undefined') {
            return 1;
        }

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            return 1;
        }

        const internalTextPadding = 8;
        const horizontalInset = (widgetPadding + widgetBorderWidth + internalTextPadding) * 2;
        const verticalInset = (widgetPadding + widgetBorderWidth + internalTextPadding) * 2;
        const availableWidth = Math.max(1, Math.floor(widgetWidth - horizontalInset));
        const availableHeight = Math.max(1, Math.floor(widgetHeight - verticalInset));
        const lines = (text || '').split(/\r?\n/);
        const normalizedLines = lines.length > 0 ? lines : [''];
        const lineHeightRatio = 1.2;
        const fontStack = CanvasService.TEXT_FONT_FAMILY_MAP[fontFamily];

        const fits = (size: number): boolean => {
            context.font = `${size}px ${fontStack}`;
            const widestLine = normalizedLines.reduce((maxWidth, line) => {
                const lineWidth = context.measureText(line).width;
                return Math.max(maxWidth, lineWidth);
            }, 0);

            const textHeight = normalizedLines.length * size * lineHeightRatio;
            return widestLine <= availableWidth + 1 && textHeight <= availableHeight + 1;
        };

        const minSize = 1;
        const maxSize = Math.max(minSize, Math.floor(Math.max(availableWidth, availableHeight) * 2));

        if (!fits(minSize)) {
            return minSize;
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

        return best;
    }

    private createWidget(type: WidgetContentType): void {
        const widgetSize = this.getDefaultWidgetSize(type);
        const viewportCenter = this.getViewportCenterCanvasPoint();
        let rect: Rect2D = {
            x: viewportCenter.x - widgetSize.width / 2,
            y: viewportCenter.y - widgetSize.height / 2,
            width: widgetSize.width,
            height: widgetSize.height,
        };

        if (this.canSnapToGrid()) {
            const snapped = snapPointToGrid({
                point: {x: rect.x, y: rect.y},
                snap: this.snapSize(),
            });

            rect = {
                ...rect,
                x: snapped.x,
                y: snapped.y,
            };
        }

        if (!this.canExitBorders()) {
            rect = clampRectInsideCanvas({
                rect,
                canvas: {width: this.width(), height: this.height()},
            });
        }

        const widget: WidgetStateItem = {
            uuid: uuid(),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            z: this.getNextWidgetZIndex(),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            content: this.createDefaultWidgetContent(type),
        };

        this.widgetsState.add(widget);
        this.selectWidget(widget.uuid);
        this.objectSnapGuides.set({});
    }

    private getDefaultWidgetSize(type: WidgetContentType): Size2D {
        if (type === 'text') {
            return {width: 320, height: 120};
        }

        if (type === 'image') {
            return {width: 320, height: 180};
        }

        return {width: 480, height: 270};
    }

    private createDefaultWidgetContent(type: WidgetContentType): WidgetStateItem['content'] {
        if (type === 'text') {
            return {type: 'text', text: DEFAULT_WIDGET_TEXT, style: {...DEFAULT_WIDGET_TEXT_STYLE}};
        }

        if (type === 'image') {
            return {type: 'image', src: '', alt: '', fitMode: 'cover'};
        }

        return {...DEFAULT_WIDGET_VIDEO_CONTENT};
    }

    private getViewportCenterCanvasPoint(): Point2D {
        if (!this.canvasEl) {
            return {
                x: this.width() / 2,
                y: this.height() / 2,
            };
        }

        const canvasRect = this.canvasEl.getBoundingClientRect();
        const wrapperRect = this.canvasWrapperEl?.getBoundingClientRect();
        const screenCenter = wrapperRect
            ? {
                x: wrapperRect.left + wrapperRect.width / 2,
                y: wrapperRect.top + wrapperRect.height / 2,
            }
            : {
                x: canvasRect.left + canvasRect.width / 2,
                y: canvasRect.top + canvasRect.height / 2,
            };

        return screenToCanvasPoint({
            screen: screenCenter,
            canvasOffset: {x: canvasRect.left, y: canvasRect.top},
            zoom: this.zoom(),
        });
    }

    private getNextWidgetZIndex(): number {
        const maxZ = this.widgetsState.list().reduce((currentMax, widget) => Math.max(currentMax, widget.z), 0);
        return maxZ + 1;
    }

    private isMediaContent(content: WidgetStateItem['content']): content is WidgetImageContent | WidgetVideoContent {
        return content.type === 'image' || content.type === 'video';
    }


    private getPointerCanvasPoint(event: PointerLikeEvent): Point2D {
        if (!this.canvasEl) {
            return {x: 0, y: 0};
        }

        const canvasRect = this.canvasEl.getBoundingClientRect();

        return screenToCanvasPoint({
            screen: {x: event.clientX, y: event.clientY},
            canvasOffset: {x: canvasRect.left, y: canvasRect.top},
            zoom: this.zoom(),
        });
    }


    /**
     * Capture the current frame of each <video> element in the export clone
     * and replace it with an <img> element showing that frame.
     * This ensures videos display their current content in the exported image.
     */
    private async captureVideoFrames(
        root: HTMLElement,
    ): Promise<{ videoClone: HTMLVideoElement; frameDataUrl: string }[]> {
        const videos = Array.from(root.querySelectorAll<HTMLVideoElement>('video'));
        const captured: { videoClone: HTMLVideoElement; frameDataUrl: string }[] = [];

        for (const videoClone of videos) {
            const src = videoClone.getAttribute('src') ?? '';
            if (!src) {
                // Check for <source> child elements as fallback
                const sourceEl = videoClone.querySelector<HTMLSourceElement>('source[src]');
                if (!sourceEl) {
                    continue;
                }
            }

            // Find the corresponding video in the live DOM
            const liveVideo = src
                ? document.querySelector<HTMLVideoElement>(`video[src="${src}"]`)
                : document.querySelector<HTMLVideoElement>('video');

            if (!liveVideo || liveVideo.readyState < 2) {
                // Video not loaded or metadata not ready
                continue;
            }

            // Capture the current frame
            const frameDataUrl = this.captureVideoFrame(liveVideo);
            if (!frameDataUrl) {
                continue;
            }

            // Create an image to replace the video
            const img = document.createElement('img');
            img.src = frameDataUrl;
            // Preserve styling from the video element
            const videoStyle = window.getComputedStyle(videoClone);
            img.style.width = videoStyle.width;
            img.style.height = videoStyle.height;
            img.style.objectFit = videoClone.style.objectFit || 'cover';
            img.style.display = videoStyle.display;

            // Track the captured frame
            captured.push({
                videoClone,
                frameDataUrl
            });

            // Replace the video with the image in the clone
            videoClone.parentNode?.replaceChild(img, videoClone);
        }

        return captured;
    }

    /**
     * Capture the current frame of a <video> element as a data URL.
     */
    private captureVideoFrame(video: HTMLVideoElement): string | null {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || video.clientWidth;
            canvas.height = video.videoHeight || video.clientHeight;

            if (!canvas.width || !canvas.height) {
                return null;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return null;
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/png');
        } catch {
            return null;
        }
    }
}
