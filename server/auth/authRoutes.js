import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findByNickname, createUser } from '../db/usersRepo.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function issueToken(user) {
  return jwt.sign({ userId: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: '30d' });
}

router.post('/register', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    if (!nickname || !password || nickname.length < 2 || password.length < 4) {
      return res.status(400).json({ error: '暱稱至少2字，密碼至少4碼' });
    }
    const existing = await findByNickname(nickname);
    if (existing) return res.status(409).json({ error: '這個暱稱已經被使用' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser(nickname, passwordHash);
    const token = issueToken(user);
    res.json({ token, nickname: user.nickname, chipBalance: user.chip_balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '註冊失敗' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { nickname, password } = req.body;
    const user = await findByNickname(nickname);
    if (!user) return res.status(401).json({ error: '暱稱或密碼錯誤' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: '暱稱或密碼錯誤' });
    const token = issueToken(user);
    res.json({ token, nickname: user.nickname, chipBalance: user.chip_balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '登入失敗' });
  }
});

export default router;
export { JWT_SECRET };
