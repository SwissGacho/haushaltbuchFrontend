import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BONameRendererComponent } from './boname-renderer.component';

describe('BONameRendererComponent', () => {
  let component: BONameRendererComponent;
  let fixture: ComponentFixture<BONameRendererComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BONameRendererComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BONameRendererComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
