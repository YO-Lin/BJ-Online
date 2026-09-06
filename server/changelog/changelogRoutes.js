import express from 'express';
import { listEntries } from '../db/changelogRepo.js';

const router = express.Router();

router.get('/changelog', async (req, res) => {
  try {
    const entries = await listEntries();
    res.json({ entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '無法取得更新日誌' });
  }
});

export default router;
