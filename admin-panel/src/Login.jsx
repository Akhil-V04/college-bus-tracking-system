import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import api from './api';
import { useAuth } from './auth';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { role, identifier, password });
      login({ token: data.token, role: data.role });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('');
    try {
      const { data } = await api.post('/auth/google', {
        role: 'classAdvisor',
        idToken: credentialResponse.credential,
      });
      login({ token: data.token, role: data.role });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Google sign-in failed. Try again.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-slate-800">Bus Tracking Admin</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to the transport office panel</p>

        {error && (
          <div className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
          >
            <option value="admin">Admin</option>
            <option value="driver">Driver</option>
          </select>
          <input
            type="text"
            placeholder="Email (admin) or phone (driver)"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> OR <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="flex justify-center">
          {GOOGLE_CLIENT_ID ? (
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in failed. Try again.')}
              useOneTap={false}
            />
          ) : (
            <p className="text-sm text-slate-400">
              Google sign-in disabled (set VITE_GOOGLE_CLIENT_ID)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}