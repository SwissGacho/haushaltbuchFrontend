import { TestBed } from '@angular/core/testing';

import { SelectedObjectService } from './selected-object.service';

describe('SelectedObjectService', () => {
  let service: SelectedObjectService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SelectedObjectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
