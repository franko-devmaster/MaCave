import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './empty-state.scss',
  template: `
    <section class="empty">
      <p class="empty__title">{{ title() }}</p>
      <p class="empty__text">{{ text() }}</p>
    </section>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly text = input.required<string>();
}
