import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BUILD_INFO } from '../../../build-info';
import { PageHeaderComponent } from '../../components/page-header/page-header';
import { ProfileDatastore } from '../../datastore/profile.datastore';
import { ReferenceDatastore } from '../../datastore/reference.datastore';
import { SettingsDatastore } from '../../datastore/settings.datastore';
import { TastingDatastore } from '../../datastore/tasting.datastore';
import { WineDatastore } from '../../datastore/wine.datastore';
import { ClaudeFailure } from '../../ai/claude-errors';
import { AppUpdateService } from '../../services/app-update.service';
import { ClaudeService } from '../../services/claude.service';
import { BackupFile, BackupFormatError, BackupService, parseBackup, RestoreMode } from '../../services/backup.service';
import { FileShareService } from '../../services/file-share.service';
import { StoragePersistenceService } from '../../services/storage-persistence.service';

interface Feedback {
  kind: 'success' | 'error';
  text: string;
}

interface PendingImport {
  backup: BackupFile;
  fileName: string;
  wines: number;
}

@Component({
  selector: 'app-reglages-page',
  imports: [PageHeaderComponent, RouterLink, TranslatePipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './reglages-page.scss',
  templateUrl: './reglages-page.html',
})
export class ReglagesPage {
  private readonly backup = inject(BackupService);
  private readonly share = inject(FileShareService);
  private readonly translate = inject(TranslateService);
  private readonly wines = inject(WineDatastore);
  private readonly references = inject(ReferenceDatastore);
  private readonly tastings = inject(TastingDatastore);
  private readonly profile = inject(ProfileDatastore);
  protected readonly settings = inject(SettingsDatastore);
  protected readonly storage = inject(StoragePersistenceService);
  protected readonly update = inject(AppUpdateService);
  private readonly claude = inject(ClaudeService);

  protected readonly build = BUILD_INFO;
  protected readonly busy = signal(false);
  protected readonly pendingImport = signal<PendingImport | null>(null);
  protected readonly backupFeedback = signal<Feedback | null>(null);
  protected readonly updateFeedback = signal<string | null>(null);
  protected readonly keyInput = signal('');
  protected readonly keyBusy = signal(false);
  protected readonly keyFeedback = signal<Feedback | null>(null);

  protected onKeyInput(event: Event): void {
    this.keyInput.set((event.target as HTMLInputElement).value);
  }

  /** Enregistre la clé seulement si l'API l'accepte. */
  protected async saveKey(): Promise<void> {
    const key = this.keyInput().trim();
    if (!key.startsWith('sk-ant-')) {
      this.keyFeedback.set({ kind: 'error', text: this.translate.instant('reglages.claude.format') });
      return;
    }
    await this.withKeyBusy(async () => {
      const result = await this.claude.testKey(key);
      if (result.ok) {
        await this.settings.setApiKey(key);
        this.keyInput.set('');
        this.keyFeedback.set({ kind: 'success', text: this.translate.instant('reglages.claude.valid') });
      } else {
        this.keyFeedback.set({ kind: 'error', text: this.errorText(result) });
      }
    });
  }

  protected async testSavedKey(): Promise<void> {
    const key = this.settings.apiKey();
    if (!key) {
      return;
    }
    await this.withKeyBusy(async () => {
      const result = await this.claude.testKey(key);
      this.keyFeedback.set(
        result.ok ? { kind: 'success', text: this.translate.instant('reglages.claude.valid') } : { kind: 'error', text: this.errorText(result) },
      );
    });
  }

  protected async removeKey(): Promise<void> {
    if (!confirm(this.translate.instant('reglages.claude.removeConfirm'))) {
      return;
    }
    await this.settings.clearApiKey();
    this.keyFeedback.set({ kind: 'success', text: this.translate.instant('reglages.claude.removed') });
  }

  private async withKeyBusy(action: () => Promise<void>): Promise<void> {
    this.keyBusy.set(true);
    this.keyFeedback.set(null);
    try {
      await action();
    } finally {
      this.keyBusy.set(false);
    }
  }

  private errorText(error: ClaudeFailure): string {
    return this.translate.instant(`ai.errors.${error.kind}`, { detail: error.detail ?? '' });
  }

  protected async exportData(): Promise<void> {
    this.busy.set(true);
    this.backupFeedback.set(null);
    try {
      const now = new Date();
      const file = await this.backup.exportToFile(now);
      const outcome = await this.share.deliver(file);
      if (outcome !== 'cancelled') {
        await this.settings.markExported(now);
        this.backupFeedback.set({ kind: 'success', text: this.translate.instant('reglages.backup.exported', { file: file.name }) });
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async selectImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.backupFeedback.set(null);
    if (!file) {
      return;
    }
    try {
      const backup = parseBackup(await file.text());
      this.pendingImport.set({ backup, fileName: file.name, wines: backup.data.wines.length });
    } catch (error) {
      this.showImportError(error);
    }
  }

  protected cancelImport(): void {
    this.pendingImport.set(null);
  }

  protected async confirmImport(mode: RestoreMode): Promise<void> {
    const pending = this.pendingImport();
    if (!pending) {
      return;
    }
    this.busy.set(true);
    try {
      const count = await this.backup.restore(pending.backup, mode);
      await Promise.all([this.wines.load(), this.tastings.load(), this.profile.load(), this.references.load(), this.settings.load()]);
      this.pendingImport.set(null);
      this.backupFeedback.set({ kind: 'success', text: this.translate.instant('reglages.backup.imported', { count }) });
    } catch (error) {
      this.pendingImport.set(null);
      this.showImportError(error);
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

  private showImportError(error: unknown): void {
    const reason = error instanceof BackupFormatError ? error.message : String(error);
    this.backupFeedback.set({ kind: 'error', text: this.translate.instant('reglages.backup.error', { reason }) });
  }
}
