import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dict-field',
  templateUrl: './dict-field.component.html',
  styleUrls: ['./dict-field.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class DictFieldComponent {
  @Output() valueChange = new EventEmitter<Record<string, any> | null>();

  jsonValue = '';
  parseError: string | null = null;

  private _value: Record<string, any> | null = null;

  @Input() set value(rawValue: any) {
    this._value = this.normalizeToObject(rawValue);
    this.jsonValue = this.toJsonString(this._value);
    this.parseError = null;
  }

  onBlur() {
    const trimmed = this.jsonValue.trim();

    if (!trimmed) {
      this._value = null;
      this.parseError = null;
      this.valueChange.emit(null);
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.parseError = 'Value must be a JSON object.';
        return;
      }

      this._value = parsed as Record<string, any>;
      this.jsonValue = this.toJsonString(this._value);
      this.parseError = null;
      this.valueChange.emit(this._value);
    } catch {
      this.parseError = 'Invalid JSON object.';
    }
  }

  private toJsonString(value: Record<string, any> | null): string {
    if (value === null) {
      return '';
    }
    return JSON.stringify(value, null, 2);
  }

  private normalizeToObject(value: any): Record<string, any> | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, any>;
        }
      } catch {
        return null;
      }
      return null;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, any>;
    }

    return null;
  }
}