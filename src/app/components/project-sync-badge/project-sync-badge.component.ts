import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CanvasService } from '../../services/canvas.service';

type ProjectSyncBadgeVariant = 'idle' | 'pending' | 'syncing' | 'error';

@Component({
  selector: 'app-project-sync-badge',
  standalone: true,
  templateUrl: './project-sync-badge.component.html',
  styleUrl: './project-sync-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectSyncBadgeComponent {
  private readonly canvasService = inject(CanvasService);

  readonly hideWhenDisconnected = input(false);
  readonly compact = input(false);

  protected readonly isVisible = computed(() => {
    if (!this.hideWhenDisconnected()) {
      return true;
    }

    return this.canvasService.projectDirectoryName() !== null;
  });

  protected readonly variant = computed<ProjectSyncBadgeVariant>(() => {
    const status = this.canvasService.projectSyncStatus();

    if (status === 'syncing' || status === 'error') {
      return status;
    }

    return this.canvasService.projectHasPendingChanges() ? 'pending' : 'idle';
  });

  protected readonly statusLabel = computed(() => {
    const status = this.canvasService.projectSyncStatus();

    if (status === 'syncing') {
      return 'Syncing...';
    }

    if (status === 'error') {
      return 'Sync error';
    }

    const lastSync = this.canvasService.projectLastSyncedAt();
    return lastSync ? `Last sync: ${lastSync.toLocaleTimeString()}` : 'Idle';
  });

  protected readonly badgeTitle = computed(() => {
    const directoryName = this.canvasService.projectDirectoryName();
    const syncError = this.canvasService.projectSyncError();

    if (syncError) {
      return syncError;
    }

    if (directoryName) {
      return `Project folder: ${directoryName}`;
    }

    return 'Project folder sync status';
  });
}
