import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = login(form.username, form.password);

    if (!result.isValid) {
      setError(result.message);
      return;
    }

    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-pageBg px-4">
      <div className="w-full max-w-md rounded-2xl border border-borderMain bg-cardBg p-8 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">UTTSAV</p>
        <h1 className="mt-2 text-2xl font-bold text-textMain">Department Portal Login</h1>
        <p className="mt-2 text-sm text-textSecondary">Use your department prefix in username: `P-`, `FB-`, `T-`, `M-`, `A-`.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-textSecondary">Username</span>
            <input
              type="text"
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-borderMain px-3 py-2 text-textMain outline-none ring-primary/30 focus:ring"
              placeholder="P-101"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-textSecondary">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-borderMain px-3 py-2 text-textMain outline-none ring-primary/30 focus:ring"
              placeholder="Enter password"
            />
          </label>

          {error ? <p className="text-sm font-semibold text-statusRed">{error}</p> : null}

          <button type="submit" className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
