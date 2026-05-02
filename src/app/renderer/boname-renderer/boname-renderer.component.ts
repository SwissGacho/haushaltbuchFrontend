import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-boname-renderer',
  imports: [],
  templateUrl: './boname-renderer.component.html',
  styleUrl: './boname-renderer.component.scss'
})
export class BoNameRendererComponent {
  @Input({ required: true })
  value: string | null = null;

  @Input()
  emptyText = '—';

  get displayText(): string {
    return this.value?.trim() || this.emptyText;
  }

  get hasValue(): boolean {
    return !!this.value?.trim();
  }
}