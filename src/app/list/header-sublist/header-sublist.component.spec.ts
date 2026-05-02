import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { HeaderSublistComponent } from './header-sublist.component';
import { ConnectionService } from 'src/app/connection.service';
import { SelectedObjectService } from 'src/app/selected-object.service';

describe('HeaderSublistComponent', () => {
  let component: HeaderSublistComponent;
  let fixture: ComponentFixture<HeaderSublistComponent>;
  let selectedObjectService: Pick<SelectedObjectService, 'selectObject'>;

  beforeEach(async () => {
    const connectionServiceSpy = {
      getNewConnection: jest.fn(),
      sendMessage: jest.fn(),
      removeConnection: jest.fn()
    } as Partial<ConnectionService>;
    selectedObjectService = {
      selectObject: jest.fn()
    };

    await TestBed.configureTestingModule({
      declarations: [HeaderSublistComponent],
      providers: [
        { provide: ConnectionService, useValue: connectionServiceSpy },
        { provide: SelectedObjectService, useValue: selectedObjectService }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HeaderSublistComponent);
    component = fixture.componentInstance;
    component.header = 'Account';
    jest.clearAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('expands the clicked object on single click', fakeAsync(() => {
    component.onObjectClick(7);

    expect(component.expandedObject).toBeNull();

    tick(250);

    expect(component.expandedObject).toEqual(expect.objectContaining({ type: 'Account', id: 7 }));
    expect(selectedObjectService.selectObject).not.toHaveBeenCalled();
  }));

  it('selects the object on double click without expanding it', fakeAsync(() => {
    component.onObjectClick(7);
    component.onObjectDoubleClick(7);

    tick(250);

    expect(selectedObjectService.selectObject).toHaveBeenCalledTimes(1);
    expect(selectedObjectService.selectObject).toHaveBeenCalledWith(expect.objectContaining({ type: 'Account', id: 7 }));
    expect(component.expandedObject).toBeNull();
  }));

  it('fetches list with conditions for dotted headers and parent id', () => {
    component.header = 'Invoice.customer';
    component.parentObject = { type: 'Customer', id: 42 };
    (component as any).token = 'mock-token';

    const sendMessageSpy = jest.spyOn(component as any, 'sendMessage');

    component.fetchList();

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    const sentMessage = sendMessageSpy.mock.calls[0][0] as any;
    expect(sentMessage.object).toBe('Invoice');
    expect(sentMessage.conditions).toEqual({ customer: 42 });
  });

  it('uses object type part of dotted header for double click selection', () => {
    component.header = 'Invoice.customer';

    component.onObjectDoubleClick(7);

    expect(selectedObjectService.selectObject).toHaveBeenCalledTimes(1);
    expect(selectedObjectService.selectObject).toHaveBeenCalledWith(expect.objectContaining({ type: 'Invoice', id: 7 }));
  });

  it('creates a blank object on add-new click when no parent reference is available', () => {
    component.header = 'Invoice.customer';
    component.parentObject = null;

    component.onCreateNew();

    expect(selectedObjectService.selectObject).toHaveBeenCalledTimes(1);
    expect(selectedObjectService.selectObject).toHaveBeenCalledWith(expect.objectContaining({ type: 'Invoice', id: undefined, initialValues: undefined }));
  });

  it('prefills parent reference on add-new click', () => {
    component.header = 'Invoice.customer';
    component.parentObject = { type: 'Customer', id: 42, displayName: 'ACME Corp' };

    component.onCreateNew();

    expect(selectedObjectService.selectObject).toHaveBeenCalledTimes(1);
    expect(selectedObjectService.selectObject).toHaveBeenCalledWith(expect.objectContaining({
      type: 'Invoice',
      id: undefined,
      initialValues: {
        customer: {
          id: 42,
          display_name: 'ACME Corp',
          bo_type: 'Customer'
        }
      }
    }));
  });
});
