import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Délai avant de libérer l'URL du fichier téléchargé. Sur Android, le gestionnaire de
 * téléchargements lit le fichier après le clic : une URL libérée trop tôt fait échouer
 * le téléchargement d'un export de plusieurs Mo.
 */
export const DOWNLOAD_URL_LIFETIME_MS = 60_000;

/**
 * Remet un fichier à l'utilisateur : feuille de partage si le navigateur l'accepte pour ce
 * fichier (iOS), téléchargement sinon (Android refuse de partager un .json) ou si le partage
 * échoue (geste de l'utilisateur expiré pendant la préparation du fichier, par exemple).
 */
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
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
  }
}
