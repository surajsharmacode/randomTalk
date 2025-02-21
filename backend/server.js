const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Update later
    methods: ['GET', 'POST'],
  },
});

let waitingUsers = [];
const userPreviousPeers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userInfo) => {
    const user = { id: socket.id, ...userInfo };
    console.log('User joining:', user);
    waitingUsers = waitingUsers.filter((u) => u.id !== socket.id);

    if (waitingUsers.length > 0) {
      const peer = waitingUsers[0];
      console.log('Pairing', socket.id, 'with', peer.id);
      socket.join(peer.id);
      io.to(peer.id).emit('paired', { id: socket.id, name: user.name, gender: user.gender });
      socket.emit('paired', { id: peer.id, name: peer.name, gender: peer.gender });
      userPreviousPeers.set(socket.id, [...(userPreviousPeers.get(socket.id) || []), peer.id]);
      userPreviousPeers.set(peer.id, [...(userPreviousPeers.get(peer.id) || []), socket.id]);
      waitingUsers.shift();
      console.log('Waiting users after pairing:', waitingUsers.length);
    } else {
      waitingUsers.push(user);
      socket.emit('waiting');
      console.log('User added to waiting:', waitingUsers.length);
    }
  });

  socket.on('signal', (data) => {
    console.log('Signal from', socket.id, 'to', data.to, 'type:', data.signal.type || 'candidate');
    io.to(data.to).emit('signal', { signal: data.signal, from: socket.id });
  });

  socket.on('message', (data) => {
    io.to(data.to).emit('message', { text: data.text, from: socket.id });
  });

  socket.on('next', () => {
    if (socket.rooms.size > 1) {
      const currentPeerId = Array.from(socket.rooms).find((room) => room !== socket.id);
      io.to(currentPeerId).emit('userDisconnected');
      socket.leave(currentPeerId);
      socket.emit('userDisconnected');
    }
    socket.emit('waiting');
  });

  socket.on('disconnect', () => {
    waitingUsers = waitingUsers.filter((u) => u.id !== socket.id);
    socket.broadcast.emit('userDisconnected');
    console.log('User disconnected:', socket.id);
    userPreviousPeers.delete(socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});