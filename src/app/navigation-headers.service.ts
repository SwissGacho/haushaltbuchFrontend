import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface NavigationHeader {
    name: string;
    displayName: string;
}

@Injectable({
    providedIn: 'root',
})
export class NavigationHeadersService {
    private readonly headersSubject = new BehaviorSubject<NavigationHeader[]>([]);
    readonly headers$: Observable<NavigationHeader[]> = this.headersSubject.asObservable();

    setHeaders(headers: NavigationHeader[]): void {
        this.headersSubject.next(headers);
    }

    getHeaders(): NavigationHeader[] {
        return this.headersSubject.value;
    }
}
