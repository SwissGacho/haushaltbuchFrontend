import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { BoIdentifier } from 'src/app/business-object/bo.identifier';
import { ConnectedComponent } from 'src/app/connected-component/connected.component';
import { ConnectionService } from 'src/app/connection.service';
import { FetchList, ObjectList } from 'src/app/messages/data.messages';
import { IncomingMessage, MessageType } from 'src/app/messages/Message';
import { SelectedObjectService } from 'src/app/selected-object.service';

@Component({
    selector: 'app-header-sublist',
    templateUrl: './header-sublist.component.html',
    styleUrls: ['./header-sublist.component.css'],
    standalone: false
})
export class HeaderSublistComponent extends ConnectedComponent implements OnInit {

  constructor(protected override connectionService: ConnectionService, private selectedObjectService: SelectedObjectService) {
      super(connectionService);
      this.setComponentID('Sublist');
  }

  objects: string[] = [];

  override OBSERVE_HANDSHAKE = true;

  override handleMessages(message: IncomingMessage): void {
      console.groupCollapsed(this.componentID, "received", message.type, "message");
      if (message.type === MessageType.Welcome) {
          console.log('Received welcome', message);
          this.token = message.token;
          this.fetchList();
      }
      else if (message.type === MessageType.ObjectList) {
          let cast = message as ObjectList;
          console.log('Received list', cast);
          this.objects = cast.objects;
      }
      else {
          console.error('Unexpected message', message);
      }
      console.groupEnd();
  }

  fetchList() {
      if(this.token === null) {
          console.error('No token available');
          return;
      }
      console.log('Fetching list');
      let message = new FetchList(this.header, undefined, this.token);
      this.sendMessage(message);
  }

  onObjectClick(object: string): void {
    let id: BoIdentifier = new BoIdentifier(this.header, Number(object));
    this.selectedObjectService.selectObject(id);
  }
    

  // An input property to receive the headers from the parent component
  @Input() header: string = '';

}
