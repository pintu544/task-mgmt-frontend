import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { laravelClient } from '../api/axiosClient';
import { useAuth } from '../auth/AuthContext';

/**
 * Project list row as returned by `GET /api/projects`. The `tasks_count`
 * field is computed server-side via `withCount('tasks')` (see
 * `ProjectController@index`).
 */
interface Project {
    id: number;
    title: string;
    description: string | null;
    tasks_count: number;
}

/**
 * Common envelope shape returned by both backends. Duplicated locally
 * rather than imported so this page does not couple to other modules'
 * typings.
 */
interface Envelope<T> {
    success: boolean;
    data: T | null;
    message: string;
    errors: Record<string, string[]> | null;
}

/**
 * `/projects` route — lists every project visible to the current user.
 * Admins see all projects; members see only projects that contain a task
 * assigned to them (the filtering happens server-side per Requirement 2.6).
 *
 * Each row links to `/projects/:id`. The `tasks_count` is rendered next to
 * the title so users can see project size without drilling in.
 */
export function ProjectsPage(): JSX.Element {
    const { logout, currentUser } = useAuth();
    const [projects, setProjects] = useState<Project[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        laravelClient
            .get<Envelope<Project[]>>('/api/projects')
            .then((r) => {
                if (cancelled) return;
                setProjects(r.data?.data ?? []);
            })
            .catch((e) => {
                if (cancelled) return;
                // 401 is handled centrally by axiosClient (clears token,
                // redirects). Any other error surfaces here so the user
                // gets feedback instead of an empty screen.
                setError(e?.response?.data?.message ?? 'Failed to load projects.');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (error) return <div role="alert">{error}</div>;
    if (projects === null) return <div>Loading projects…</div>;

    return (
        <div style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Projects</h1>
                <div>
                    {currentUser && (
                        <span style={{ marginRight: '0.5rem' }}>
                            Signed in as {currentUser.name} ({currentUser.role}){' '}
                        </span>
                    )}
                    <button onClick={() => logout()}>Sign out</button>
                </div>
            </header>
            {projects.length === 0 ? (
                <p>No projects yet.</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {projects.map((p) => (
                        <li
                            key={p.id}
                            style={{ borderBottom: '1px solid #eee', padding: '0.5rem 0' }}
                        >
                            <Link to={`/projects/${p.id}`}>
                                <strong>{p.title}</strong>
                            </Link>
                            {' — '}
                            <span>
                                {p.tasks_count} task{p.tasks_count === 1 ? '' : 's'}
                            </span>
                            {p.description && (
                                <p style={{ color: '#666', margin: '0.25rem 0 0' }}>
                                    {p.description}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default ProjectsPage;
