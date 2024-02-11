import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HelloWorldComponent } from './HelloWorldComponent/HelloWorld/HelloWorld.component';
import { DirectMessageSenderComponent } from './direct-message-sender/direct-message-sender.component';
import { ConnectedComponent } from './ConnectedComponent/ConnectedComponent.component';
import { LoginComponent } from './login-component/login.component';

@NgModule({
  declarations: [	
    AppComponent,
    HelloWorldComponent,
    DirectMessageSenderComponent,
      ConnectedComponent,
      LoginComponent
   ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
