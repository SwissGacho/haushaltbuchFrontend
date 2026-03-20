import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateTimeFieldComponent } from './datetime-field.component';

describe('DateTimeFieldComponent', () => {
  let component: DateTimeFieldComponent;
  let fixture: ComponentFixture<DateTimeFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateTimeFieldComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DateTimeFieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should convert backend datetime to local display format', () => {
    const backendValue = '2026-03-02 13:16:53.208799+00:00';
    component.value = backendValue;
    expect(component._displayValue).toMatch(/2026-03-02T\d{2}:\d{2}/);
  });

  it('should emit timezone-aware value on blur', (done) => {
    const backendValue = '2026-03-02 13:16:53.208799+00:00';
    component.value = backendValue;
    const displayedValue = component._displayValue;

    component.valueChange.subscribe((emittedValue: string) => {
      // Emitted value should be ISO format with timezone
      expect(emittedValue).toMatch(/Z$/);
      done();
    });

    // Simulate user not changing the value and blurring
    component.onBlur();
  });

  it('should round-trip datetime values', () => {
    const orig = '2026-03-02 13:16:53.208799+00:00';
    component.value = orig;
    const displayed = component._displayValue;
    expect(displayed).toMatch(/2026-03-02T/);

    // Emit happens on blur
    component.valueChange.subscribe((emittedValue: string) => {
      const dateOrig = new Date(orig.replace(' ', 'T'));
      const dateBack = new Date(emittedValue);
      // Allow up to small differences due to truncation/rounding
      const diff = Math.abs(dateBack.getTime() - dateOrig.getTime());
      expect(diff).toBeLessThan(1000); // less than 1 second
    });

    component.onBlur();
  });
});
