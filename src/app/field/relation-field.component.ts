import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConnectedComponent } from '../connected-component/connected.component';
import { ConnectionService } from '../connection.service';
import { IncomingMessage, MessageType } from '../messages/Message';
import { FetchList, ObjectList, ListObject } from '../messages/data.messages';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

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

    @ViewChild('inputElement') inputElement!: ElementRef<HTMLInputElement>;

    // subject providing the full list of options fetched from the backend
    options$ = new BehaviorSubject<SelectOption[]>([]);
    filterText$ = new BehaviorSubject<string>('');
    filteredOptions$ = combineLatest([this.options$, this.filterText$]).pipe(
        map(([options, filter]) => options.filter(opt => 
            opt.display_name.toLowerCase().includes(filter.toLowerCase())
        ))
    );
    isOpen = false;
    isLoading = false;
    selectedIndex = -1;
    currentFilteredOptions: SelectOption[] = [];

    constructor(protected override connectionService: ConnectionService, private elementRef: ElementRef) {
        super(connectionService);
        this.setComponentID('RelationFieldComponent');
    }

    override ngOnInit() {
        super.ngOnInit();
        this.filteredOptions$.subscribe(options => this.currentFilteredOptions = options);
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
            this.filterText$.next('');
            this.selectedIndex = -1;
            return;
        }

        // If no options are loaded (except for the initial value)
        if (this.options$.value.length <= 1) {
            this.fetchPossibleValues();
        } else {
            this.isOpen = true;
            this.selectedIndex = this.currentFilteredOptions.findIndex(opt => 
                (opt.id === null && !this.value) || (opt.id === this.value?.id)
            );
            setTimeout(() => this.inputElement.nativeElement.focus());
        }
    }

    override handleMessages(message: IncomingMessage): void {
        console.groupCollapsed(this.componentID, "received", message.type, "message");
        if (message.type === MessageType.ObjectList  && this.isLoading) {
            console.log(`${this.componentID} handling ObjectList`, message);
            const objectList = message as ObjectList;
            const emptyOption: SelectOption = { id: null, display_name: '--- None ---' };
            this.options$.next([emptyOption, ...objectList.objects]);            
            this.isLoading = false;
            this.isOpen = true;
            this.selectedIndex = this.currentFilteredOptions.findIndex(opt => 
                (opt.id === null && !this.value) || (opt.id === this.value?.id)
            );
            setTimeout(() => this.inputElement.nativeElement.focus());
        } else {
            console.error(`${this.componentID} handling Unexpected message`, message);
        }
        console.groupEnd();
    }

    selectOption(option: SelectOption) {
        console.log(`${this.componentID} option selected`, option);
        if (option.id === null) {
            this.value = null;
            this.valueChange.emit(null);
        } else {
            this.value = option;
            this.valueChange.emit({...option, bo_type: this.boType});
        }
        this.isOpen = false;
        this.filterText$.next('');
        this.selectedIndex = -1;
    }

    close() {
        this.isOpen = false;
        this.filterText$.next('');
        this.selectedIndex = -1;
    }

    onInput(event: Event) {
        const target = event.target as HTMLInputElement;
        this.filterText$.next(target.value);
        this.selectedIndex = -1;
    }

    onKeyDown(event: KeyboardEvent) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (this.selectedIndex < this.currentFilteredOptions.length - 1) {
                this.selectedIndex++;
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (this.selectedIndex > 0) {
                this.selectedIndex--;
            } else if (this.selectedIndex === 0) {
                this.selectedIndex = -1;
            }
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (this.selectedIndex >= 0 && this.selectedIndex < this.currentFilteredOptions.length) {
                this.selectOption(this.currentFilteredOptions[this.selectedIndex]);
            } else if (this.currentFilteredOptions.length === 1) {
                this.selectOption(this.currentFilteredOptions[0]);
            }
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.close();
        }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event) {
        if (!this.elementRef.nativeElement.contains(event.target as Node)) {
            this.close();
        }
    }
}
