import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WineColor } from '../../models/wine';

/** Pastille de couleur du vin. Décorative : le libellé est toujours affiché à côté. */
@Component({
  selector: 'app-color-dot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.background]': '"var(--wine-" + color() + ")"', '[style.--dot-size.px]': 'size()' },
  styles: `
    :host {
      display: inline-block;
      flex-shrink: 0;
      width: var(--dot-size);
      height: var(--dot-size);
      border-radius: 50%;
    }
  `,
  template: '',
})
export class ColorDotComponent {
  readonly color = input.required<WineColor>();
  readonly size = input(9);
}
