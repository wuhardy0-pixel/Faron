const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3005;

app.use(express.static(__dirname));
app.use('/1', express.static(path.join(__dirname, '1')));

// Room structure: { 
//   roomId: { 
//     players: { socketId: { x, y, dir, state, nickname } }, 
//     monsterStates: { monsterId: { hp, alive } },
//     isPrivate: bool, 
//     code: string 
//   } 
// }
const rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('getRooms', (callback) => {
        const roomData = Object.keys(rooms).map(id => ({
            id,
            playerCount: Object.keys(rooms[id].players).length,
            isPrivate: rooms[id].isPrivate
        }));
        callback(roomData);
    });

    socket.on('joinRoom', ({ roomId, nickname, isPrivate, code }, callback) => {
        // Room validation
        if (!rooms[roomId]) {
            if (code || !isPrivate) {
                rooms[roomId] = { players: {}, monsterStates: {}, isPrivate, code };
            } else {
                return callback({ success: false, message: 'Room does not exist' });
            }
        }

        const room = rooms[roomId];

        if (room.isPrivate && room.code !== code) {
            return callback({ success: false, message: 'Invalid room code' });
        }

        if (Object.keys(room.players).length >= 6) {
            return callback({ success: false, message: 'Room is full' });
        }

        // Join room
        socket.join(roomId);
        room.players[socket.id] = { id: socket.id, x: 0, y: 0, dir: 'down', state: 'idle', nickname };

        socket.roomId = roomId;
        console.log(`User ${nickname} (${socket.id}) joined room ${roomId}`);

        callback({ success: true, players: room.players, monsterStates: room.monsterStates });

        // Notify others
        socket.to(roomId).emit('playerJoined', room.players[socket.id]);
    });

    socket.on('monsterHit', ({ monsterId, damage }) => {
        if (!socket.roomId || !rooms[socket.roomId]) return;
        const room = rooms[socket.roomId];

        if (!room.monsterStates[monsterId]) {
            // Initializing on first hit is a bit risky if we don't know maxHp
            // but for simplicity we'll let the client lead the first time or 
            // assume it's initialization if damage is negative/specific
            room.monsterStates[monsterId] = { hp: 100, alive: true }; // Dummy init
        }

        const m = room.monsterStates[monsterId];
        if (!m.alive) return;

        m.hp -= damage;
        if (m.hp <= 0) {
            m.hp = 0;
            m.alive = false;
        }

        // Broadcast current state to everyone in room including sender (to keep it synced)
        io.to(socket.roomId).emit('monsterUpdate', { id: monsterId, hp: m.hp, alive: m.alive });
    });

    socket.on('monsterRespawn', ({ monsterId }) => {
        if (!socket.roomId || !rooms[socket.roomId]) return;
        const room = rooms[socket.roomId];
        if (room.monsterStates[monsterId]) {
            room.monsterStates[monsterId].alive = true;
            room.monsterStates[monsterId].hp = 100; // Reset
            socket.to(socket.roomId).emit('monsterRespawn', { id: monsterId });
        }
    });

    socket.on('updateState', (state) => {
        if (!socket.roomId || !rooms[socket.roomId]) return;

        const player = rooms[socket.roomId].players[socket.id];
        if (player) {
            Object.assign(player, state);
            socket.to(socket.roomId).emit('playerUpdate', player);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.roomId && rooms[socket.roomId]) {
            delete rooms[socket.roomId].players[socket.id];
            socket.to(socket.roomId).emit('playerLeft', socket.id);

            // Clean up empty rooms
            if (Object.keys(rooms[socket.roomId].players).length === 0) {
                delete rooms[socket.roomId];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
