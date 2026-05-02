import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConnectedComponent } from '../connected-component/connected.component';
import { ConnectionService } from '../connection.service';
import { IncomingMessage, MessageType } from '../messages/Message';
import { FetchList, ObjectList } from '../messages/data.messages';
import { ListObject } from '../messages/Message';
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
    shouldOpenOnLoad = false;
    dropUp = false;
    selectedIndex = -1;
    currentFilteredOptions: SelectOption[] = [];

    override OBSERVE_HANDSHAKE = true;

    constructor(protected override connectionService: ConnectionService, private elementRef: ElementRef) {
        super(connectionService);
        this.setComponentID('RelationFieldComponent');
    }

    override ngOnInit() {
        // Do NOT call super.ngOnInit() — connection is opened lazily
        // super.ngOnInit();
        this.filteredOptions$.subscribe(options => this.currentFilteredOptions = options);
    }

    override ngOnDestroy() {
        super.ngOnDestroy();
    }

    get boType(): string {
        return this.schema?.flags?.relation?.relation || '';
    }

    fetchPossibleValues() {
        if (!this.boType) {
            return;
        }
        this.isLoading = true;
        console.log(`${this.componentID} fetching possible values for`, this.boType);
        console.log(`${this.componentID} checking if should open on load:`, this.shouldOpenOnLoad, "or is loading:", this.isLoading);
        // Open the connection the first time it's actually needed
        if (!this.connected) {
            console.log(`${this.componentID} opening connection to fetch possible values`);
            this.getConnection();
            // connection is set up asynchronously during handshake, so return here;
            // shouldOpenOnLoad / the caller will retry once Welcome message arrives
            return;
        }
        if (this.token === null) {
            return;
        }

        const message = new FetchList(this.boType, '', this.token);
        this.sendMessage(message);
    }

    override handleMessages(message: IncomingMessage): void {
        console.groupCollapsed(this.componentID, "received", message.type, "message");
        if (message.type === MessageType.ObjectList  && this.isLoading) {
            console.log(`${this.componentID} handling ObjectList`, message);
            const objectList = message as ObjectList;
            const emptyOption: SelectOption = { id: null, display_name: '--- None ---' };
            this.options$.next([emptyOption, ...objectList.objects]);            
            this.isLoading = false;

            if (this.shouldOpenOnLoad) {
                this.shouldOpenOnLoad = false;
                this.open();
                this.selectedIndex = this.currentFilteredOptions.findIndex(opt => 
                    (opt.id === null && !this.value) || (opt.id === this.value?.id)
                );
                setTimeout(() => this.inputElement.nativeElement.focus());
            }
        } else if (message.type === MessageType.Welcome) {
            console.log(`${this.componentID} received Welcome message`, message);
            console.log(`${this.componentID} checking if should open on load:`, this.shouldOpenOnLoad, "or is loading:", this.isLoading);
            // If someone is already waiting for a fetch, kick it off now
            if (this.shouldOpenOnLoad || this.isLoading) {
                this.fetchPossibleValues();
            }
        } else if (message.type !== MessageType.Hello) {
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

    toggleOpen() {
        if (this.isOpen) {
            this.isOpen = false;
            this.filterText$.next('');
            this.selectedIndex = -1;
            return;
        }

        // If no options are loaded (except for the initial value)
        if (this.options$.value.length <= 1) {
            this.shouldOpenOnLoad = true;
            this.fetchPossibleValues();
        } else {
            this.isOpen = true;
            this.selectedIndex = this.currentFilteredOptions.findIndex(opt => 
                (opt.id === null && !this.value) || (opt.id === this.value?.id)
            );
            setTimeout(() => this.inputElement.nativeElement.focus());
        }
    }

    open() {
        if (!this.isOpen) {
            this.updateDropDirection();
            this.toggleOpen();
        }
    }


    close() {
        this.isOpen = false;
        this.filterText$.next('');
        this.selectedIndex = -1;
    }

    updateDropDirection() {
        const rect = this.elementRef.nativeElement.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const estimatedHeight = 200; // match your max-height in CSS
        this.dropUp = spaceBelow < estimatedHeight;
    }

    onInput(event: Event) {
        const target = event.target as HTMLInputElement;
        const value = target.value;
        this.filterText$.next(value);
        this.open();
        if (this.options$.value.length <= 1 && !this.isLoading) {
            this.fetchPossibleValues();
        }
        this.selectedIndex = this.currentFilteredOptions.length > 0 ? 0 : -1;
    }

    onFocus() {
        if (this.options$.value.length <= 1 && !this.isLoading) {
            this.shouldOpenOnLoad = false;
            this.fetchPossibleValues();
        }
    }

    onBlur() {
        const inputValue = this.inputElement.nativeElement.value.trim();
        const matched = this.currentFilteredOptions.find(opt => opt.display_name === inputValue);
        if (matched) {
            this.selectOption(matched);
        } else {
            this.close();
        }
    }

    onKeyDown(event: KeyboardEvent) {
        if (!this.isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter')) {
            event.preventDefault();
            if (this.options$.value.length <= 1 && !this.isLoading) {
                this.shouldOpenOnLoad = true;
                this.fetchPossibleValues();
            }
            this.open();
            this.selectedIndex = this.currentFilteredOptions.findIndex(opt => 
                (opt.id === null && !this.value) || (opt.id === this.value?.id)
            );
            if (this.selectedIndex === -1 && this.currentFilteredOptions.length > 0) {
                this.selectedIndex = 0;
            }
            if (event.key === 'Enter') {
                return;
            }
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (this.selectedIndex < this.currentFilteredOptions.length - 1) {
                this.selectedIndex++;
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (this.selectedIndex > 0) {
                this.selectedIndex--;
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
