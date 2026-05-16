import { useCallback, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { djangoClient, laravelClient } from '../api/axiosClient';
import { useAuth } from '../auth/AuthContext';
import { TaskCreationForm } from './TaskCreationForm';

interface Assignee {
    id: number;
    name: string;
    email: string;
}

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'OVERDUE';

interface Task {
    id: number;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    due_date: string;
    project_id: number;
    assignee_id: number | null;
    assignee?: Assignee | null;
    created_at?: string;
    updated_at?: string;
    overdue_transitioned_at?: string | null;
}

interface Project {
    id: number;
    title: string;
    description: string | null;
    tasks: Task[];
}

interface Envelope<T> {
    success: boolean;
    data: T | null;
    message: string;
    errors: Record<string, string[]> | null;
}

const EDITABLE_STATUSES: Exclude<TaskStatus, 'OVERDUE'>[] = ['TODO', 'IN_PROGRESS', 'DONE'];

function getErrorMessage(error: unknown, fallback: string): string {
    const axiosError = error as AxiosError<Envelope<unknown>>;
    return axiosError.response?.data?.message ?? (error instanceof Error ? error.message : fallback);
}

export function ProjectDetailsPage(): JSX.Element {
    const { id } = useParams<{ id: string }>();
    const { currentUser } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
    const [sweeping, setSweeping] = useState<boolean>(false);

    const projectId = Number(id);
    const isAdmin = currentUser?.role === 'admin';

    const fetchProject = useCallback(() => {
        if (!Number.isFinite(projectId)) {
            setError('Invalid project id.');
            return;
        }
        setError(null);
        laravelClient
            .get<Envelope<Project>>(`/api/projects/${projectId}`)
            .then((r) => setProject(r.data?.data ?? null))
            .catch((e) => setError(e?.response?.data?.message ?? 'Failed to load project.'));
    }, [projectId]);

    async function updateTaskStatus(task: Task, status: Exclude<TaskStatus, 'OVERDUE'>): Promise<void> {
        if (task.status === status) {
            return;
        }

        setActionError(null);
        setBusyTaskId(task.id);
        try {
            await laravelClient.patch(`/api/tasks/${task.id}/status`, { status });
            fetchProject();
        } catch (err) {
            setActionError(getErrorMessage(err, 'Failed to update task status.'));
        } finally {
            setBusyTaskId(null);
        }
    }

    async function closeOverdueTask(task: Task): Promise<void> {
        setActionError(null);
        setBusyTaskId(task.id);
        try {
            await djangoClient.post(`/api/overdue/${task.id}/close`);
            fetchProject();
        } catch (err) {
            setActionError(getErrorMessage(err, 'Failed to close overdue task.'));
        } finally {
            setBusyTaskId(null);
        }
    }

    async function runOverdueSweep(): Promise<void> {
        setActionError(null);
        setSweeping(true);
        try {
            await djangoClient.post('/api/overdue/sweep');
            fetchProject();
        } catch (err) {
            setActionError(getErrorMessage(err, 'Failed to run overdue sweep.'));
        } finally {
            setSweeping(false);
        }
    }

    useEffect(() => {
        fetchProject();
    }, [fetchProject]);

    if (error) return <div role="alert">{error} <Link to="/projects">Back</Link></div>;
    if (project === null) return <div>Loading project…</div>;

    return (
        <div style={{ maxWidth: 920, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
            <Link to="/projects">← All projects</Link>
            <h1>{project.title}</h1>
            {project.description && <p style={{ color: '#666' }}>{project.description}</p>}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <h2>Tasks</h2>
                {isAdmin && (
                    <button type="button" onClick={runOverdueSweep} disabled={sweeping}>
                        {sweeping ? 'Checking…' : 'Check overdue'}
                    </button>
                )}
            </div>
            {actionError && (
                <div role="alert" style={{ color: 'crimson', marginBottom: '0.75rem' }}>
                    {actionError}
                </div>
            )}
            {project.tasks.length === 0 ? (
                <p>No tasks for this project.</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                            <th>Title</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Due date</th>
                            <th>Assignee</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {project.tasks.map((t) => (
                            <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td>{t.title}</td>
                                <td>
                                    {t.status === 'OVERDUE' ? (
                                        <strong>{t.status}</strong>
                                    ) : (
                                        <select
                                            aria-label={`Status for ${t.title}`}
                                            value={t.status}
                                            disabled={t.status === 'DONE' || busyTaskId === t.id}
                                            onChange={(e) =>
                                                updateTaskStatus(
                                                    t,
                                                    e.target.value as Exclude<TaskStatus, 'OVERDUE'>,
                                                )
                                            }
                                        >
                                            {EDITABLE_STATUSES.map((status) => (
                                                <option key={status} value={status}>
                                                    {status}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </td>
                                <td>{t.priority}</td>
                                <td>{t.due_date}</td>
                                <td>{t.assignee ? t.assignee.name : '—'}</td>
                                <td>
                                    {t.status === 'OVERDUE' && isAdmin ? (
                                        <button
                                            type="button"
                                            onClick={() => closeOverdueTask(t)}
                                            disabled={busyTaskId === t.id}
                                        >
                                            {busyTaskId === t.id ? 'Closing…' : 'Close'}
                                        </button>
                                    ) : t.status === 'OVERDUE' ? (
                                        'Admin required'
                                    ) : (
                                        '—'
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {isAdmin && (
                <section style={{ marginTop: '2rem' }}>
                    <h2>Create task</h2>
                    <TaskCreationForm projectId={project.id} onCreated={fetchProject} />
                </section>
            )}
        </div>
    );
}

export default ProjectDetailsPage;
