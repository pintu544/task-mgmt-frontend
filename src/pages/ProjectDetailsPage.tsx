import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowLeft,
    CalendarClock,
    CheckCircle2,
    ClipboardList,
    RefreshCw,
    UserRound,
} from 'lucide-react';
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

function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
}

function statusBadgeClass(status: TaskStatus): string {
    return `pill status-${status.toLowerCase()}`;
}

function priorityBadgeClass(priority: Task['priority']): string {
    return `pill priority-${priority.toLowerCase()}`;
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

    const statusCounts = useMemo(() => {
        const counts: Record<TaskStatus, number> = {
            TODO: 0,
            IN_PROGRESS: 0,
            DONE: 0,
            OVERDUE: 0,
        };
        project?.tasks.forEach((task) => {
            counts[task.status] += 1;
        });
        return counts;
    }, [project]);

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

    if (error) {
        return (
            <main className="app-shell">
                <div className="alert alert-danger app-alert" role="alert">
                    {error}
                    <Link className="inline-link" to="/projects">
                        Back to projects
                    </Link>
                </div>
            </main>
        );
    }

    if (project === null) {
        return (
            <main className="app-shell">
                <div className="loading-panel">Loading project...</div>
            </main>
        );
    }

    return (
        <main className="app-shell detail-shell">
            <Link className="back-link" to="/projects">
                <ArrowLeft size={17} aria-hidden="true" />
                <span>All projects</span>
            </Link>

            <section className="detail-hero">
                <div>
                    <p className="eyebrow">Project details</p>
                    <h1>{project.title}</h1>
                    {project.description && <p>{project.description}</p>}
                </div>
                {isAdmin && (
                    <button className="btn btn-primary" type="button" onClick={runOverdueSweep} disabled={sweeping}>
                        <RefreshCw className={sweeping ? 'icon-spin' : ''} size={17} aria-hidden="true" />
                        <span>{sweeping ? 'Checking...' : 'Check overdue'}</span>
                    </button>
                )}
            </section>

            <section className="metric-grid" aria-label="Task summary">
                <div className="metric-card">
                    <span>Total tasks</span>
                    <strong>{project.tasks.length}</strong>
                </div>
                <div className="metric-card metric-card-accent">
                    <span>In progress</span>
                    <strong>{statusCounts.IN_PROGRESS}</strong>
                </div>
                <div className="metric-card metric-card-warning">
                    <span>Overdue</span>
                    <strong>{statusCounts.OVERDUE}</strong>
                </div>
                <div className="metric-card">
                    <span>Done</span>
                    <strong>{statusCounts.DONE}</strong>
                </div>
            </section>

            {actionError && (
                <div className="alert alert-danger" role="alert">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <span>{actionError}</span>
                </div>
            )}

            <div className={isAdmin ? 'detail-content detail-content-with-form' : 'detail-content'}>
                <section className="panel task-board-panel">
                    <div className="panel-header">
                        <div>
                            <p className="eyebrow">Task board</p>
                            <h2>Tasks</h2>
                        </div>
                    </div>

                    {project.tasks.length === 0 ? (
                        <div className="empty-state compact-empty">
                            <ClipboardList size={30} aria-hidden="true" />
                            <h3>No tasks for this project</h3>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table className="task-table">
                                <thead>
                                    <tr>
                                        <th>Task</th>
                                        <th>Status</th>
                                        <th>Priority</th>
                                        <th>Due date</th>
                                        <th>Assignee</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {project.tasks.map((task) => (
                                        <tr key={task.id}>
                                            <td>
                                                <div className="task-title-cell">
                                                    <strong>{task.title}</strong>
                                                    {task.description && <span>{task.description}</span>}
                                                </div>
                                            </td>
                                            <td>
                                                {task.status === 'OVERDUE' ? (
                                                    <span className={statusBadgeClass(task.status)}>
                                                        <AlertTriangle size={14} aria-hidden="true" />
                                                        {task.status}
                                                    </span>
                                                ) : (
                                                    <select
                                                        className="status-select"
                                                        aria-label={`Status for ${task.title}`}
                                                        value={task.status}
                                                        disabled={task.status === 'DONE' || busyTaskId === task.id}
                                                        onChange={(e) =>
                                                            updateTaskStatus(
                                                                task,
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
                                            <td>
                                                <span className={priorityBadgeClass(task.priority)}>{task.priority}</span>
                                            </td>
                                            <td>
                                                <span className="icon-text">
                                                    <CalendarClock size={15} aria-hidden="true" />
                                                    {formatDate(task.due_date)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="icon-text">
                                                    <UserRound size={15} aria-hidden="true" />
                                                    {task.assignee ? task.assignee.name : 'Unassigned'}
                                                </span>
                                            </td>
                                            <td>
                                                {task.status === 'OVERDUE' && isAdmin ? (
                                                    <button
                                                        className="btn btn-danger btn-small"
                                                        type="button"
                                                        onClick={() => closeOverdueTask(task)}
                                                        disabled={busyTaskId === task.id}
                                                    >
                                                        <CheckCircle2 size={15} aria-hidden="true" />
                                                        <span>{busyTaskId === task.id ? 'Closing...' : 'Close'}</span>
                                                    </button>
                                                ) : task.status === 'OVERDUE' ? (
                                                    <span className="muted">Admin only</span>
                                                ) : (
                                                    <span className="muted">No action</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {isAdmin && (
                    <aside className="panel create-task-panel">
                        <div className="panel-header">
                            <div>
                                <p className="eyebrow">Admin action</p>
                                <h2>Create task</h2>
                            </div>
                        </div>
                        <TaskCreationForm projectId={project.id} onCreated={fetchProject} />
                    </aside>
                )}
            </div>
        </main>
    );
}

export default ProjectDetailsPage;
