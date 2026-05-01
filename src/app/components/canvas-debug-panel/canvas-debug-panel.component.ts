import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, effect, HostListener, inject, input, signal, untracked, ViewChild } from '@angular/core';
import { DOCUMENT, DecimalPipe } from '@angular/common';
import { CanvasService } from '../../services/canvas.service';

interface DebugPanelPosition {
  x: number;
  y: number;
}

@Component({
  selector: 'app-canvas-debug-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './canvas-debug-panel.component.html',
  styleUrl: './canvas-debug-panel.component.scss',
})
export class CanvasDebugPanelComponent implements AfterViewInit {
  private readonly STORAGE_KEY = 'canvas-debug-panel-pos';
  private readonly DEFAULT_POSITION: DebugPanelPosition = { x: 12, y: 60 };
  private readonly FALLBACK_PANEL_SIZE = { width: 260, height: 170 };

  show = input<boolean>(false);
  protected cs = inject(CanvasService);
  @ViewChild('panel')
  protected panelEl?: ElementRef<HTMLElement>;
  @ViewChild('panelHeader')
  protected panelHeaderEl?: ElementRef<HTMLElement>;

  private readonly doc = inject(DOCUMENT);

  protected position = signal<DebugPanelPosition>(this.DEFAULT_POSITION);
  protected isDragging = signal(false);
  protected dragOffset = signal<DebugPanelPosition>({ x: 0, y: 0 });
  private activePointerId: number | null = null;

  constructor() {
    effect(() => {
      if (this.show()) {
        // Evita di tracciare `position()` letto internamente da setPosition.
        untracked(() => this.setPosition(this.loadSavedPosition() ?? this.DEFAULT_POSITION));
      }
    });

    effect(() => {
      if (this.show()) {
        this.savePosition(this.position());
      }
    });

  }

  ngAfterViewInit(): void {
    if (this.show()) {
      this.setPosition(this.position());
    }
  }

  protected onDragStart(e: PointerEvent): void {
    if (!e.isPrimary || e.button !== 0) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    this.setPosition(this.position());
    this.isDragging.set(true);
    this.activePointerId = e.pointerId;

    const header = this.panelHeaderEl?.nativeElement;
    if (header?.setPointerCapture) {
      // Alcuni browser possono lanciare in casi limite: fallback ai listener globali.
      try {
        header.setPointerCapture(e.pointerId);
      } catch {
        // no-op
      }
    }

    const pos = this.position();
    this.dragOffset.set({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  }

  @HostListener('window:pointermove', ['$event'])
  protected onDrag(e: PointerEvent): void {
    if (!this.isDragging() || this.activePointerId !== e.pointerId) {
      return;
    }

    const offset = this.dragOffset();
    this.setPosition({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    });
  }

  @HostListener('window:pointerup', ['$event'])
  @HostListener('window:pointercancel', ['$event'])
  protected onDragEnd(event?: PointerEvent): void {
    if (event && this.activePointerId !== event.pointerId) {
      return;
    }

    const pointerId = this.activePointerId;
    const header = this.panelHeaderEl?.nativeElement;
    if (pointerId !== null && header?.releasePointerCapture) {
      try {
        header.releasePointerCapture(pointerId);
      } catch {
        // no-op
      }
    }

    this.activePointerId = null;
    this.isDragging.set(false);
  }

  @HostListener('window:blur')
  protected onWindowBlur(): void {
    this.onDragEnd();
  }

  @HostListener('lostpointercapture')
  protected onLostPointerCapture(): void {
    this.onDragEnd();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.setPosition(this.position());
  }

  private setPosition(next: DebugPanelPosition): void {
    const clamped = this.clampPosition(next);
    const current = this.position();
    if (current.x === clamped.x && current.y === clamped.y) {
      return;
    }

    this.position.set(clamped);
  }

  private clampPosition(next: DebugPanelPosition): DebugPanelPosition {
    const viewport = this.getViewportSize();
    const panel = this.getPanelSize();

    const maxX = Math.max(0, viewport.width - panel.width);
    const maxY = Math.max(0, viewport.height - panel.height);

    return {
      x: Math.min(Math.max(Math.round(next.x), 0), maxX),
      y: Math.min(Math.max(Math.round(next.y), 0), maxY),
    };
  }

  private getViewportSize(): { width: number; height: number } {
    const win = this.doc.defaultView;
    return {
      width: win?.innerWidth ?? 0,
      height: win?.innerHeight ?? 0,
    };
  }

  private getPanelSize(): { width: number; height: number } {
    const panel = this.panelEl?.nativeElement;
    if (!panel) {
      return this.FALLBACK_PANEL_SIZE;
    }

    return {
      width: panel.offsetWidth,
      height: panel.offsetHeight,
    };
  }

  private loadSavedPosition(): DebugPanelPosition | null {
    const storage = this.doc.defaultView?.localStorage;
    if (!storage) {
      return null;
    }

    const raw = storage.getItem(this.STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<DebugPanelPosition>;
      if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
        return null;
      }

      return { x: parsed.x, y: parsed.y };
    } catch {
      return null;
    }
  }

  private savePosition(position: DebugPanelPosition): void {
    const storage = this.doc.defaultView?.localStorage;
    if (!storage) {
      return;
    }

    storage.setItem(this.STORAGE_KEY, JSON.stringify(position));
  }
}
