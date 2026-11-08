import { Pipe, PipeTransform } from '@angular/core';
import { formatChf } from '../utils/format';

@Pipe({ name: 'chf' })
export class ChfPipe implements PipeTransform {
  transform(value: number | null): string {
    return formatChf(value);
  }
}
