import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { PhotoRepository } from '../db/photo.repository';
import { PDF_MEDIA_TYPE, Photo, PhotoInput } from '../models/wine';
import { arrayBufferToBase64 } from '../utils/base64';

export const PHOTO_MAX_SIDE = 1280;
/** Les fiches info contiennent du texte : plus de définition que la photo de bouteille. */
export const INFO_MAX_SIDE = 2048;
export const PDF_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_QUALITY = 0.85;

export interface PreparedPhoto extends PhotoInput {
  base64: string;
}

export class PhotoError extends Error {}

/** Dimensions réduites pour que le plus grand côté tienne dans maxSide, proportions conservées. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Prépare les photos d'étiquette : JPEG réduit à 1280 px, jamais l'original. */
@Injectable({ providedIn: 'root' })
export class PhotoService {
  private readonly document = inject(DOCUMENT);
  private readonly repository = inject(PhotoRepository);

  /** Fiche info : PDF conservé tel quel (10 Mo au plus), image réduite à 2048 px. */
  async prepareInfo(file: File): Promise<PhotoInput> {
    if (isPdf(file)) {
      if (file.size > PDF_MAX_BYTES) {
        throw new PhotoError('PDF trop volumineux');
      }
      return { bytes: await file.arrayBuffer(), mediaType: PDF_MEDIA_TYPE, width: 0, height: 0 };
    }
    const { bytes, mediaType, width, height } = await this.prepare(file, INFO_MAX_SIDE);
    return { bytes, mediaType, width, height };
  }

  async prepare(file: File, maxSide: number = PHOTO_MAX_SIDE): Promise<PreparedPhoto> {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new PhotoError('image illisible');
    }
    try {
      const size = fitWithin(bitmap.width, bitmap.height, maxSide);
      const canvas = this.document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new PhotoError('dessin impossible');
      }
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY));
      if (!blob) {
        throw new PhotoError('compression impossible');
      }
      const bytes = await blob.arrayBuffer();
      return { bytes, mediaType: 'image/jpeg', width: size.width, height: size.height, base64: arrayBufferToBase64(bytes) };
    } finally {
      bitmap.close();
    }
  }

  load(id: string): Promise<Photo | undefined> {
    return this.repository.get(id);
  }
}

export function isPdf(file: File): boolean {
  return file.type === PDF_MEDIA_TYPE || file.name.toLowerCase().endsWith('.pdf');
}
