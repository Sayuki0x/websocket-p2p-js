
// Copyright (C) 2019 ExtraHash
//
// Please see the included LICENSE file for more information.

import yargs from 'yargs';
import DbWizard from './db';
import Node from './node';

export const wizard = new DbWizard();
wizard.getInitialPeers();

const argv = yargs
  .command(
    '--port',
    'Specifies the port to open the websocket server on. Optional, defaults to 7999.',
    {
      path: {
        description: 'the port to use for the server',
        type: 'number'
      }
    }
  )
  .help()
  .alias('help', 'h').argv;

const { port } = argv;
export const node = new Node(Number(port) || 7111);
