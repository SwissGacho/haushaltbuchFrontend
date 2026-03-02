import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailComponent } from './detail.component';

describe('DetailComponent', () => {
  let component: DetailComponent;
  let fixture: ComponentFixture<DetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should round-trip datetime values', () => {
    // the private helpers convert to local-friendly strings and back to timezone-aware
    const orig = '2026-03-02 13:16:53.208799+00:00';
    const local = (component as any)['formatDateTimeLocal'](orig);
    expect(local).toMatch(/2026-03-02T/);
    const back = (component as any)['toTimezoneAwareLocal'](local);
    const dateOrig = new Date(orig.replace(' ', 'T'));
    const dateBack = new Date(back);
    // Allow up to one minute difference due to precision truncation
    const diff = Math.abs(dateBack.getTime() - dateOrig.getTime());
    expect(diff).toBeLessThan(60_000);
  });
});
