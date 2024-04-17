import { Component } from '@angular/core';

let nextComponentId = 0;

@Component({
  template: ''
})
export class BaseComponent {
    componentName: string = 'component';
    componentID: string = 'undefined component';

  setComponentID(name: string) {
    this.componentID = name + '_' + nextComponentId++;
  }
}
