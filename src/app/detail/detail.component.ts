import { Component, OnInit } from '@angular/core';
import { ConnectedComponent } from '../connected-component/connected.component';
import { ConnectionService } from '../connection.service';
import { IncomingMessage, MessageType } from '../messages/Message';
import { FetchMessage, FetchSchemaMessage, ObjectMessage, ObjectSchemaMessage, StoreMessage } from '../messages/data.messages';
import { SelectedObjectService } from '../selected-object.service';
import { BoIdentifier } from '../business-object/bo.identifier';
import { Subscription } from 'rxjs';
import { parseObjectSchema } from '../business-object/bo-schema/bo.schema.parse';
import { ObjectSchema } from '../business-object/bo-schema/bo.schema.types';


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
  selectedType: string | null = null;
  objectInfo: any = null;
  objectInfoCache: any = null;      // raw values coming from backend (timezone aware)
  objectInfoClean: any = null;      // mirror of raw values for change detection
  objectFields: string[] = [];
  objectSchema: ObjectSchema | null = null;
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
        this.updateObjectInfo(cast.payload, cast.object);
      }
      else if (message.type === MessageType.ObjectSchema) {
        console.log(`${this.componentID} handling object schema message`, message);
        let cast = message as ObjectSchemaMessage;
        console.log('Received schema', cast.schema);
        this.updateSchemaInfo(cast.schema, cast.object);
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
    let message = new FetchMessage(this.selectedObject!.type, Number(this.selectedObject!.id), this.token);
    this.sendMessage(message);
  }

  updateSchemaInfo(schema: any, object: string) {
    // Check whether the schema is for the currently selected object
    if (object !== this.selectedObject?.type) {
      console.warn('Received schema for type', schema.type, 'but selected object is of type', this.selectedObject?.type);
      return;
    }
    this.objectSchema = parseObjectSchema(schema);
    this.objectFields = Object.keys(this.objectSchema || {});
    this.schemaUpdating = false;
    console.info('Schema updated', this.objectSchema);

    if(this.selectedObject?.id == undefined) {
      this.objectInfoCache = this.normalizeInitialValues(this.selectedObject.initialValues || {}, this.objectSchema);
    }
    if (!this.objectUpdating) {
      this.updateObjectFrontend()
    }
  }

  updateObjectInfo(objectInfo: any, object: string){
    // If objectinfo.id is undefined, we assume it's a response to an object creation and accept the info if the type matches
    // Tell the selected object service to select the new object, update our info and proceed
    console.log('Received object info for type', object, 'with data', objectInfo, 'selected object is', this.selectedObject, 'with id', this.selectedObject?.id);
    if(this.selectedObject?.id === undefined && this.selectedObject?.type === object) {
      // console.info('Received object info for new object of type', object, 'with data', objectInfo);
      this.selectedObjectService.selectObject({ type: object, id: objectInfo.id });
      return;
    }

    // Check whether the object info is for the currently selected object.
    if  (!(objectInfo.id === this.selectedObject?.id && object === this.selectedObject?.type)) {
      // console.warn('Received object info for', object, 'with id', objectInfo.id, 'but selected object is', this.selectedObject?.type, 'with id', this.selectedObject?.id);
      return;
    }
    
    this.objectInfoCache = objectInfo;
    this.objectUpdating = false;
    if (!this.schemaUpdating) {
      this.updateObjectFrontend()
    }
  }

  updateObjectFrontend() {
    // copy raw values into editable view
    // specialized field components (DateTimeFieldComponent, etc) handle their own display conversions
    this.objectInfo = { ...this.objectInfoCache };
    // For new objects, exclude prefilled initial values from objectInfoClean so they are always detected as changes
    if (this.selectedObject?.id === undefined) {
      const prefilled = new Set(Object.keys(this.selectedObject?.initialValues || {}));
      this.objectInfoClean = Object.fromEntries(
        Object.entries(this.objectInfoCache || {}).filter(([key]) => !prefilled.has(key))
      );
    } else {
      this.objectInfoClean = { ...this.objectInfoCache };
    }
    this.objectInfoCache = null;
  }

  private normalizeInitialValues(initialValues: Record<string, unknown>, schema: any): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...initialValues };

    for (const [key, value] of Object.entries(normalized)) {
      if (schema?.[key]?.type !== 'relation' || typeof value !== 'number') {
        continue;
      }

      normalized[key] = {
        id: value,
        display_name: String(value),
        bo_type: schema[key]?.flags?.relation?.relation
      };
    }

    return normalized;
  }

  onObjectValueChange(key: string) {
    // Blur/valueChange events can still arrive while the component is switching selections.
    // Ignore these stale events when the backing state was already reset.
    if (!this.objectInfo || !this.objectInfoClean || !this.selectedObject || !this.token) {
      console.warn('Ignoring value change while detail state is not ready', {
        key,
        hasObjectInfo: !!this.objectInfo,
        hasObjectInfoClean: !!this.objectInfoClean,
        hasSelectedObject: !!this.selectedObject,
        hasToken: !!this.token
      });
      return;
    }

    console.groupCollapsed(this.componentID, "updating object", key, this.objectInfo[key]);
    const value = this.objectInfo[key];

    // For new objects with prefilled values, missing keys from objectInfoClean indicate prefilled fields
    const cleanValue = Object.prototype.hasOwnProperty.call(this.objectInfoClean, key) ? this.objectInfoClean[key] : undefined;
    const hasChanged = cleanValue !== value;

    if (!hasChanged) {
      console.log('No change detected');
    }
    else {
      // Build payload: for new objects, include all prefilled fields; for existing objects, just the changed field
      let payload: Record<string, unknown> = { [key]: value };
      if (this.selectedObject.id === undefined) {
        // Include all prefilled fields in the payload for new objects
        const preFilled = this.selectedObject.initialValues || {};
        for (const preFillKey of Object.keys(preFilled)) {
          if (Object.prototype.hasOwnProperty.call(this.objectInfo, preFillKey)) {
            payload[preFillKey] = this.objectInfo[preFillKey];
          }
        }
      }
      const index = this.selectedObject.id === undefined ? null : Number(this.selectedObject.id);
      let message = new StoreMessage(this.selectedObject.type, index, payload, this.token);
      this.sendMessage(message);
      // update clean copy so further edits compare correctly
      this.objectInfoClean[key] = value;
    }
    console.groupEnd();
  }


  private onSelectedObjectChange(object: BoIdentifier | null) {
    this.selectedObject = object;

    // Reset updating state and clear old object info
    this.schemaUpdating = false;
    this.objectUpdating = false;
    this.objectInfo = null;
    this.objectInfoCache = null;
    this.objectFields = [];

    // Fetch new object
    if(object?.id !== undefined) {
      this.fetchObject();
    }
    console.log("Type:")
    console.log(this.selectedType)
    if (object?.type != this.selectedType) {
      this.objectSchema = null;
      this.fetchSchema();
    }
    
    this.selectedType = object?.type || null;
  }



  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.subscription.unsubscribe();
  }
}
