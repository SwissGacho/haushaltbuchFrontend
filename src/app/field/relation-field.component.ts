import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConnectedComponent } from '../connected-component/connected.component';
import { ConnectionService } from '../connection.service';
import { IncomingMessage, MessageType } from '../messages/Message';
import { FetchList, ObjectList, ListObject } from '../messages/data.messages';

@Component({
    selector: 'app-relation-field',
    templateUrl: './relation-field.component.html',
    styleUrls: ['./relation-field.component.css'],
    standalone: true,
    imports: [CommonModule, FormsModule]
})
export class RelationFieldComponent extends ConnectedComponent implements OnInit, OnDestroy {
    @Input() 
    set value(val: any) {
        this._value = val;
        this.selectedId = val?.id?.toString() || '';
    }
    get value(): any {
        return this._value;
    }
    private _value: any;
    @Input() schema: any;
    @Output() valueChange = new EventEmitter<any>();

    possibleValues: ListObject[] = [];
    isLoading = false;    selectedId: string = '';
    constructor(protected override connectionService: ConnectionService) {
        super(connectionService);
        this.setComponentID('RelationFieldComponent');
    }

    override ngOnInit() {
        super.ngOnInit();
        // Don't fetch automatically - wait for focus
    }

    override ngOnDestroy() {
        super.ngOnDestroy();
    }

    get displayName(): string {
        return this._value?.display_name || '';
    }

    get boType(): string {
        return this._value?.bo_type || this.schema?.flags?.relation?.relation || '';
    }

    get id(): number | null {
        return this._value?.id || null;
    }

    fetchPossibleValues() {
        if (!this.boType || this.token === null) {
            return;
        }
        this.isLoading = true;
        const message = new FetchList(this.boType, '', this.token);
        this.sendMessage(message);
    }

    override handleMessages(message: IncomingMessage): void {
        console.groupCollapsed(this.componentID, "received", message.type, "message");
        if (message.type === MessageType.ObjectList) {
            console.log(`${this.componentID} handling ObjectList`, message);
            const objectList = message as ObjectList;
            this.possibleValues = objectList.objects;
            this.isLoading = false;
        } else {
            console.error(`${this.componentID} handling Unexpected message`, message);
        }
        console.groupEnd();
    }

    onFocus() {
        if (!this.isLoading && this.possibleValues.length === 0 && this.boType) {
            if (this.token) {
                this.fetchPossibleValues();
            } else {
                // Token not available yet, wait a bit and try again
                setTimeout(() => {
                    if (this.token) {
                        this.fetchPossibleValues();
                    }
                }, 100);
            }
        }
    }

    onSelectionChange(selectedId: string) {
        if (selectedId === '') {
            // User unselected, set to null
            this._value = null;
            this.valueChange.emit(this._value);
        } else {
            const selectedValue = this.possibleValues.find(v => v.id.toString() === selectedId);
            if (selectedValue) {
                const newValue = {
                    bo_type: this.boType,
                    id: selectedValue.id,
                    display_name: selectedValue.display_name
                };
                this._value = newValue;
                this.valueChange.emit(this._value);
            } else if (selectedId === this.id?.toString()) {
                // Current value was re-selected, no change needed
                return;
            }
        }
    }
}