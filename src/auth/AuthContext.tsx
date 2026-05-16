import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    laravelClient,
    setStoredToken,
    clearStoredToken,
    getStoredToken,
} from '../api/axiosClient';

/**
 * Shape of the authenticated user. Sourced from `GET /api/me` (and from the
 * `data.user` field of `POST /api/login`). The `role` field is what the rest
 * of the UI keys off to gate admin-only views.
 */
export interface CurrentUser {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'user';
}

/**
 * Generic envelope shape returned by both the Laravel and Django services.
 * Duplicated locally (rather than imported) so this module remains
 * decoupled from any per-endpoint typings.
 */
interface Envelope<T> {
    success: boolean;
    data: T | null;
    message: string;
    errors: Record<string, string[]> | null;
}

/**
 * Public surface of the auth context. `isLoading` is true while the
 * initial `/api/me` hydration is in flight; consumers can use it to
 * suppress flashes of the login form when a stored token already exists.
 */
interface AuthState {
    currentUser: CurrentUser | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
    const [token, setToken] = useState<string | null>(() => getStoredToken());
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(!!getStoredToken());

    // On mount, if a token is already present in storage, hydrate the
    // current user from /api/me. The axios 401 interceptor will clear the
    // token and redirect to /login on its own if the token is invalid.
    useEffect(() => {
        let cancelled = false;
        if (!token) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        laravelClient
            .get<Envelope<{ user: CurrentUser }>>('/api/me')
            .then((r) => {
                if (cancelled) return;
                const user = r.data?.data?.user ?? null;
                setCurrentUser(user);
            })
            .catch(() => {
                // 401 is handled centrally by axiosClient (clears token,
                // redirects). For any other error we just leave currentUser
                // null so RequireAuth sends the user to /login.
                if (!cancelled) setCurrentUser(null);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // We intentionally only run this on mount — subsequent token
        // changes flow through `login()`/`logout()` which set state
        // directly, so we don't need to react to them here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const loginRes = await laravelClient.post<Envelope<{ user: CurrentUser; token: string }>>(
            '/api/login',
            { email, password },
        );
        const data = loginRes.data?.data;
        if (!data || !data.token) {
            throw new Error(loginRes.data?.message || 'Login failed.');
        }
        setStoredToken(data.token);
        setToken(data.token);
        // /api/login already returns the user, but the design specifies that
        // currentUser is sourced from /api/me — so we issue that call to
        // keep a single source of truth across login and refresh flows.
        try {
            const meRes = await laravelClient.get<Envelope<{ user: CurrentUser }>>('/api/me');
            const user = meRes.data?.data?.user ?? data.user;
            setCurrentUser(user);
        } catch {
            // Fall back to the user object returned by /api/login if /api/me
            // fails for a non-401 reason; the 401 path is handled by the
            // axios interceptor.
            setCurrentUser(data.user);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await laravelClient.post('/api/logout');
        } catch {
            // Ignore — the server-side token might already be invalid; we
            // still clear local state below so the UI returns to a logged
            // out state regardless.
        }
        clearStoredToken();
        setToken(null);
        setCurrentUser(null);
    }, []);

    const value = useMemo<AuthState>(
        () => ({
            currentUser,
            token,
            isLoading,
            isAuthenticated: !!currentUser && !!token,
            login,
            logout,
        }),
        [currentUser, token, isLoading, login, logout],
    );

    return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

/**
 * Hook for consuming the auth context. Throws if used outside an
 * `<AuthProvider>` so misuses fail loudly during development rather than
 * silently rendering with an undefined context.
 */
export function useAuth(): AuthState {
    const ctx = useContext(AuthCtx);
    if (ctx === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
}
