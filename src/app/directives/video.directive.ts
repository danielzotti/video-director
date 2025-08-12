import {Directive, ElementRef, input} from '@angular/core';

@Directive({
  selector: '[app-video]',
  standalone: true
})
export class VideoDirective {

  public element: HTMLVideoElement;

  constructor(elRef: ElementRef) {
    this.element = elRef.nativeElement;
  }

}
