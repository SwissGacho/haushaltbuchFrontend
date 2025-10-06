import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateObjectButtonComponent } from './create-object-button.component';

describe('CreateObjectButtonComponent', () => {
  let component: CreateObjectButtonComponent;
  let fixture: ComponentFixture<CreateObjectButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateObjectButtonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateObjectButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
