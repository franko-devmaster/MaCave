import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/** Remet un fichier à l'utilisateur : feuille de partage iOS si disponible, téléchargement sinon. */
@Injectable({ providedIn: 'root' })
export class FileShareService {
  private readonly document = inject(DOCUMENT);

  async deliver(file: File): Promise<ShareOutcome> {
    const nav = this.document.defaultView?.navigator;
    if (nav?.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: file.name });
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return 'cancelled';
        }
        throw error;
      }
    }
    this.download(file);
    return 'downloaded';
  }

  private download(file: File): void {
    const url = URL.createObjectURL(file);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = file.name;
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
