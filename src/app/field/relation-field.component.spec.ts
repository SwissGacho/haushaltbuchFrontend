import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RelationFieldComponent } from './relation-field.component';

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
});
