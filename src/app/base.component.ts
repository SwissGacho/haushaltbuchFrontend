import { Component } from '@angular/core';

let nextComponentId = 1;

@Component({
    template: '',
    standalone: false,
})
export class IdentifiedComponent {
    componentName: string = 'component';
    componentID: string = 'undefined component';

    setComponentID(name: string) {
        this.componentID = name + '_' + nextComponentId++;
    }
}
