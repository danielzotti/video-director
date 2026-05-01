import {ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, signal, viewChild} from '@angular/core';
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
import {CanvasToolbarComponent} from '../../layout/canvas-toolbar/canvas-toolbar.component';
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
    CanvasToolbarComponent,
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

  protected readonly floatingPanelPosition = signal<Point2D>({ x: 0, y: 0 });

  private floatingPanelDragOffset: Point2D | null = null;
  private isFloatingPanelDragging = false;
  private hasFloatingPanelPosition = false;
  private readonly floatingPanelMargin = 12;

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

  @HostListener('window:pointermove', ['$event'])
  protected onWindowPointerMove(event: PointerEvent): void {
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

  @HostListener('window:pointerup')
  protected onWindowPointerUp(): void {
    this.isFloatingPanelDragging = false;
    this.floatingPanelDragOffset = null;
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
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
