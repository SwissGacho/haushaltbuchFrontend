import { Component, OnInit } from '@angular/core';
import { ConnectedComponent } from '../connected-component/connected.component';
import { ConnectionService } from '../connection.service';

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

  userMode: string = 'single';
  adminuser: string = '';
  adminpassword: string = '';

  selectedDBOption: string = 'SQLite';
  file: string = 'db_filename';
  host: string = 'localhost';
  db: string = '';
  dbuser: string = '';
  dbpassword: string = '';
  dbcfg_file_default: string = 'configuration.json';
  dbcfg_file: string = 'configuration.json';

  result: any;

  submitForm() {
    this.result = {user_mode: this.userMode};
    if (this.userMode === 'multi') {
      this.result.adminuser = {name: this.adminuser, password: this.adminpassword};
    }
    this.result.dbcfg_file = this.dbcfg_file
    this.result.db = this.selectedDBOption;
    if (this.selectedDBOption === 'SQLite') { 
      this.result.db_cfg = { file: this.file }
    } else if (this.selectedDBOption === 'MariaDB') {
      this.result.db_cfg = {
        host: this.host,
        db: this.db,
        dbuser: this.dbuser,
        password: this.dbpassword
      }
    }
  }
}
