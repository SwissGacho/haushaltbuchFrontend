import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RelationFieldComponent } from './relation-field.component';
import { MessageType } from '../messages/Message';
import { ObjectMessage } from '../messages/data.messages';

describe('RelationFieldComponent', () => {
    let component: RelationFieldComponent;
    let fixture: ComponentFixture<RelationFieldComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RelationFieldComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(RelationFieldComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('emits only once when selecting the same option twice', () => {
        const emittedValues: unknown[] = [];
        component.valueChange.subscribe((value) => emittedValues.push(value));

        const option = { id: 5, display_name: 'Related 5' } as any;

        component.selectOption(option);
        component.selectOption(option);

        expect(emittedValues.length).toBe(1);
    });

    it('does not emit when selecting none while already none', () => {
        const emittedValues: unknown[] = [];
        component.value = null;
        component.valueChange.subscribe((value) => emittedValues.push(value));

        component.selectOption({ id: null, display_name: '--- None ---' } as any);

        expect(emittedValues.length).toBe(0);
    });

    it('opens from an empty loaded list without fetching again', () => {
        component.schema = { flags: { relation: { relation: 'example' } } };
        component.setToken('token');
        component.connected = true;

        const sendMessageSpy = jest.spyOn(component, 'sendMessage');

        component.fetchPossibleValues();

        expect(sendMessageSpy).toHaveBeenCalledTimes(1);

        component.shouldOpenOnLoad = true;
        component.handleMessages(
            new ObjectMessage({
                type: MessageType.Object,
                token: null,
                object: 'bolist',
                index: 'example',
                payload: { objects: [] },
            } as any)
        );

        expect(component.optionsLoaded).toBe(true);
        expect(component.isOpen).toBe(true);

        component.close();
        component.toggleOpen();

        expect(component.isOpen).toBe(true);
        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    });
});
