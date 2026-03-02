import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-datetime-field',
  templateUrl: './datetime-field.component.html',
  styleUrls: ['./datetime-field.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class DateTimeFieldComponent {
  @Input() set value(rawValue: string) {
    this._rawValue = rawValue;
    this._displayValue = this.formatDateTimeLocal(rawValue);
  }

  @Output() valueChange = new EventEmitter<string>();

  _rawValue: string = '';
  _displayValue: string = '';

  onBlur() {
    // Convert the local datetime back to timezone-aware format
    const tzAwareValue = this.toTimezoneAwareLocal(this._displayValue);
    this.valueChange.emit(tzAwareValue);
  }

  /**
   * Convert backend ISO string (UTC) to local datetime format for display.
   * Input: "2026-03-02 13:16:53.208799+00:00"
   * Output: "2026-03-02T13:16" (local time, no timezone info)
   */
  private formatDateTimeLocal(value: string): string {
    try {
      // Parse backend ISO string: replace space with 'T' for JS Date parsing
      const iso = value.replace(' ', 'T');
      const date = new Date(iso);

      if (isNaN(date.getTime())) {
        console.warn('Failed to parse datetime:', value);
        return value;
      }

      // Convert to local timezone by getting local components
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');

      return `${year}-${month}-${day}T${hour}:${minute}`;
    } catch (e) {
      console.warn('formatDateTimeLocal failed', e, value);
      return value;
    }
  }

  /**
   * Convert local datetime string back to timezone-aware ISO format for backend.
   * Input: "2026-03-02T13:16" (from datetime-local input)
   * Output: "2026-03-02T13:16:00.000Z" or with offset (timezone-aware)
   */
  private toTimezoneAwareLocal(localString: string): string {
    try {
      // localString is in format YYYY-MM-DDTHH:mm (no timezone info)
      // Create a date in local timezone and convert to ISO with offset
      const [dateStr, timeStr] = localString.split('T');
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);

      // Create date in local timezone
      const date = new Date(year, month - 1, day, hour, minute, 0, 0);

      // Return ISO string with timezone info
      return date.toISOString();
    } catch (e) {
      console.warn('toTimezoneAwareLocal failed', e, localString);
      return localString;
    }
  }
}
