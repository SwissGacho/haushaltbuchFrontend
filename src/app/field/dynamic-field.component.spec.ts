import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DynamicFieldComponent } from './dynamic-field.component';

describe('DynamicFieldComponent', () => {
    let component: DynamicFieldComponent;
    let fixture: ComponentFixture<DynamicFieldComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DynamicFieldComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(DynamicFieldComponent);
        component = fixture.componentInstance;
        component.schema = {} as any;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should report read-only access from the schema', () => {
        component.schema = { accessLevel: 'read_only' } as any;

        expect(component.isReadOnly).toBe(true);
    });

    it('should report writable access for other access levels', () => {
        component.schema = { accessLevel: 'writeable' } as any;

        expect(component.isReadOnly).toBe(false);
    });

    it('should emit the current value when writable', () => {
        const emitSpy = jest.spyOn(component.valueChange, 'emit');
        component.value = 'current value';

        component.emitIfWriteable();

        expect(emitSpy).toHaveBeenCalledWith('current value');
    });

    it('should not emit when read-only', () => {
        const emitSpy = jest.spyOn(component.valueChange, 'emit');
        component.schema = { accessLevel: 'read_only' } as any;

        component.emitIfWriteable();

        expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should emit the current value on blur', () => {
        const emitSpy = jest.spyOn(component.valueChange, 'emit');
        component.value = 'blurred value';

        component.onBlur();

        expect(emitSpy).toHaveBeenCalledWith('blurred value');
    });

    it('should update and emit a datetime value', () => {
        const emitSpy = jest.spyOn(component.valueChange, 'emit');

        component.onDateTimeChange('2025-01-02T03:04:05Z');

        expect(component.value).toBe('2025-01-02T03:04:05Z');
        expect(emitSpy).toHaveBeenCalledWith('2025-01-02T03:04:05Z');
    });

    it('should update and emit a relation value', () => {
        const emitSpy = jest.spyOn(component.valueChange, 'emit');
        const relation = { id: 42 };

        component.onRelationChange(relation);

        expect(component.value).toBe(relation);
        expect(emitSpy).toHaveBeenCalledWith(relation);
    });

    it('should update and emit a dictionary value', () => {
        const emitSpy = jest.spyOn(component.valueChange, 'emit');
        const dictionary = { category: 'food' };

        component.onDictChange(dictionary);

        expect(component.value).toBe(dictionary);
        expect(emitSpy).toHaveBeenCalledWith(dictionary);
    });

    it('should update a datetime value without emitting when read-only', () => {
        const emitSpy = jest.spyOn(component.valueChange, 'emit');
        component.schema = { accessLevel: 'read_only' } as any;

        component.onDateTimeChange(null);

        expect(component.value).toBeNull();
        expect(emitSpy).not.toHaveBeenCalled();
    });
});
