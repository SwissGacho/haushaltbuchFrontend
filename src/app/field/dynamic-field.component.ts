import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DateTimeFieldComponent } from './datetime-field.component';
import { RelationFieldComponent } from './relation-field.component';
import { DictFieldComponent } from './dict-field.component';
import { AttributeSchema } from '../business-object/bo-schema/bo.schema.types';

@Component({
    selector: 'app-dynamic-field',
    templateUrl: './dynamic-field.component.html',
    styleUrls: ['./dynamic-field.component.css'],
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        DateTimeFieldComponent,
        RelationFieldComponent,
        DictFieldComponent,
    ],
})
export class DynamicFieldComponent {
    @Input() key!: string;
    @Input() schema!: AttributeSchema;
    @Input() value: any;
    @Output() valueChange = new EventEmitter<any>();

    get isReadOnly(): boolean {
        return this.schema?.accessLevel === 'read_only';
    }

    emitIfWriteable(): void {
        if (!this.isReadOnly) {
            this.valueChange.emit(this.value);
        }
    }

    // Emit when input blurred or value changed
    onBlur() {
        this.emitIfWriteable();
    }

    // Handle datetime field changes (timezone-aware value emitted from DateTimeFieldComponent)
    onDateTimeChange(newValue: string | null) {
        this.value = newValue;
        this.emitIfWriteable();
    }

    // Handle relation field changes
    onRelationChange(newValue: any) {
        this.value = newValue;
        this.emitIfWriteable();
    }

    // Handle dict field changes
    onDictChange(newValue: Record<string, any> | null) {
        this.value = newValue;
        this.emitIfWriteable();
    }
}
