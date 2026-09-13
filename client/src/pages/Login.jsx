import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const result = await login(username, password);
    setSubmitting(false);
    if (result.success) {
      navigate('/', { replace: true });
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-soft px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-accent text-white">
            <Factory size={24} />
          </div>
          <h1 className="text-xl font-semibold text-ink">Plastic Material Manager</h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in to manage stock, clients and packing bills</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6">
          <div className="mb-4">
            <label className="label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="input"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rahul"
            />
          </div>
          <div className="mb-5">
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="mb-4 rounded-control bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Demo accounts: rahul / parth / admin — password: password123
        </p>
      </div>
    </div>
  );
}
