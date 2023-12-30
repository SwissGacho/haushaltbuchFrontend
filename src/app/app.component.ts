import { Component } from '@angular/core';
import { HelloWorldService } from './HelloWorld.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'haushaltbuchFrontend';

  constructor(private helloWorldService: HelloWorldService) { }

  ngOnInit() {
    this.helloWorldService.connectToTest()
      .subscribe({
        next: message => { console.log(message) },
        error: error => console.error(error),
        complete: () => console.warn("Remote server called complete")
      })
  }
}
