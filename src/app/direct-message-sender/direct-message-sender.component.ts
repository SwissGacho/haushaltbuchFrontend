import { Component, OnInit } from '@angular/core';
import { HelloWorldService } from '../HelloWorld.service';

/**
 * This component allows users to send messages and view responses.
 * It interacts with the HelloWorldService to send messages and subscribe
 * to incoming responses. The component provides an input field for users
 * to enter their messages and displays the responses received from the
 * service.
 * 
 * 
 * @remarks
 * Thank you ChatGPT for this actually quite accurate docustring!
 */
@Component({
  selector: 'app-direct-message-sender',
  templateUrl: './direct-message-sender.component.html',
  styleUrls: ['./direct-message-sender.component.css']
})
export class DirectMessageSenderComponent implements OnInit {

  messageOut: string = `{
    "pirateMessage": {
      "author": "Cap'n Bluebeard",
      "content": "Arrr, me hearties! Spotted a merchant ship off the starboard bow. Ready yer cutlasses, hoist the sails, and prepare to board! Treasure awaits!",
      "location": {
        "latitude": "16.34N",
        "longitude": "82.65W"
      },
      "ship": "The Salty Sea Dog",
      "crew": [
        {"name": "Black Sam", "role": "First Mate", "fondOf": "Rum"},
        {"name": "One-Eyed Jack", "role": "Lookout", "fondOf": "Gold"},
        {"name": "Mad Anne", "role": "Gunner", "fondOf": "Explosions"}
      ],
      "treasure": {
        "chests": 5,
        "goldCoins": 1000,
        "preciousGems": ["Rubies", "Emeralds", "Sapphires"]
      },
      "plannedCourse": ["Tortuga", "Port Royal", "The Bermuda Triangle"]
    }
  }`
  response: string = "";

  ngOnInit(): void {
    console.log("Starting Direct Message Sender Component");
    this.helloWorldService.connectToTest().subscribe({
      next:     message => this.setResponse(message),
      error:    error => console.error(error),
      complete: () => console.warn("Direct Message sender connection lost or closed")
    }
    )
  }

  
  setResponse(message: string): void {
    this.response = message
  }

  sendMessage(): void {
    console.log("Direct Message Component Sending message");
    this.helloWorldService.sendJSONString(this.messageOut);
  }

  constructor(private helloWorldService:HelloWorldService) { }

}
