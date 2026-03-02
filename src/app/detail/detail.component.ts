import { Component, OnInit } from '@angular/core';
import { ConnectedComponent } from '../connected-component/connected.component';
import { ConnectionService } from '../connection.service';
import { IncomingMessage, MessageType } from '../messages/Message';
import { FetchMessage, FetchSchemaMessage, ObjectMessage, ObjectSchemaMessage, StoreMessage } from '../messages/data.messages';
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
  objectInfoCache: any = null;      // raw values coming from backend (timezone aware)
  objectInfoClean: any = null;      // mirror of raw values for change detection
  objectFields: string[] = [];
  objectSchema: any = null;
  objectUpdating: boolean = false;
  schemaUpdating: boolean = false;


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
      else if (message.type === MessageType.ObjectSchema) {
        console.log(`${this.componentID} handling object schema message`, message);
        let cast = message as ObjectSchemaMessage;
        console.log('Received schema', cast.schema);
        this.updateSchemaInfo(cast.schema);
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

  fetchSchema() {
    if(this.token === null) {
      console.error('No token available');
      return;
    }
    console.log('Fetching schema');
    this.schemaUpdating = true;
    let message = new FetchSchemaMessage(this.selectedObject!.type, this.token);
    this.sendMessage(message);
  }

  fetchObject() {
    if(this.token === null) {
      console.error('No token available');
      return;
    }
    console.log('Fetching object');
    this.objectUpdating = true;
    let message = new FetchMessage(this.selectedObject!.type, this.selectedObject!.id, this.token);
    this.sendMessage(message);
  }

  updateSchemaInfo(schema: any) {
    this.objectSchema = schema;
    this.objectFields = Object.keys(this.objectSchema || {});
    this.schemaUpdating = false;
    console.info('Schema updated', this.objectSchema);
    if (!this.objectUpdating) {
      this.updateObjectFrontend()
    }
  }

  updateObjectInfo(objectInfo: any) {
    this.objectInfoCache = objectInfo;
    this.objectUpdating = false;
    if (!this.schemaUpdating) {
      this.updateObjectFrontend()
    }
  }

  updateObjectFrontend() {
    // copy raw values into editable view; convert datetimes to local representation
    this.objectInfo = { ...this.objectInfoCache };
    this.objectInfoClean = { ...this.objectInfoCache };

    if (this.objectSchema) {
      for (const key of Object.keys(this.objectSchema)) {
        if (this.objectSchema[key].type === 'datetime' && this.objectInfo[key]) {
          this.objectInfo[key] = this.formatDateTimeLocal(this.objectInfo[key]);
        }
      }
    }

    this.objectInfoCache = null;
  }

  updateObject(key: string) {
    console.groupCollapsed(this.componentID, "updating object", key, this.objectInfo[key]);
    let value = this.objectInfo[key];

    // if it's a datetime field we need to convert from local string back to
    // a timezone-aware form that the backend understands
    if (this.objectSchema && this.objectSchema[key]?.type === 'datetime' && value) {
      value = this.toTimezoneAwareLocal(value);
      console.log('converted local datetime to timezone-aware', value);
    }

    if (this.objectInfoClean[key] === value) {
      console.log('No change detected');
    } else {
      let message = new StoreMessage(this.selectedObject!.type, this.selectedObject!.id, { [key]: value }, this.token!);
      this.sendMessage(message);
      // update clean copy so further edits compare correctly
      this.objectInfoClean[key] = value;
    }
    console.groupEnd();
  }


  private onSelectedObjectChange(object: BoIdentifier | null) {
    this.selectedObject = object;
    this.fetchObject();
    if (object?.type != this.objectSchema?.type) {
      this.fetchSchema();
    }
    // TODO: Unsubscribe from previous object
  }

  /*
   * Helpers for datetime handling
   */
  private formatDateTimeLocal(value: string): string {
    try {
      // Parse backend ISO string: "2026-03-02 13:16:53.208799+00:00"
      // Replace space with 'T' for JS Date parsing
      const iso = value.replace(' ', 'T');
      const date = new Date(iso);
      
      if (isNaN(date.getTime())) {
        console.warn('Failed to parse datetime:', value);
        return value;
      }
      
      // Convert to local timezone by getting local components
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      const second = String(date.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    } catch (e) {
      console.warn('formatDateTimeLocal failed', e, value);
      return value;
    }
  }

  private toTimezoneAwareLocal(localString: string): string {
    try {
      // localString is in format YYYY-MM-DDTHH:mm (no timezone info)
      // Create a date in local timezone and convert to ISO with offset
      const [dateStr, timeStr] = localString.split('T');
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute, second] = timeStr.split(':').map(Number);
      
      // Create date in local timezone
      const date = new Date(year, month - 1, day, hour, minute, second, 0);
      
      // Return ISO string with timezone offset
      return date.toISOString();
    } catch (e) {
      console.warn('toTimezoneAwareLocal failed', e, localString);
      return localString;
    }
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.subscription.unsubscribe();
  }
}
