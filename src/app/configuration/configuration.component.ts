import { Component, OnInit } from '@angular/core';

export enum DBs { sqlite = 'SQLite', mariadb = 'MariaDB' }

export interface DBSsl {
  ssl_cert?: string;
  ssl_key?: string;
}

export interface DBConfig {
  db: DBs;
  file?: string;
  host?: string;
  port?: number;
  dbname?: string;
  dbuser?: string;
  ssl: DBSsl;
}

export class Configuration {
  app: { } = { };
  db_cfg: DBConfig = { db: DBs.sqlite, ssl: {} };
}

@Component({
    selector: 'app-configuration',
    templateUrl: './configuration.component.html',
    styleUrls: ['./configuration.component.css'],
    standalone: false
})
export class ConfigurationComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}

