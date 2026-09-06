import 'dotenv/config';
import { addEntry } from './changelogRepo.js';
import { pool } from './pool.js';

const [title, description] = process.argv.slice(2);

if (!title || !description) {
  console.error('用法：node db/addChangelogEntry.js "標題" "說明文字"');
  process.exit(1);
}

addEntry(title, description)
  .then((entry) => {
    console.log('已寫入更新日誌：', entry);
    return pool.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
