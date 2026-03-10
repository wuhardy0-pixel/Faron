class MultiplayerManager {
    constructor() {
        this.socket = null;
        this.nickname = 'Player';
        this.roomId = '';
        this.players = {}; // Other players: { id: { x, y, dir, state, nickname } }
        this.available = typeof io !== 'undefined'; // false when opened as a plain HTML file
        this.onConnected = null;
        this.onRoomJoined = null;
        this.onError = null;
    }

    isAvailable() { return this.available; }

    connect(nickname, serverUrl = null) {
        if (!this.available) return;
        this.nickname = nickname;
        // If serverUrl is provided, connect to it; otherwise connect to the current host
        this.socket = serverUrl ? io(serverUrl) : io();

        this.socket.on('connect', () => {
            console.log('Connected to server');
            if (this.onConnected) this.onConnected();
        });

        this.socket.on('playerJoined', (player) => {
            this.players[player.id] = player;
        });

        this.socket.on('playerUpdate', (state) => {
            if (this.players[state.id]) Object.assign(this.players[state.id], state);
            else this.players[state.id] = state;
        });

        this.socket.on('playerLeft', (id) => {
            delete this.players[id];
        });

        this.socket.on('connect_error', (err) => {
            console.error('Connection error:', err);
            if (this.onError) this.onError('CONNECTION FAILED: ' + err.message);
        });

        this.socket.on('error', (err) => {
            console.error('Socket error:', err);
            if (this.onError) this.onError('SERVER ERROR: ' + err);
        });
    }

    joinRoom(roomId, isPrivate, code) {
        if (!this.available || !this.socket) return;
        this.socket.emit('joinRoom', { roomId, nickname: this.nickname, isPrivate, code }, (response) => {
            if (response.success) {
                this.roomId = roomId;
                this.players = {};
                for (const id in response.players) {
                    if (id !== this.socket.id) this.players[id] = response.players[id];
                }
                if (this.onRoomJoined) this.onRoomJoined(roomId);
            } else {
                if (this.onError) this.onError(response.message);
            }
        });
    }

    getPublicRooms(callback) {
        if (!this.available || !this.socket) return callback([]);
        this.socket.emit('getRooms', callback);
    }

    updateState(state) {
        if (!this.available || !this.socket || !this.roomId) return;
        this.socket.emit('updateState', state);
    }
}
