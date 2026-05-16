import axios, { AxiosError, AxiosInstance } from 'axios';

/**
 * Storage key for the bearer token. Exported so tests can clear or seed the
 * value through localStorage without depending on the helpers below.
 */
export const TOKEN_KEY = 'task_mgmt_token';

/**
 * Read the stored bearer token. Returns `null` when no token is present or
 * when localStorage is unavailable (e.g. SSR, sandboxed iframes).
 */
export function getStoredToken(): string | null {
    try {
        if (typeof localStorage === 'undefined') {
            return null;
        }
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

/**
 * Persist a bearer token. Failures (private mode, quota exceeded) are
 * swallowed so callers do not need to wrap every login flow in try/catch.
 */
export function setStoredToken(token: string): void {
    try {
        if (typeof localStorage === 'undefined') {
            return;
        }
        localStorage.setItem(TOKEN_KEY, token);
    } catch {
        // ignore (private mode, quota exceeded, etc.)
    }
}

/**
 * Remove the stored bearer token. Failures are swallowed for the same
 * reasons as `setStoredToken`.
 */
export function clearStoredToken(): void {
    try {
        if (typeof localStorage === 'undefined') {
            return;
        }
        localStorage.removeItem(TOKEN_KEY);
    } catch {
        // ignore
    }
}

/**
 * Attach the standard request/response interceptor pair to an Axios
 * instance. The request interceptor injects the bearer token; the response
 * interceptor handles 401 by clearing the stored token and redirecting the
 * browser to `/login` (Requirement 10.6).
 */
function attachInterceptors(client: AxiosInstance): AxiosInstance {
    client.interceptors.request.use((config) => {
        const token = getStoredToken();
        if (token) {
            // axios v1 exposes `headers` as an AxiosHeaders instance; both
            // `set()` and direct property assignment are supported.
            if (config.headers && typeof (config.headers as { set?: unknown }).set === 'function') {
                (config.headers as { set: (name: string, value: string) => void }).set(
                    'Authorization',
                    `Bearer ${token}`,
                );
            } else {
                (config.headers as Record<string, string>) = {
                    ...((config.headers ?? {}) as Record<string, string>),
                    Authorization: `Bearer ${token}`,
                };
            }
        }
        return config;
    });

    client.interceptors.response.use(
        (response) => response,
        (error: AxiosError) => {
            if (error.response?.status === 401) {
                clearStoredToken();
                if (
                    typeof window !== 'undefined' &&
                    window.location &&
                    window.location.pathname !== '/login'
                ) {
                    window.location.assign('/login');
                }
            }
            return Promise.reject(error);
        },
    );

    return client;
}

/**
 * Axios instance bound to the Laravel API. Used for auth, projects, tasks,
 * and member status updates.
 */
export const laravelClient: AxiosInstance = attachInterceptors(
    axios.create({
        baseURL: import.meta.env.VITE_LARAVEL_API_URL,
        headers: { Accept: 'application/json' },
    }),
);

/**
 * Axios instance bound to the Django overdue service. Used for the overdue
 * sweep and overdue close endpoints.
 */
export const djangoClient: AxiosInstance = attachInterceptors(
    axios.create({
        baseURL: import.meta.env.VITE_DJANGO_API_URL,
        headers: { Accept: 'application/json' },
    }),
);

// Default export = laravelClient for convenience in callers that only need
// the primary API surface.
export default laravelClient;
