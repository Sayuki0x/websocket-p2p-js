
// Copyright (C) 2019 ExtraHash
//
// Please see the included LICENSE file for more information.

import WebSocket from 'ws';
import chalk from 'chalk';
import seedNodes from './config/seednodes';
import { wizard } from './index';
import { search } from './utils';

export default class Node {
  private peerList: string[] = [...seedNodes];
  private activeInConnections: any[] = [];
  private activeOutConnections: any[] = [];
  private server: WebSocket.Server;
  private port: number;

  constructor(port: number) {
    this.port = port;
    this.server = new WebSocket.Server({ port: this.port });
    console.log(`P2P initialized on port ${port}`);
    this.initListeners();
    this.connectToPeers();
  }

  public connectToPeers() {
    this.peerList.forEach(peer => {
      this.connectToPeer(peer);
    });
  }

  private connectToPeer(peer: string) {
    // check if the peer already has an out connection
    const results = search(peer, this.activeOutConnections, 'peer');

    if (!results) {
      console.log(
        `Attempting new outgoing connection ${chalk.yellow.bold(peer)}`
      );
      let connection = new WebSocket(`ws://${peer}`);
      this.activeOutConnections.push({ peer, connection });
      connection.onerror = (event: any) => {
        console.log(
          chalk.red.bold(`Connection Error: Failed to connect to ${peer}`)
        );

        this.removeOutConnection(peer);
      };
      connection.onopen = (event: any) => {
        console.log(chalk.green.bold(`Successfully connected to ${peer}`));

        connection.on('message', (message: string) => {
          if (message.includes('PEERLIST|')) {
            message = message.replace('PEERLIST|', '');
            this.receivePeerList(message);
          }
        });
        connection.send(`PEERLIST|${JSON.stringify(this.peerList)}`);
        connection.send('PEERLIST?');
        connection.send(`PORT|${this.port}`);
      };
    }
  }

  private initListeners() {
    this.server.on('connection', this.handleNewConnection.bind(this));
  }

  private handleNewConnection(connection: any, req: any) {
    //prettier-ignore
    const { connection: { remoteAddress } } = req;
    console.log(chalk.green.bold(`New incoming connection ${remoteAddress}`));

    connection.send(`PEERLIST|${JSON.stringify(this.peerList)}`);
    connection.send(`PORT|${this.port}`);

    // check if the peer already has an active inbound connection
    const results = search(remoteAddress, this.activeInConnections, 'peer');
    if (!results) {
      this.activeInConnections.push({ peer: remoteAddress, connection });
    }

    connection.on('message', (event: string) =>
      this.parseMessage(event, connection, req)
    );
  }

  private sendPeerList(
    message: string,
    connection: any,
    remoteAddress: string
  ) {
    const peerListOut = `PEERLIST|${JSON.stringify(this.peerList)}`;
    connection.send(peerListOut);
  }

  private receivePeerList(peerList: string) {
    const newPeers = JSON.parse(peerList);
    newPeers.forEach((peer: string) => {
      if (!this.peerList.includes(peer)) {
        wizard.insertData('peers', 'connectionstring', peer);
        console.log(`New peer found: ${peer}`);
        this.peerList.push(peer);
        this.connectToPeers();
      }
    });
  }

  private removeOutConnection(connectionString: string) {
    const results = search(connectionString, this.activeOutConnections, 'peer');
    const index = this.activeOutConnections.indexOf(results);
    this.activeOutConnections.splice(index, 1);
  }

  public addToPeerList(connectionString: string) {
    // if it communicates its port, add it to the peerlist
    const newPeer = connectionString;
    if (!this.peerList.includes(newPeer)) {
      wizard.insertData('peers', 'connectionstring', newPeer);
      this.peerList.push(newPeer);
    }
  }

  private parseMessage(event: string, connection: any, req: any) {
    //prettier-ignore
    const { connection: { remoteAddress } } = req;
    let message = event;

    // other node is asking for the peerlist, send it
    if (message.includes('PEERLIST?')) {
      message = message.replace('PEERLIST?', '');
      this.sendPeerList(message, connection, remoteAddress);
    }

    // parsing a received peerlist
    if (message.includes('PEERLIST|')) {
      message = message.replace('PEERLIST|', '');
      this.receivePeerList(message);
    }

    // other node is notifying us of their port
    if (message.includes('PORT|')) {
      message = message.replace('PORT|', '');
      if (!this.peerList.includes(`[${remoteAddress}]:${message}`)) {
        const connectionString = `[${remoteAddress}]:${message}`;
        this.addToPeerList(connectionString);
        this.connectToPeers();
      }
    }
  }
}
