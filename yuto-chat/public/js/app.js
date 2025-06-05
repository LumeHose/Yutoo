import chatManager from './chat.js';

document.addEventListener('DOMContentLoaded', () => {
    chatManager.connectWebSocket();
});