class Matchmaker {
    constructor() {
        this.clients = new Map(); // clientId -> { ws, searching, strangerId }
        this.searchQueue = [];
        this.clientCounter = 0;
    }

    addClient(ws) {
        const clientId = `client_${++this.clientCounter}`;
        this.clients.set(clientId, {
            ws,
            searching: false,
            strangerId: null
        });
        return clientId;
    }

    removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Notify stranger if connected
        if (client.strangerId) {
            const stranger = this.clients.get(client.strangerId);
            if (stranger) {
                stranger.strangerId = null;
                this.sendMessage(stranger.ws, {
                    type: 'disconnected'
                });
                
                if (stranger.searching) {
                    this.findStranger(stranger.clientId);
                }
            }
        }

        // Remove from queue if searching
        if (client.searching) {
            this.searchQueue = this.searchQueue.filter(id => id !== clientId);
        }

        this.clients.delete(clientId);
    }

    findStranger(clientId) {
        const client = this.clients.get(clientId);
        if (!client || client.searching) return;

        client.searching = true;

        // Try to find a match
        if (this.searchQueue.length > 0) {
            const strangerId = this.searchQueue.shift();
            const stranger = this.clients.get(strangerId);
            
            if (stranger && stranger.searching) {
                // Match found
                client.searching = false;
                client.strangerId = strangerId;
                stranger.searching = false;
                stranger.strangerId = clientId;
                
                // Notify both clients
                this.sendMessage(client.ws, {
                    type: 'matched',
                    strangerId: strangerId
                });
                
                this.sendMessage(stranger.ws, {
                    type: 'matched',
                    strangerId: clientId
                });
                
                return;
            }
        }

        // No match found, add to queue
        this.searchQueue.push(clientId);
    }

    cancelSearch(clientId) {
        const client = this.clients.get(clientId);
        if (!client || !client.searching) return;

        client.searching = false;
        this.searchQueue = this.searchQueue.filter(id => id !== clientId);
        this.sendMessage(client.ws, {
            type: 'search_canceled'
        });
    }

    nextStranger(clientId, currentStrangerId) {
        this.disconnect(clientId, currentStrangerId);
        this.findStranger(clientId);
    }

    disconnect(clientId, strangerId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        if (client.strangerId === strangerId) {
            client.strangerId = null;
        }
    }

    sendMessage(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    handleMessage(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        switch (data.type) {
            case 'find_stranger':
                this.findStranger(clientId);
                break;
                
            case 'cancel_search':
                this.cancelSearch(clientId);
                break;
                
            case 'next_stranger':
                this.nextStranger(clientId, data.currentStrangerId);
                break;
                
            case 'disconnect':
                this.disconnect(clientId, data.strangerId);
                break;
                
            case 'message':
                if (client.strangerId) {
                    const stranger = this.clients.get(client.strangerId);
                    if (stranger) {
                        this.sendMessage(stranger.ws, {
                            type: 'message',
                            message: data.message
                        });
                    }
                }
                break;
                
            case 'typing':
                if (client.strangerId) {
                    const stranger = this.clients.get(client.strangerId);
                    if (stranger) {
                        this.sendMessage(stranger.ws, {
                            type: 'typing',
                            isTyping: data.isTyping
                        });
                    }
                }
                break;
        }
    }

    getOnlineCount() {
        return this.clients.size;
    }

    getActiveChatsCount() {
        let count = 0;
        this.clients.forEach(client => {
            if (client.strangerId) count++;
        });
        return Math.floor(count / 2); // Each chat involves 2 clients
    }
}

module.exports = Matchmaker;