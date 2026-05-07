import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaEnvelopeOpen } from 'react-icons/fa6';
import Button from '../components/ui/Button';
import ColorPicker from '../components/ui/ColorPicker';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';
import { MARKER_COLORS } from '../lib/constants';

export default function Register() {
  const navigate = useNavigate();
  const session = useUserStore((s) => s.session);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState(MARKER_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  useEffect(() => {
    if (session && !needsConfirmation) {
      navigate('/dashboard', { replace: true });
    }
  }, [session, needsConfirmation, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
          avatar_color: color,
        },
      },
    });
    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    // If Supabase email confirmation is enabled, no session is returned.
    // If disabled, we get a session immediately and useAuthSync will pick it up.
    if (!data.session) {
      setNeedsConfirmation(true);
      setSubmitting(false);
    }
  };

  if (needsConfirmation) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-4 sm:p-6">
        <div className="w-full max-w-sm space-y-3 rounded-xl bg-white p-6 shadow-lg text-center">
          <FaEnvelopeOpen className="mx-auto h-10 w-10 text-blue-600" aria-hidden />
          <h1 className="text-xl font-semibold">Check your email</h1>
          <p className="text-sm text-slate-600">
            We sent a confirmation link to <span className="font-medium">{email}</span>.
            Click it, then come back to sign in.
          </p>
          <Link
            to="/login"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-lg sm:p-6">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <FaArrowLeft className="h-3 w-3" aria-hidden />
            Back
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Create an account</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Marker color
            </label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">At least 6 characters.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
