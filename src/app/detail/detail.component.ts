import { Component, OnInit } from '@angular/core';
import { ConnectedComponent } from '../connected-component/connected.component';
import { ConnectionService } from '../connection.service';
import { IncomingMessage, MessageType } from '../messages/Message';
import { FetchMessage, ObjectMessage, StoreMessage } from '../messages/data.messages';
import { SelectedObjectService } from '../selected-object.service';
import { BoIdentifier } from '../business-object/bo.identifier';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-detail-component',
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.css',
  standalone: false
})
export class DetailComponent extends ConnectedComponent implements OnInit {

  selectedObject: BoIdentifier | null = null;
  private subscription = new Subscription();

  constructor(protected override connectionService: ConnectionService, private selectedObjectService: SelectedObjectService) {
    super(connectionService);
    this.setComponentID('DetailComponent');
  }

  override OBSERVE_HANDSHAKE = true;
  objectInfo: any = null;
  objectInfoClean: any = null;
  objectKeys: string[] = [];

  override handleMessages(message: IncomingMessage): void {
      console.groupCollapsed(this.componentID, "received", message.type, "message");
      if (message.type === MessageType.Welcome) {
            console.log(`${this.componentID} handling welcome`, message);
          this.token = message.token;
          this.subscribeToSelectedObject();
      }
      else if (message.type === MessageType.Hello) {
            console.log(`${this.componentID} handling hello`, message);
      }
      else if (message.type === MessageType.Object) {
        console.log(`${this.componentID} handling object message`, message);
        let cast = message as ObjectMessage;
        this.updateObjectInfo(cast.payload);
      }
      else {
          // We received an unexpected or unknown message
            console.error(`${this.componentID} handling Unexpected message of type ${message.type}`, message);
      }
      console.groupEnd();
  }

  subscribeToSelectedObject() {
    this.subscription.add(
      this.selectedObjectService.selectedObject$.subscribe(object => {
        this.onSelectedObjectChange(object);;
      })
    );
  }

  fetchObject() {
    if(this.token === null) {
      console.error('No token available');
      return;
    }
    console.log('Fetching object');
    let message = new FetchMessage(this.selectedObject!.type, this.selectedObject!.id, this.token);
    this.sendMessage(message);
  }

  updateObjectInfo(objectInfo: any) {
    this.objectInfo = objectInfo;
    this.objectInfoClean = { ...objectInfo };
    this.objectKeys = Object.keys(objectInfo);
  }

  updateObject(key: string) {
    console.groupCollapsed(this.componentID, "updating object", key, this.objectInfo[key]);
    console.log('Updating object', key, this.objectInfo[key]);
    if(this.objectInfoClean[key] === this.objectInfo[key]) {
      console.log('No change detected');
    }
    else {
      let message = new StoreMessage(this.selectedObject!.type, this.selectedObject!.id, { [key]: this.objectInfo[key] }, this.token!);
      this.sendMessage(message);
    }  
    console.groupEnd();
  }


  private onSelectedObjectChange(object: BoIdentifier | null) {
    this.selectedObject = object;
    this.fetchObject();
    // TODO: Unsubscribe from previous object
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.subscription.unsubscribe();
  }
}
