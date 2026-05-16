import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useAuth } from '../auth/AuthContext';

/**
 * Shape of the API envelope returned by the Laravel login endpoint when a
 * request fails. We only consume `message` and `errors` here — `success`
 * and `data` are present on every envelope but unused on the error path.
 */
interface ApiErrorEnvelope {
    success?: boolean;
    data?: unknown;
    message?: string;
    errors?: Record<string, string[]> | null;
}

/**
 * Login page.
 *
 * Posts `{ email, password }` to `POST /api/login` via `AuthContext.login()`,
 * which stores the bearer token and hydrates `currentUser` from `/api/me`.
 * On success we navigate to whatever route the user originally tried to
 * reach (passed through `<RequireAuth>` via `location.state.from`), or to
 * `/projects` as the default landing page (Requirement 10.2).
 *
 * On failure we render the envelope's `message` and any field-level
 * `errors` from the 422 response (Requirement 10.1, 9.5).
 */
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
            // The login call rejects with either an AxiosError carrying the
            // envelope, or a plain Error if the envelope was malformed. We
            // surface whichever message we can find and any field-level
            // validation errors the server returned.
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
        <div
            style={{
                maxWidth: 360,
                margin: '4rem auto',
                fontFamily: 'system-ui, sans-serif',
            }}
        >
            <h1>Sign in</h1>
            <form onSubmit={handleSubmit} noValidate>
                <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block' }}>
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="username"
                            disabled={submitting}
                            style={{ display: 'block', width: '100%' }}
                        />
                    </label>
                    {fieldErrors.email?.map((m) => (
                        <div key={m} role="alert" style={{ color: 'crimson' }}>
                            {m}
                        </div>
                    ))}
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block' }}>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            disabled={submitting}
                            style={{ display: 'block', width: '100%' }}
                        />
                    </label>
                    {fieldErrors.password?.map((m) => (
                        <div key={m} role="alert" style={{ color: 'crimson' }}>
                            {m}
                        </div>
                    ))}
                </div>
                {error && (
                    <div role="alert" style={{ color: 'crimson', marginTop: '0.5rem' }}>
                        {error}
                    </div>
                )}
                <button
                    type="submit"
                    disabled={submitting}
                    style={{ marginTop: '1rem' }}
                >
                    {submitting ? 'Signing in…' : 'Sign in'}
                </button>
            </form>
        </div>
    );
}

export default LoginPage;
