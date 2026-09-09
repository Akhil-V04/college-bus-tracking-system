import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from './api';
import { useAuth } from './auth';

export default function Login() {
  const { checking, isLoggedIn, login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!checking && isLoggedIn) navigate('/', { replace: true });
  }, [checking, isLoggedIn, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        role: 'admin',
        identifier: identifier.trim(),
        password,
      });
      login(data);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(errorMessage(requestError, 'Sign in failed.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-orb login-orb-one" />
      <div className="login-orb login-orb-two" />
      <main className="login-card">
        <div className="brand-mark" aria-hidden="true">CB</div>
        <p className="eyebrow">Transport operations</p>
        <h1>College Bus Control</h1>
        <p className="login-copy">
          Administrator access for routes, annual passenger rosters, schedules, drivers, and late-bus alerts.
        </p>
        {error && <div className="notice notice-error">{error}</div>}
        <form onSubmit={handleSubmit} className="stack-form">
          <label>
            <span>Administrator email</span>
            <input type="email" value={identifier} onChange={(event) => setIdentifier(event.target.value)}
              placeholder="admin@college.edu" autoComplete="username" autoFocus required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password" autoComplete="current-password" required />
          </label>
          <button type="submit" className="button button-primary button-wide" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in securely'}
          </button>
        </form>
        <p className="login-footnote">
          Passengers never sign in here. Driver access is handled in the driver application.
        </p>
      </main>
    </div>
  );
}
