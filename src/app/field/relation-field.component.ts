import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConnectedComponent } from '../connected-component/connected.component';
import { ConnectionService } from '../connection.service';
import { IncomingMessage, MessageType } from '../messages/Message';
import { FetchList, ObjectList, ListObject } from '../messages/data.messages';
import { BehaviorSubject } from 'rxjs';

 type SelectOption = Omit<ListObject, 'id'> & {
    id: number | null;
    bo_type?: string;
};

@Component({
    selector: 'app-relation-field',
    templateUrl: './relation-field.component.html',
    styleUrls: ['./relation-field.component.css'],
    standalone: true,
    imports: [CommonModule, FormsModule]
})
export class RelationFieldComponent extends ConnectedComponent implements OnInit, OnDestroy {
    @Input() value: SelectOption | null = null;
    @Input() schema: any;
    @Output() valueChange = new EventEmitter<SelectOption | null>();

    // Ein Subject, das die Optionen hält
    options$ = new BehaviorSubject<SelectOption[]>([]);
    isOpen = false;
    isLoading = false;

    // possibleValues: ListObject[] = [];
    // isLoading = false;    selectedId: string = '';
    constructor(protected override connectionService: ConnectionService) {
        super(connectionService);
        this.setComponentID('RelationFieldComponent');
    }

    override ngOnInit() {
        super.ngOnInit();
    }

    override ngOnDestroy() {
        super.ngOnDestroy();
    }

    get boType(): string {
        return this.schema?.flags?.relation?.relation || '';
    }

    fetchPossibleValues() {
        if (!this.boType || this.token === null) {
            return;
        }
        this.isLoading = true;
        const message = new FetchList(this.boType, '', this.token);
        this.sendMessage(message);
    }

    toggleOpen() {
        if (this.isOpen) {
            this.isOpen = false;
            return;
        }

        // If no options are loaded (except for the initial value)
        if (this.options$.value.length <= 1) {
            this.fetchPossibleValues();
        } else {
            this.isOpen = true;
        }
    }

    override handleMessages(message: IncomingMessage): void {
        console.groupCollapsed(this.componentID, "received", message.type, "message");
        if (message.type === MessageType.ObjectList) {
            console.log(`${this.componentID} handling ObjectList`, message);
            const objectList = message as ObjectList;
            const emptyOption: SelectOption = { id: null, display_name: '--- None ---' };
            this.options$.next([emptyOption, ...objectList.objects]);            
            this.isLoading = false;
            this.isOpen = true;
        } else {
            console.error(`${this.componentID} handling Unexpected message`, message);
        }
        console.groupEnd();
    }

    selectOption(option: SelectOption) {
        if (option.id === null) {
            this.value = null;
            this.valueChange.emit(null);
        } else {
            this.value = option;
            this.valueChange.emit({...option, bo_type: this.boType});
        }
        this.isOpen = false;
    }

    close() {
        this.isOpen = false;
    }

}
