import { useEffect, useState } from 'react';
import type { ChangelogEntry } from '../types';
import { getChangelog } from '../api';

export function ChangelogScreen({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getChangelog()
      .then((res) => setEntries(res.entries))
      .catch((err) => setError(err instanceof Error ? err.message : '載入失敗'));
  }, []);

  return (
    <div className="centered-screen">
      <div className="history-box changelog-box">
        <div className="changelog-header">
          <div className="count-title">更新日誌</div>
          <button onClick={onBack}>返回</button>
        </div>
        {error && <p className="error-text">{error}</p>}
        {!error && !entries && <p>載入中...</p>}
        {entries && entries.length === 0 && <p>尚無更新紀錄</p>}
        {entries && entries.length > 0 && (
          <div className="history-list">
            {entries.map((entry) => (
              <div key={entry.id} className="history-entry">
                <div className="changelog-entry-title">{entry.title}</div>
                <div className="changelog-entry-date">
                  {new Date(entry.created_at).toLocaleString('zh-TW')}
                </div>
                <div>{entry.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
