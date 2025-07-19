import { Component, Input, OnInit } from '@angular/core';
import { ConnectedComponent } from 'src/app/connected-component/connected.component';
import { ConnectionService } from 'src/app/connection.service';
import { FetchList, ObjectList } from 'src/app/messages/data.messages';
import { IncomingMessage, MessageType } from 'src/app/messages/Message';

@Component({
    selector: 'app-header-sublist',
    templateUrl: './header-sublist.component.html',
    styleUrls: ['./header-sublist.component.css'],
    standalone: false
})
export class HeaderSublistComponent extends ConnectedComponent implements OnInit {

  constructor(protected override connectionService: ConnectionService) {
      super(connectionService);
      this.setComponentID('Sublist');
  }

  objects: string[] = [];

  override OBSERVE_HANDSHAKE = true;

  override handleMessages(message: IncomingMessage): void {
      console.warn(this.componentID, "received", message.type, "message");
      if (message.type === MessageType.Welcome) {
          console.warn('Received welcome', message);
          this.token = message.token;
          this.fetchList();
      }
      else if (message.type === MessageType.ObjectList) {
          let cast = message as ObjectList;
          console.warn('Received list', cast);
          this.objects = cast.objects;
      }
      else {
          // We received an unexpected or unknown message
          console.error('Unexpected message', message);

      }
  }

  fetchList() {
      if(this.token === null) {
          console.error('No token available');
          return;
      }
      console.warn('Fetching list');
      let message = new FetchList(this.header, undefined, this.token);
      this.sendMessage(message);
  }
    

  // An input property to receive the headers from the parent component
  @Input() header: string = '';

}
