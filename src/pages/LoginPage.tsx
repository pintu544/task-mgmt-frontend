import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { ArrowRight, KeyRound, Mail, ShieldCheck, Workflow } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

interface ApiErrorEnvelope {
    success?: boolean;
    data?: unknown;
    message?: string;
    errors?: Record<string, string[]> | null;
}

export function LoginPage(): JSX.Element {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const fallback =
        (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
        '/projects';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

    async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setError(null);
        setFieldErrors({});
        setSubmitting(true);
        try {
            await login(email, password);
            navigate(fallback, { replace: true });
        } catch (err) {
            const ax = err as AxiosError<ApiErrorEnvelope>;
            const env = ax.response?.data;
            const message =
                env?.message ??
                (err instanceof Error ? err.message : null) ??
                'Login failed.';
            setError(message);
            setFieldErrors(env?.errors ?? {});
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-rail" aria-label="Application overview">
                <div className="brand-mark">
                    <Workflow size={28} aria-hidden="true" />
                </div>
                <div>
                    <p className="eyebrow">Task Management</p>
                    <h1>Projects, tasks, and overdue reviews in one workspace.</h1>
                    <p className="auth-copy">
                        Track assignment progress, keep due dates visible, and manage the
                        overdue workflow from the admin project view.
                    </p>
                </div>
                <div className="auth-stat-grid" aria-label="Assignment coverage">
                    <div>
                        <strong>Admin</strong>
                        <span>Projects and task controls</span>
                    </div>
                    <div>
                        <strong>User</strong>
                        <span>Assigned task updates</span>
                    </div>
                    <div>
                        <strong>Django</strong>
                        <span>Overdue rule handling</span>
                    </div>
                </div>
            </section>

            <section className="auth-card" aria-labelledby="login-heading">
                <div className="auth-card-header">
                    <div className="icon-chip">
                        <ShieldCheck size={20} aria-hidden="true" />
                    </div>
                    <div>
                        <p className="eyebrow">Secure access</p>
                        <h2 id="login-heading">Sign in</h2>
                    </div>
                </div>

                <form className="form-stack" onSubmit={handleSubmit} noValidate>
                    <div className="field">
                        <label className="field-label" htmlFor="email">
                            Email
                        </label>
                        <div className="input-wrap">
                            <Mail size={18} aria-hidden="true" />
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="username"
                                disabled={submitting}
                            />
                        </div>
                        {fieldErrors.email?.map((m) => (
                            <div className="field-error" key={m} role="alert">
                                {m}
                            </div>
                        ))}
                    </div>

                    <div className="field">
                        <label className="field-label" htmlFor="password">
                            Password
                        </label>
                        <div className="input-wrap">
                            <KeyRound size={18} aria-hidden="true" />
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                disabled={submitting}
                            />
                        </div>
                        {fieldErrors.password?.map((m) => (
                            <div className="field-error" key={m} role="alert">
                                {m}
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div className="alert alert-danger" role="alert">
                            {error}
                        </div>
                    )}

                    <button className="btn btn-primary btn-full" type="submit" disabled={submitting}>
                        <span>{submitting ? 'Signing in...' : 'Sign in'}</span>
                        <ArrowRight size={18} aria-hidden="true" />
                    </button>
                </form>
            </section>
        </main>
    );
}

export default LoginPage;
