import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DateTimeFieldComponent } from './datetime-field.component';
import { RelationFieldComponent } from './relation-field.component';
import { DictFieldComponent } from './dict-field.component';

@Component({
  selector: 'app-dynamic-field',
  templateUrl: './dynamic-field.component.html',
  styleUrls: ['./dynamic-field.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, DateTimeFieldComponent, RelationFieldComponent, DictFieldComponent]
})
export class DynamicFieldComponent {
  @Input() key!: string;
  @Input() schema: any = {};
  @Input() value: any;
  @Output() valueChange = new EventEmitter<any>();

  // Emit when input blurred or value changed
  onBlur() {
    this.valueChange.emit(this.value);
  }

  // Handle datetime field changes (timezone-aware value emitted from DateTimeFieldComponent)
  onDateTimeChange(newValue: string | null) {
    this.value = newValue;
    this.valueChange.emit(this.value);
  }

  // Handle relation field changes
  onRelationChange(newValue: any) {
    this.value = newValue;
    this.valueChange.emit(this.value);
  }

  // Handle dict field changes
  onDictChange(newValue: Record<string, any> | null) {
    this.value = newValue;
    this.valueChange.emit(this.value);
  }
}
