import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './authRoutes.js';

export function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('未登入'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.userId = payload.userId;
    socket.nickname = payload.nickname;
    next();
  } catch (err) {
    next(new Error('登入已過期，請重新登入'));
  }
}
