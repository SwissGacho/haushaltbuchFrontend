import { Component, OnInit } from '@angular/core';
import { ConnectedComponent } from '../connected-component/connected.component';
import { ConnectionService } from '../connection.service';
import { Configuration, DBs, UserModes, } from "./configuration.component";
import { SetupMessage } from '../messages/admin.messages';

@Component({
  selector: 'app-setup-configuration',
  templateUrl: './setup-configuration.component.html',
  styleUrls: ['./setup-configuration.component.css']
})
export class SetupConfigurationComponent extends ConnectedComponent implements OnInit {

  constructor(protected override connectionService: ConnectionService) {
    super(connectionService);
    this.setComponentID('SetupConfigComponent');
  }

  configuration: Configuration = {
    app: { userMode: UserModes.single },
    dbConfig: {
      db: DBs.sqlite,
      file: 'money_pilot.sqlite.db'
    }
  };
  get dbOption(): DBs { return this.configuration.dbConfig.db; }
  set dbOption(v: DBs) {
    this.configuration.dbConfig.db = v;
    if (v === DBs.sqlite) {
      if ( ! this.configuration.dbConfig.file) {
        this.configuration.dbConfig.file = 'money_pilot.sqlite.db';
      }
      delete this.configuration.dbConfig.host;
      delete this.configuration.dbConfig.dbname;
      delete this.configuration.dbConfig.dbuser;
      delete this.configuration.dbConfig.password;
    }
    if (v === DBs.mariadb) { delete this.configuration.dbConfig.file; }
  }
  adminuser: string = '';
  adminpassword: string = '';

  dbuser: string = '';
  dbpassword: string = '';
  dbcfg_file_default: string = 'configuration.json';
  dbcfg_file: string = this.dbcfg_file_default;

  result: any;

  submitForm() {
    this.result = {configuration: this.configuration};
    if (this.configuration.app.userMode === UserModes.multi) {
      this.result.adminuser = {name: this.adminuser, password: this.adminpassword};
    }
    this.result.dbcfg_file = this.dbcfg_file
    console.log(this.result)
    const message = new SetupMessage(
      this.configuration,
      this.dbcfg_file,
      {name: this.adminuser, password: this.adminpassword}
    );
    console.groupCollapsed('SetupMessage');
    console.log(JSON.stringify(message));
    console.groupEnd();
    this.sendMessage(message);
  }
}
