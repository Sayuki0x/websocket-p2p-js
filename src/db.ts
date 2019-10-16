
// Copyright (C) 2019 ExtraHash
//
// Please see the included LICENSE file for more information.

import sqlite3 from 'sqlite3';
import chalk from 'chalk';
import { node } from './index';
import { sleep } from './utils';

export default class DbWizard {
  public db = new sqlite3.Database('p2p.db', (err: any) => {
    if (err) {
      console.log(chalk.red.bold(`Database Error: ${err.message}`));
    } else {
      console.log('Successfully connected to database.');
    }
  });

  constructor() {
    this.createSchema();
  }

  private createSchema = () => {
    this.db.run(
      'CREATE TABLE IF NOT EXISTS peers ( connectionstring text, CONSTRAINT unique_connectionstring UNIQUE (connectionstring) )'
    );
  };

  public insertData = (table: string, column: string, value: any) => {
    const sqlQuery = `INSERT INTO ${table} (${column}) VALUES (?)`;

    this.db.run(sqlQuery, [value], async function(err: any) {
      if (err) {
        if (err.errno !== 19) {
          console.log(chalk.red.bold(err.message));
        }
      }
    });
  };

  public async getInitialPeers() {
    const sqlQuery = 'SELECT * FROM peers';

    this.db.all(sqlQuery, (err, rows) => {
      if (err) {
        console.log(chalk.red.bold(err.message));
      } else {
        rows.forEach(row => {
          node.addToPeerList(row.connectionstring);
        });
        node.connectToPeers();
      }
    });
  }
}
