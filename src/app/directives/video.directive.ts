import {Directive, ElementRef, inject} from '@angular/core';

@Directive({
  selector: '[appVideo]',
  standalone: true
})
export class VideoDirective {

  private readonly elRef = inject(ElementRef<HTMLVideoElement>);
  public element: HTMLVideoElement;

  constructor() {
    this.element = this.elRef.nativeElement;
  }

}
