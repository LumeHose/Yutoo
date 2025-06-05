import { showPage, addMessage, createSystemMessage } from './utils.js';

class ChatManager {
    constructor() {
        this.socket = null;
        this.currentStrangerId = null;
        this.isTyping = false;
        this.typingTimeout = null;
        this.searchTimer = null;
        this.searchTime = 0;
        this.setupEventListeners();
    }

    connectWebSocket() {
        // Use wss:// if deployed with HTTPS
        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const wsUrl = protocol + window.location.host + '/ws';
        
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('Connected to WebSocket server');
            this.updateOnlineCount();
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.socket.onclose = () => {
            console.log('Disconnected from WebSocket server');
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }

    handleMessage(data) {
        switch (data.type) {
            case 'online_count':
                document.getElementById('online-count').textContent = data.count;
                break;
            case 'active_chats':
                document.getElementById('active-chats').textContent = data.count;
                break;
            case 'matched':
                this.currentStrangerId = data.strangerId;
                clearInterval(this.searchTimer);
                showPage('chat-page');
                addMessage('You are now connected with a stranger', 'system');
                break;
            case 'message':
                addMessage(data.message, 'stranger');
                break;
            case 'typing':
                const typingIndicator = document.getElementById('typing-indicator');
                if (data.isTyping) {
                    typingIndicator.classList.add('active');
                } else {
                    typingIndicator.classList.remove('active');
                }
                break;
            case 'disconnected':
                addMessage('Stranger has disconnected', 'system');
                setTimeout(() => this.nextStranger(), 3000);
                break;
            case 'search_canceled':
                showPage('landing-page');
                clearInterval(this.searchTimer);
                break;
        }
    }

    setupEventListeners() {
        document.getElementById('start-chat').addEventListener('click', () => this.startChat());
        document.getElementById('cancel-search').addEventListener('click', () => this.cancelSearch());
        document.getElementById('next-stranger').addEventListener('click', () => this.nextStranger());
        document.getElementById('disconnect-btn').addEventListener('click', () => this.disconnect());
        document.getElementById('send-button').addEventListener('click', () => this.sendMessage());
        
        const messageInput = document.getElementById('message-input');
        messageInput.addEventListener('keypress', () => this.handleTyping());
        messageInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    startChat() {
        showPage('matching-page');
        this.socket.send(JSON.stringify({ type: 'find_stranger' }));
        
        this.searchTime = 0;
        document.getElementById('search-time').textContent = '0s';
        
        this.searchTimer = setInterval(() => {
            this.searchTime++;
            document.getElementById('search-time').textContent = `${this.searchTime}s`;
        }, 1000);
    }

    cancelSearch() {
        this.socket.send(JSON.stringify({ type: 'cancel_search' }));
    }

    nextStranger() {
        if (this.currentStrangerId) {
            this.socket.send(JSON.stringify({ 
                type: 'next_stranger',
                currentStrangerId: this.currentStrangerId
            }));
        }
        this.startChat();
    }

    disconnect() {
        if (this.currentStrangerId) {
            this.socket.send(JSON.stringify({ 
                type: 'disconnect',
                strangerId: this.currentStrangerId
            }));
        }
        this.currentStrangerId = null;
        showPage('landing-page');
    }

    sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        
        if (message && this.currentStrangerId) {
            this.socket.send(JSON.stringify({
                type: 'message',
                strangerId: this.currentStrangerId,
                message: message
            }));
            addMessage(message, 'you');
            messageInput.value = '';
            this.stopTyping();
        }
    }

    handleTyping() {
        if (!this.isTyping && this.currentStrangerId) {
            this.isTyping = true;
            this.socket.send(JSON.stringify({
                type: 'typing',
                strangerId: this.currentStrangerId,
                isTyping: true
            }));
        }
        
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.stopTyping(), 2000);
    }

    stopTyping() {
        if (this.isTyping && this.currentStrangerId) {
            this.isTyping = false;
            this.socket.send(JSON.stringify({
                type: 'typing',
                strangerId: this.currentStrangerId,
                isTyping: false
            }));
        }
    }

    updateOnlineCount() {
        this.socket.send(JSON.stringify({ type: 'get_online_count' }));
    }
}

const chatManager = new ChatManager();
export default chatManager;