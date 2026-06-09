import {
    Directive,
    ElementRef,
    HostBinding,
    HostListener,
    inject,
    input,
    OnInit,
    Renderer2
} from '@angular/core';
import {CanvasService} from '../services/canvas.service';
import {MathService} from '../services/math.service';
import {TimelineService} from '../services/timeline.service';

@Directive({
    selector: '[appCanvas]',
    standalone: true,
})
export class CanvasDirective implements OnInit {
    canvasService = inject(CanvasService);
    mathService = inject(MathService);
    private readonly timelineService = inject(TimelineService);
    private readonly canvasElementRef = inject(ElementRef<HTMLElement>);
    private readonly renderer = inject(Renderer2);

    private isPointerInsideCanvasArea = false;
    private lastAppliedCursor = '';
    private readonly previousCursorByTarget = new WeakMap<HTMLElement, string | null>();

    @HostBinding('class')
    elementClass = 'app-canvas';

    canvasWrapper = input<HTMLElement | null>(null);
    allowSnapToObjects = input(true);
    allowSnapToBorder = input(true);

    ngOnInit(): void {
        const w = 1280;
        const h = 720;
        const snapSize = this.mathService.divisorsInCommon(w, h).at(3) ?? 1;

        this.canvasService.init({
            canvas: this.canvasElementRef.nativeElement,
            canvasWrapper: this.canvasWrapper() ?? undefined,
            allowSnapToGrid: true,
            allowSnapToObjects: this.allowSnapToObjects(),
            allowSnapToBorder: this.allowSnapToBorder(),
            snapSize,
            width: w,
            height: h,
            zoom: 1,
            allowWidgetResize: true,
            allowExitBorders: false,
        });

        this.renderer.setStyle(this.canvasElementRef.nativeElement, 'transformOrigin', 'top left');
    }

    @HostBinding('style')
    get style() {
        return {
            top: `${this.canvasService.top()}px`,
            left: `${this.canvasService.left()}px`,
            transform: `scale(${this.canvasService.zoom()})`,
            position: 'relative',
        };
    }

    @HostListener('window:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        if (this.isTypingFieldTarget(event.target)) {
            return;
        }

        if (this.handleUndoRedoShortcut(event)) {
            return;
        }

        if (this.handleCopyShortcut(event)) {
            return;
        }

        if (this.handlePasteShortcut(event)) {
            return;
        }

        if (this.handleDeleteShortcut(event)) {
            return;
        }

        if (this.handleEscapeShortcut(event)) {
            return;
        }

        if (this.handleArrowMoveShortcut(event)) {
            return;
        }

