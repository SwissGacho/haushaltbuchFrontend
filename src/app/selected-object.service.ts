import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BoIdentifier } from './business-object/bo.identifier';

@Injectable({
  providedIn: 'root'
})
export class SelectedObjectService {
  private selectedObjectSubject = new BehaviorSubject<BoIdentifier | null>(null);

  selectedObject$: Observable<BoIdentifier | null> = this.selectedObjectSubject.asObservable();

  get currentSelection(): BoIdentifier | null {
    return this.selectedObjectSubject.value;
  }

  selectObject(object: BoIdentifier): void {
    console.log('Service selects new object:', object);
    this.selectedObjectSubject.next(object);
  }

  clearSelection(): void {
    this.selectedObjectSubject.next(null);
  }
  
}