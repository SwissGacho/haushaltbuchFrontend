import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HelloWorldComponent } from './HelloWorldComponent/HelloWorld/HelloWorld.component';
import { DirectMessageSenderComponent } from './direct-message-sender/direct-message-sender.component';

@NgModule({
  declarations: [
    AppComponent,
    HelloWorldComponent,
    DirectMessageSenderComponent,
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
