import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DirectMessageSenderComponent } from './direct-message-sender.component';

describe('DirectMessageSenderComponent', () => {
  let component: DirectMessageSenderComponent;
  let fixture: ComponentFixture<DirectMessageSenderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DirectMessageSenderComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DirectMessageSenderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  
});
