import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(form.username, form.password);
    setIsSubmitting(false);

    if (!result.isValid) {
      setError(result.message);
      return;
    }

    navigate('/dashboard');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-pageBg px-4">
      <div className="w-full max-w-md rounded-2xl border border-borderMain bg-cardBg p-8 shadow-card">
        <div className="mb-3 flex items-center gap-3">
          <img src="/ashoka-emblem.svg" alt="Ashoka Emblem" className="h-10 w-auto object-contain" />
          <img src="/uttsav-logo.svg" alt="UTTSAV logo" className="h-12 w-auto object-contain" />
        </div>
        <h1 className="mt-2 text-2xl font-bold text-textMain">Department Portal Login</h1>
        <p className="mt-2 text-sm text-textSecondary">
          Sign in with your department username and password.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-textSecondary">Department Username</span>
            <input
              type="text"
              autoCapitalize="characters"
              value={form.username}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, username: event.target.value.toUpperCase() }))
              }
              className="mt-1 w-full rounded-xl border border-borderMain px-3 py-2 text-textMain outline-none ring-primary/30 focus:ring"
              placeholder="P-1001"
              required
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
              required
            />
          </label>

          {error ? <p className="text-sm font-semibold text-statusRed">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
