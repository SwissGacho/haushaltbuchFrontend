import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RelationFieldComponent } from './relation-field.component';

describe('RelationFieldComponent', () => {
  let component: RelationFieldComponent;
  let fixture: ComponentFixture<RelationFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RelationFieldComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RelationFieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});