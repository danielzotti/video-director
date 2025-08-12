import {Routes} from '@angular/router';
import {NotFoundComponent} from './pages/not-found/not-found.component';
import {RecordingSessionNewComponent} from './pages/recording-session-new/recording-session-new.component';
import {RecordingSessionComponent} from './pages/recording-session/recording-session.component';
import {RecordingSessionsComponent} from './pages/recording-sessions/recording-sessions.component';

export const routes: Routes = [
  {
    path: '',
    // component: HomeComponent
    redirectTo: 'recording-sessions/new',
    pathMatch: 'full'
  },
  {
    path: 'recording-sessions',
    component: RecordingSessionsComponent
  },
  {
    path: 'recording-sessions/new',
    component: RecordingSessionNewComponent
  },
  {
    path: 'recording-sessions/:sessionId',
    component: RecordingSessionComponent
  },
  {
    path: '**',
    component: NotFoundComponent
  },
];
