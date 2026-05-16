import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailsPage } from './pages/ProjectDetailsPage';

/**
 * Application root.
 *
 * Wires the router with all routes and the global providers required by
 * the rest of the app:
 *
 * - `<BrowserRouter>` provides the HTML5 history-based routing context
 *   (Requirement 10.1).
 * - `<AuthProvider>` exposes `currentUser`, `token`, `login`, and
 *   `logout` to every route. It must live inside the router so that
 *   `useNavigate` calls inside auth flows resolve correctly.
 * - `<RequireAuth>` gates `/projects` and `/projects/:id` so that
 *   unauthenticated visits are redirected to `/login` (Requirements
 *   10.3, 10.4).
 *
 * The unknown-route and root paths fall back to `/projects`, which in
 * turn redirects to `/login` for anonymous visitors via `<RequireAuth>`.
 */
export function App(): JSX.Element {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                        path="/projects"
                        element={
                            <RequireAuth>
                                <ProjectsPage />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/projects/:id"
                        element={
                            <RequireAuth>
                                <ProjectDetailsPage />
                            </RequireAuth>
                        }
                    />
                    <Route path="/" element={<Navigate to="/projects" replace />} />
                    <Route path="*" element={<Navigate to="/projects" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
