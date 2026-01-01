//frontend\src\lib\wsServer.js 
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

console.log('正在监听 ws://localhost:8080 ...');

wss.on('connection', (ws) => {
    console.log('>>> 插件已连接！');

    ws.on('message', (message) => {
        console.log('收到 MIDI 数据:', message.toString());
    });

    ws.on('close', () => {
        console.log('<<< 插件断开连接');
    });
});
