import {DecimalPipe} from '@angular/common';
import {Component, inject} from '@angular/core';
import {RouterLink, RouterLinkActive} from "@angular/router";
import {CanvasService} from '../../services/canvas.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    DecimalPipe,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  public canvasService = inject(CanvasService);

  changeSnapSize(event: Event) {
    const target = event.target as HTMLSelectElement | null;
    const snapSize = Number(target?.value ?? '1');
    this.canvasService.setSnapSize(snapSize || 1);
  }
}
