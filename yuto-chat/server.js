const WebSocket = require('ws');
const http = require('http');
const Matchmaker = require('./matchmaker');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Yuto Chat Server\n');
});

const wss = new WebSocket.Server({ server });
const matchmaker = new Matchmaker();

// Broadcast online count to all clients
function broadcastOnlineCount() {
    const count = matchmaker.getOnlineCount();
    const activeChats = matchmaker.getActiveChatsCount();
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'online_count',
                count: count
            }));
            client.send(JSON.stringify({
                type: 'active_chats',
                count: activeChats
            }));
        }
    });
}

wss.on('connection', (ws) => {
    console.log('New client connected');
    const clientId = matchmaker.addClient(ws);
    
    // Send initial counts
    ws.send(JSON.stringify({
        type: 'online_count',
        count: matchmaker.getOnlineCount()
    }));
    ws.send(JSON.stringify({
        type: 'active_chats',
        count: matchmaker.getActiveChatsCount()
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            matchmaker.handleMessage(clientId, data);
            broadcastOnlineCount();
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
        matchmaker.removeClient(clientId);
        broadcastOnlineCount();
    });
});

// Update counts every 10 seconds
setInterval(broadcastOnlineCount, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});