import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './auth/authRoutes.js';
import { attachSocketServer } from './socket/index.js';
import { sweepEmptyRooms } from './rooms/roomManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', 'client', 'dist');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', authRoutes);
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
attachSocketServer(io);

setInterval(sweepEmptyRooms, 30_000);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Blackjack server listening on port ${PORT}`);
});
