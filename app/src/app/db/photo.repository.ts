import { inject, Injectable } from '@angular/core';
import { Photo } from '../models/wine';
import { MACAVE_DB } from './schema';

@Injectable({ providedIn: 'root' })
export class PhotoRepository {
  private readonly db = inject(MACAVE_DB);

  get(id: string): Promise<Photo | undefined> {
    return this.db.photos.get(id);
  }
}
