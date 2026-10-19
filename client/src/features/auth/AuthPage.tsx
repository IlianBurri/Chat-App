import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const DEMO_PASSWORD = 'Demo1234!';
const DEMO_USERS = [
  { key: 'anna', name: 'Anna Keller' },
  { key: 'ben', name: 'Ben Müller' },
  { key: 'clara', name: 'Clara Rossi' },
  { key: 'david', name: 'David Meier' },
  { key: 'elif', name: 'Elif Yılmaz' },
  { key: 'felix', name: 'Felix Schneider' },
];

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Only servers seeded with demo data have these accounts (always in development, opt-in in production).
  const [demoAvailable, setDemoAvailable] = useState(false);

  useEffect(() => {
    if (mode !== 'login') return;
    let active = true;
    api
      .get<{ available: boolean }>('/auth/demo')
      .then((r) => active && setDemoAvailable(r.available))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [mode]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'generic';
      setError(t(`auth.errors.${code}`, { defaultValue: t('auth.errors.generic') }));
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => (mode === 'login' ? login(email, password) : register(name, email, password)));
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-app p-4">
      <div className="w-full max-w-[400px] space-y-4">
        <div className="rounded-lg bg-main p-8 shadow-card">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <Logo size={40} />
            <p className="text-sm text-muted">{t('app.tagline')}</p>
          </div>
          <h1 className="mb-4 text-xl font-semibold">{mode === 'login' ? t('auth.signIn') : t('auth.signUp')}</h1>
          <form onSubmit={submit} className="space-y-3" noValidate={false}>
            {mode === 'register' && (
              <Field label={t('auth.name')} id="name" value={name} onChange={setName} autoComplete="name" minLength={2} />
            )}
            <Field label={t('auth.email')} id="email" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field
              label={t('auth.password')}
              id="password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
              hint={mode === 'register' ? t('auth.passwordHint') : undefined}
            />
            {error && (
              <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={busy} className="h-9 w-full">
              {mode === 'login' ? t('auth.signIn') : t('auth.signUp')}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted">
            {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
            <Link to={mode === 'login' ? '/register' : '/login'} className="font-semibold text-accent hover:underline">
              {mode === 'login' ? t('auth.signUp') : t('auth.signIn')}
            </Link>
          </p>
        </div>

        {mode === 'login' && demoAvailable && (
          <section aria-labelledby="demo-heading" className="rounded-lg bg-main p-4 shadow-card">
            <h2 id="demo-heading" className="text-sm font-semibold">
              {t('auth.demoAccounts')}
            </h2>
            <p className="mb-3 text-xs text-muted">{t('auth.demoPassword', { password: DEMO_PASSWORD })}</p>
            <ul className="grid grid-cols-2 gap-1.5">
              {DEMO_USERS.map((u) => (
                <li key={u.key}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={t('auth.useAccount', { name: u.name })}
                    onClick={() => void run(() => login(`${u.key}@example.com`, DEMO_PASSWORD))}
                    className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm hover:bg-hover"
                  >
                    <Avatar user={{ id: u.key, name: u.name, avatarUrl: null }} size="xs" />
                    <span className="truncate">{u.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  minLength?: number;
  hint?: string;
}

function Field({ label, id, value, onChange, type = 'text', autoComplete, minLength, hint }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={value}
        minLength={minLength}
        autoComplete={autoComplete}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-line bg-input px-3 text-sm outline-none focus:border-accent"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}
