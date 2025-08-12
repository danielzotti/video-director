import {DecimalPipe} from "@angular/common";
import {Component, computed, effect, ElementRef, HostListener, inject, ViewChild} from '@angular/core';
import {v4 as uuid} from 'uuid';
import {WidgetComponent} from "../../components/widget/widget.component";
import {CanvasWidgetDirective} from "../../directives/canvas-widget.directive";
import {CanvasDirective} from "../../directives/canvas.directive";
import {StreamStateItem} from "../../models/stream.model";
import {CanvasWidgetStateService} from "../../services/canvas-widget-state.service";
import {CanvasService} from "../../services/canvas.service";
import {StreamStateService} from "../../services/stream-state.service";

@Component({
  selector: 'app-recording-session-new',
  standalone: true,
  imports: [
    WidgetComponent,
    CanvasDirective,
    CanvasWidgetDirective,
    DecimalPipe,
  ],
  templateUrl: './recording-session-new.component.html',
  styleUrl: './recording-session-new.component.scss'
})
export class RecordingSessionNewComponent {
  mousePosition = {x: 0, y: 0};

  streamStateService = inject(StreamStateService);
  widgetStateService = inject(CanvasWidgetStateService);
  public canvasService = inject(CanvasService);

  streamList = computed(() => this.streamStateService.list()); //.filter((item) => !!item.mediaStream?.active));
  widgetList = computed(() => this.widgetStateService.list()); //.filter((item) => !!item.mediaStream?.active));

  lastUpdate = computed(() => this.streamStateService.lastUpdate());

  @ViewChild('canvas')
  private readonly canvas!: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      // This is needed to detect when the video track is stopped by the user through the browser stop button
      this.lastUpdate();
      // console.log(this.streamStateService.list()[0]?.mediaStream?.getVideoTracks()?.[0]?.getSettings());
    });
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    this.mousePosition = {x: event.clientX, y: event.clientY};
  }

  async newWebcamStream() {
    alert("TODO: newWebcamStream")
  }

  async newCaptureStream() {
    const mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "window",
      },
      audio: false,
    });
    const stream: StreamStateItem = {
      uuid: uuid(),
      type: "screen",
      mediaStream
    }
    this.streamStateService.addStream(stream)
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

    // const aspectRatio = video.clientWidth / video.clientHeight;
    // const imageWidth = aspectRatio > 1 ? item.settings?.width ?? 1000 : item.settings?.height ?? 1000;
    // const imageWidth = 1000;
    // canvas.width = imageWidth;
    // canvas.height = imageWidth / aspectRatio;
    canvas.width = (item.mediaStream?.getVideoTracks()?.[0]?.getSettings().width ?? 100);
    canvas.height = (item.mediaStream?.getVideoTracks()?.[0]?.getSettings().height ?? 100);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataURI = canvas.toDataURL('image/png'); // can also use 'image/jpg'

    const a = document.createElement("a");
    a.href = dataURI;
    a.download = `Image${item.mediaStream?.id ? item.mediaStream?.id : ''}.png`;
    a.click();

  }

  changeSnapSize(event: Event) {
    const snapSize = (event.target as unknown as { value: string })?.value;
    this.canvasService.setSnapSize(+snapSize || 1)
  }
}
