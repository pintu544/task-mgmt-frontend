import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, LogOut, SearchX, UserCircle } from 'lucide-react';
import { laravelClient } from '../api/axiosClient';
import { useAuth } from '../auth/AuthContext';

interface Project {
    id: number;
    title: string;
    description: string | null;
    tasks_count: number;
}

interface Envelope<T> {
    success: boolean;
    data: T | null;
    message: string;
    errors: Record<string, string[]> | null;
}

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
                setError(e?.response?.data?.message ?? 'Failed to load projects.');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const taskTotal = useMemo(
        () => projects?.reduce((sum, project) => sum + project.tasks_count, 0) ?? 0,
        [projects],
    );

    if (error) {
        return (
            <main className="app-shell">
                <div className="alert alert-danger app-alert" role="alert">
                    {error}
                </div>
            </main>
        );
    }

    if (projects === null) {
        return (
            <main className="app-shell">
                <div className="loading-panel">Loading projects...</div>
            </main>
        );
    }

    return (
        <main className="app-shell">
            <header className="topbar">
                <div className="topbar-title">
                    <div className="brand-mark brand-mark-small">
                        <FolderKanban size={22} aria-hidden="true" />
                    </div>
                    <div>
                        <p className="eyebrow">Workspace</p>
                        <h1>Projects</h1>
                    </div>
                </div>
                <div className="session-card">
                    <UserCircle size={22} aria-hidden="true" />
                    <div>
                        <span>{currentUser?.name ?? 'Signed in'}</span>
                        <strong>{currentUser?.role ?? 'user'}</strong>
                    </div>
                    <button className="btn btn-ghost" type="button" onClick={() => logout()}>
                        <LogOut size={17} aria-hidden="true" />
                        <span>Sign out</span>
                    </button>
                </div>
            </header>

            <section className="metric-grid" aria-label="Project summary">
                <div className="metric-card">
                    <span>Total projects</span>
                    <strong>{projects.length}</strong>
                </div>
                <div className="metric-card metric-card-accent">
                    <span>Visible tasks</span>
                    <strong>{taskTotal}</strong>
                </div>
                <div className="metric-card">
                    <span>Access level</span>
                    <strong>{currentUser?.role === 'admin' ? 'Admin' : 'Member'}</strong>
                </div>
            </section>

            {projects.length === 0 ? (
                <section className="empty-state">
                    <SearchX size={32} aria-hidden="true" />
                    <h2>No projects yet</h2>
                    <p>Projects will appear here after an admin creates them.</p>
                </section>
            ) : (
                <section className="project-grid" aria-label="Project list">
                    {projects.map((project) => (
                        <Link className="project-card" key={project.id} to={`/projects/${project.id}`}>
                            <div className="project-card-icon">
                                <FolderKanban size={22} aria-hidden="true" />
                            </div>
                            <div className="project-card-content">
                                <h2>{project.title}</h2>
                                {project.description && <p>{project.description}</p>}
                            </div>
                            <span className="pill pill-neutral">
                                {project.tasks_count} task{project.tasks_count === 1 ? '' : 's'}
                            </span>
                        </Link>
                    ))}
                </section>
            )}
        </main>
    );
}

export default ProjectsPage;
