import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BUILD_INFO } from '../../../build-info';
import { PageHeaderComponent } from '../../components/page-header/page-header';
import { AppUpdateService } from '../../services/app-update.service';
import { BackupFormatError, BackupService } from '../../services/backup.service';
import { FileShareService } from '../../services/file-share.service';
import { StoragePersistenceService } from '../../services/storage-persistence.service';

interface Feedback {
  kind: 'success' | 'error';
  text: string;
}

@Component({
  selector: 'app-reglages-page',
  imports: [PageHeaderComponent, RouterLink, TranslatePipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './reglages-page.scss',
  templateUrl: './reglages-page.html',
})
export class ReglagesPage implements OnInit {
  private readonly backup = inject(BackupService);
  private readonly share = inject(FileShareService);
  private readonly translate = inject(TranslateService);
  protected readonly storage = inject(StoragePersistenceService);
  protected readonly update = inject(AppUpdateService);

  protected readonly build = BUILD_INFO;
  protected readonly lastExportAt = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly backupFeedback = signal<Feedback | null>(null);
  protected readonly updateFeedback = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.lastExportAt.set(await this.backup.lastExportAt());
  }

  protected async exportData(): Promise<void> {
    this.busy.set(true);
    this.backupFeedback.set(null);
    try {
      const file = await this.backup.exportToFile();
      const outcome = await this.share.deliver(file);
      this.lastExportAt.set(await this.backup.lastExportAt());
      if (outcome !== 'cancelled') {
        this.backupFeedback.set({
          kind: 'success',
          text: this.translate.instant('reglages.backup.exported', { file: file.name }),
        });
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !confirm(this.translate.instant('reglages.backup.importConfirm'))) {
      return;
    }
    this.busy.set(true);
    this.backupFeedback.set(null);
    try {
      const count = await this.backup.importFromText(await file.text());
      this.backupFeedback.set({
        kind: 'success',
        text: this.translate.instant('reglages.backup.imported', { count }),
      });
      this.lastExportAt.set(await this.backup.lastExportAt());
    } catch (error) {
      const reason = error instanceof BackupFormatError ? error.message : String(error);
      this.backupFeedback.set({
        kind: 'error',
        text: this.translate.instant('reglages.backup.error', { reason }),
      });
    } finally {
      this.busy.set(false);
    }
  }

  protected async checkForUpdate(): Promise<void> {
    const result = await this.update.check();
    const key = {
      available: 'app.update.message',
      'up-to-date': 'reglages.version.upToDate',
      unavailable: 'reglages.version.unavailable',
    }[result];
    this.updateFeedback.set(this.translate.instant(key));
  }
}
