import {Component, input} from '@angular/core';

@Component({
    selector: 'app-recording-session',
  standalone: true,
  imports: [],
    templateUrl: './recording-session.component.html',
    styleUrl: './recording-session.component.scss'
})
export class RecordingSessionComponent {
  sessionId = input<string>();
}