        if (event.code === 'Space') {
            this.handleSpaceKeyDown(event);
        }
    }

    @HostListener('window:keyup', ['$event'])
    onKeyUp(event: KeyboardEvent) {
        if (event.code !== 'Space') {
            return;
        }

        this.syncPointerInsideAreaFromHover();
        this.canvasService.setSpacePressed(false);
        this.updateCanvasAreaCursor();
    }

    @HostListener('window:pointerdown', ['$event'])
    onPointerDown(event: PointerEvent) {
        this.syncPointerInsideArea(event.target);

        if (event.button === 0 && !this.canvasService.isSpacePressed() && this.isSelectionClearTarget(event.target)) {
            this.canvasService.selectWidget(null);
        }

        if (!this.isPanTarget(event.target)) {
            return;
        }

        this.canvasService.canvasDragStart({
            el: this.canvasElementRef.nativeElement,
            event
        });

        this.updateCanvasAreaCursor();
    }

    @HostListener('window:pointermove', ['$event'])
    onPointerMove(event: PointerEvent) {
        this.syncPointerInsideArea(event.target);

        if (!this.canvasWrapper()) {
            return;
        }

        this.canvasService.handleGlobalPointerMove(event);

        this.canvasService.canvasDrag({
            el: this.canvasElementRef.nativeElement,
            event
        });

        this.updateCanvasAreaCursor();
    }

    @HostListener('window:pointerup', ['$event'])
    onPointerUp(event: PointerEvent) {
        this.syncPointerInsideArea(event.target);

        if (!this.canvasWrapper()) {
            return;
        }

        this.canvasService.handleGlobalPointerUp(event);

        this.canvasService.canvasDragEnd({
            el: this.canvasElementRef.nativeElement,
            event
        });

        this.updateCanvasAreaCursor();
    }

    @HostListener('window:pointercancel', ['$event'])
    onPointerCancel(event: PointerEvent) {
        this.syncPointerInsideArea(event.target);

        if (!this.canvasWrapper()) {
            return;
        }

        this.canvasService.handleGlobalPointerUp(event);

        this.canvasService.canvasDragEnd({
            el: this.canvasElementRef.nativeElement,
            event
        });

        this.updateCanvasAreaCursor();
    }

    @HostListener('window:wheel', ['$event'])
    onMouseWheel(event: WheelEvent) {
        if (!this.canvasWrapper()) {
            return;
        }

        if (event.target === this.canvasWrapper() || this.canvasWrapper()?.contains(event.target as HTMLElement)) {
            event.preventDefault();
            event.stopPropagation();

            const value = Math.round(Math.abs(event.deltaY) * 100) / 10_000;
            const focalPoint = {x: event.clientX, y: event.clientY};

            if (event.deltaY > 0) {
                this.canvasService.canvasZoomOut(value, focalPoint);
            }
            if (event.deltaY < 0) {
                this.canvasService.canvasZoomIn(value, focalPoint);
            }
        }
    }

    private syncPointerInsideArea(target: EventTarget | null) {
        this.isPointerInsideCanvasArea = this.isTargetInsideWrapper(target);
    }

    private syncPointerInsideAreaFromHover() {
        const wrapper = this.canvasWrapper();
        this.isPointerInsideCanvasArea = !!wrapper && wrapper.matches(':hover');
    }

    private isPanTarget(target: EventTarget | null): boolean {
        const wrapper = this.canvasWrapper();
        const canvas = this.canvasElementRef.nativeElement;
        const targetEl = target as HTMLElement | null;

        if (!wrapper || !targetEl) {
            return false;
        }

        if (!wrapper.contains(targetEl)) {
            return false;
        }

        if (this.canvasService.isSpacePressed()) {
            return true;
        }

        // Evita il pan quando si inizia un drag da widget/resizer.
        return targetEl === wrapper || targetEl === canvas || !targetEl.closest('.app-canvas-widget');
    }

    private isSelectionClearTarget(target: EventTarget | null): boolean {
        const wrapper = this.canvasWrapper();
        const canvas = this.canvasElementRef.nativeElement;
        const targetEl = target as HTMLElement | null;

        if (!wrapper || !targetEl || !wrapper.contains(targetEl)) {
            return false;
        }

        return !targetEl.closest('.app-canvas-widget') && (targetEl === wrapper || targetEl === canvas || canvas.contains(targetEl));
    }

    private isTargetInsideWrapper(target: EventTarget | null): boolean {
        const wrapper = this.canvasWrapper();
        const targetNode = target as Node | null;

        return !!wrapper && !!targetNode && wrapper.contains(targetNode);
    }

    private isTypingFieldTarget(target: EventTarget | null): boolean {
        const targetEl = target as HTMLElement | null;
        if (!targetEl) {
            return false;
        }

        if (targetEl instanceof HTMLTextAreaElement) {
            return true;
        }

        if (targetEl instanceof HTMLInputElement) {
            return this.isTextEntryInput(targetEl);
        }

        return targetEl.isContentEditable
            || !!targetEl.closest('[contenteditable]:not([contenteditable="false"])');
    }

    private isTextEntryInput(input: HTMLInputElement): boolean {
        const type = (input.type || 'text').toLowerCase();
        return type === 'text'
            || type === 'search'
            || type === 'url'
            || type === 'tel'
            || type === 'email'
            || type === 'password'
            || type === 'number';
    }

    private handleUndoRedoShortcut(event: KeyboardEvent): boolean {
        if (!this.isUndoRedoShortcut(event)) {
            return false;
        }

        event.preventDefault();
        if (event.shiftKey) {
            this.canvasService.redo();
            return true;
        }

        this.canvasService.undo();
        return true;
    }

    private handleCopyShortcut(event: KeyboardEvent): boolean {
        if (!this.isCopyShortcut(event)) {
            return false;
        }

        const handled = this.canvasService.copySelectedWidgetToClipboard();
        if (handled) {
            event.preventDefault();
        }

        return true;
    }

    private handlePasteShortcut(event: KeyboardEvent): boolean {
        if (!this.isPasteShortcut(event)) {
            return false;
        }

        const handled = this.canvasService.pasteClipboardWidget();
        if (handled) {
            event.preventDefault();
        }

        return true;
    }

    private handleDeleteShortcut(event: KeyboardEvent): boolean {
        if (event.code !== 'Delete' && event.code !== 'Backspace') {
            return false;
        }

        event.preventDefault();
        this.canvasService.deleteSelectedWidget();
        return true;
    }

    private handleEscapeShortcut(event: KeyboardEvent): boolean {
        if (event.code !== 'Escape' || !this.canvasService.selectedWidgetId()) {
            return false;
        }

        event.preventDefault();
        this.canvasService.selectWidget(null);
        return true;
    }

    private handleArrowMoveShortcut(event: KeyboardEvent): boolean {
        if (!this.isArrowMoveKey(event.code)) {
            return false;
        }

        const handled = this.canvasService.moveSelectedWidgetByArrowKey({
            key: event.code,
            shiftKey: event.shiftKey,
        });

        if (handled) {
            event.preventDefault();
        }

        return true;
    }

    private isUndoRedoShortcut(event: KeyboardEvent): boolean {
        return this.isPrimaryShortcutModifierPressed(event)
            && !event.altKey
            && event.code === 'KeyZ';
    }

    private isCopyShortcut(event: KeyboardEvent): boolean {
        return this.isPrimaryShortcutModifierPressed(event)
            && !event.altKey
            && !event.shiftKey
            && event.code === 'KeyC';
    }

    private isPasteShortcut(event: KeyboardEvent): boolean {
        return this.isPrimaryShortcutModifierPressed(event)
            && !event.altKey
            && !event.shiftKey
            && event.code === 'KeyV';
    }

    private isArrowMoveKey(code: string): code is 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' {
        return code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight';
    }

    private isPrimaryShortcutModifierPressed(event: KeyboardEvent): boolean {
        return this.isApplePlatform() ? event.metaKey : event.ctrlKey;
    }

    private isApplePlatform(): boolean {
        if (typeof navigator === 'undefined') {
            return false;
        }

        const platform = navigator.platform ?? '';
        const userAgent = navigator.userAgent ?? '';
        return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac|iPhone|iPad|iPod/i.test(userAgent);
    }

    private handleSpaceKeyDown(event: KeyboardEvent): void {
        if (!event.repeat) {
            this.timelineService.togglePlayback();
        }

        this.syncPointerInsideAreaFromHover();
        event.preventDefault();

        this.canvasService.setSpacePressed(true);
        this.updateCanvasAreaCursor();
    }


    private updateCanvasAreaCursor() {
        const wrapper = this.canvasWrapper();
        if (!wrapper) {
            return;
        }

        const cursor = this.resolveCursor();
        if (cursor === this.lastAppliedCursor) {
            return;
        }

        this.applyCursorToCanvasArea(cursor || null);
        this.lastAppliedCursor = cursor;
    }

    private resolveCursor(): string {
        if (this.canvasService.isDraggingCanvas()) {
            return this.supportsCursor('grabbing') ? 'grabbing' : 'move';
        }

        if (this.isPointerInsideCanvasArea && this.canvasService.isSpacePressed()) {
            return this.supportsCursor('grab') ? 'grab' : 'move';
        }

        return '';
    }

    private applyCursorToCanvasArea(cursor: string | null) {
        const wrapper = this.canvasWrapper();
        if (!wrapper) {
            return;
        }

        const canvas = this.canvasElementRef.nativeElement;
        const targets = [
            wrapper,
            canvas,
            ...Array.from(wrapper.querySelectorAll<HTMLElement>('.app-canvas-widget, .app-canvas-widget *')),
        ];

        for (const target of targets) {
            if (cursor) {
                if (!this.previousCursorByTarget.has(target)) {
                    this.previousCursorByTarget.set(target, target.style.cursor || null);
                }
                this.renderer.setStyle(target, 'cursor', cursor);
            } else {
                if (!this.previousCursorByTarget.has(target)) {
                    continue;
                }

                const previousCursor = this.previousCursorByTarget.get(target);
                if (previousCursor) {
                    this.renderer.setStyle(target, 'cursor', previousCursor);
                } else {
                    this.renderer.removeStyle(target, 'cursor');
                }

                this.previousCursorByTarget.delete(target);
            }
        }
    }

    private supportsCursor(value: 'grab' | 'grabbing'): boolean {
        return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('cursor', value);
    }
}
