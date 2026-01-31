// @ts-nocheck
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

console.log('Listening on ws://localhost:8080 ...');

wss.on('connection', (ws) => {
    console.log('>>> Plugin Connected!');

    ws.on('message', (message) => {
        console.log('Received MIDI:', message.toString());
    });

    ws.on('close', () => {
        console.log('<<< Plugin Disconnected');
    });
});
