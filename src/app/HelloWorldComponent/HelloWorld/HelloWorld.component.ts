import { Component, OnInit } from '@angular/core';
import { HelloWorldService } from 'src/app/HelloWorld.service';

@Component({
  selector: 'app-hello-world',
  templateUrl: './HelloWorld.component.html',
  styleUrls: ['./HelloWorld.component.css'],
})
export class HelloWorldComponent implements OnInit {

  constructor(private helloWorldServcie: HelloWorldService) { }

  message: string = "Goodbye world";

  ngOnInit(): void {
    console.log("Starting Hello World Component");
    this.message = "Goodbye world";
    this.helloWorldServcie.getHelloWorld().subscribe(message => this.setMessage(message));
  }

  setMessage(message: string): void {
    this.message = message
    console.log("Calling back");
    console.log(message);
  }

}
