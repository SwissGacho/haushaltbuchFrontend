import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BoNameRendererComponent } from './boname-renderer.component';

describe('BoNameRendererComponent', () => {
  let component: BoNameRendererComponent;
  let fixture: ComponentFixture<BoNameRendererComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoNameRendererComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BoNameRendererComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
