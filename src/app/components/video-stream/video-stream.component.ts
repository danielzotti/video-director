import {AfterViewInit, Component, effect, input, signal, ViewChild} from '@angular/core';
import {VideoDirective} from "../../directives/video.directive";
import {StreamStateItem} from "../../models/stream.model";

@Component({
  selector: 'app-video-stream',
  standalone: true,
  imports: [VideoDirective],
  templateUrl: './video-stream.component.html',
  styleUrl: './video-stream.component.scss'
})
export class VideoStreamComponent implements AfterViewInit {

  item = input.required<StreamStateItem>();

  videoInfo = signal<string>("");

  @ViewChild(VideoDirective)
  public videoRef!: VideoDirective;

  constructor() {
    effect(() => {
      console.log("VIDEO INFO:", this.videoInfo());
    })
  }

  ngAfterViewInit(): void {
    this.videoInfo.set(`${this.videoRef.element.clientWidth}x${this.videoRef.element.clientHeight}`)
  }
}
