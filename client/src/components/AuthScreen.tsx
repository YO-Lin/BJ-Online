import { useState } from 'react';
import { login, register, type AuthResponse } from '../api';

export function AuthScreen({ onAuthed }: { onAuthed: (auth: AuthResponse) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [startingChipsInput, setStartingChipsInput] = useState('1000');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === 'login'
          ? await login(nickname.trim(), password)
          : await register(nickname.trim(), password, Number(startingChipsInput) || undefined);
      onAuthed(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '發生錯誤');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centered-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>21點 練習桌</h1>
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>登入</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>註冊</button>
        </div>
        <label>
          暱稱
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} required minLength={2} />
        </label>
        <label>
          密碼
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={4} />
        </label>
        {mode === 'register' && (
          <label>
            起始籌碼
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={startingChipsInput}
              onChange={(e) => setStartingChipsInput(e.target.value.replace(/[^0-9]/g, ''))}
            />
          </label>
        )}
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="primary" disabled={busy}>
          {mode === 'login' ? '登入' : '註冊並登入'}
        </button>
      </form>
    </div>
  );
}
