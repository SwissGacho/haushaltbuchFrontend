import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderSublistComponent } from './header-sublist.component';

describe('HeaderSublistComponent', () => {
  let component: HeaderSublistComponent;
  let fixture: ComponentFixture<HeaderSublistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HeaderSublistComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HeaderSublistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
