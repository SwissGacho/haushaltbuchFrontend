import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DictFieldComponent } from './dict-field.component';

describe('DictFieldComponent', () => {
  let component: DictFieldComponent;
  let fixture: ComponentFixture<DictFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DictFieldComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DictFieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should convert object value to editable JSON string', () => {
    component.value = { hello: 'world', count: 2 };

    expect(component.jsonValue).toContain('"hello": "world"');
    expect(component.jsonValue).toContain('"count": 2');
  });

  it('should parse edited JSON string and emit object on blur', () => {
    component.value = { a: 1 };
    component.jsonValue = '{"hello":"world","nested":{"x":1}}';

    let emitted: any = null;
    component.valueChange.subscribe(value => {
      emitted = value;
    });

    component.onBlur();

    expect(component.parseError).toBeNull();
    expect(emitted).toEqual({ hello: 'world', nested: { x: 1 } });
  });

  it('should keep parse error for invalid JSON', () => {
    component.value = { a: 1 };
    component.jsonValue = '{invalid';

    component.onBlur();

    expect(component.parseError).toBe('Invalid JSON object.');
  });
});