import { FormEvent, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { laravelClient } from '../api/axiosClient';

/**
 * Member dropdown row. The `/api/users` endpoint already filters to users
 * with `role='user'` (admins are not assignable), so we only need the
 * fields the dropdown actually displays.
 */
interface Member {
    id: number;
    name: string;
    email: string;
}

/**
 * Standard envelope returned by both backends. Duplicated locally to keep
 * this component decoupled from any per-endpoint typings.
 */
interface Envelope<T> {
    success: boolean;
    data: T | null;
    message: string;
    errors: Record<string, string[]> | null;
}

interface Props {
    /** Project the new task will be created against. Comes from the route param. */
    projectId: number;
    /** Called after a successful create so the parent can re-fetch the project. */
    onCreated: () => void;
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
type Priority = typeof PRIORITIES[number];

/**
 * Admin-only form for creating a task on a given project. Renders the
 * member list as the assignee dropdown and posts to `POST /api/tasks` with
 * the project id from the route param. On success the form is cleared and
 * the parent is notified so it can re-fetch the project (Requirement 10.5).
 */
export function TaskCreationForm({ projectId, onCreated }: Props): JSX.Element {
    const [members, setMembers] = useState<Member[]>([]);
    const [loadingMembers, setLoadingMembers] = useState<boolean>(true);

    const [title, setTitle] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [priority, setPriority] = useState<Priority>('MEDIUM');
    const [dueDate, setDueDate] = useState<string>('');
    // Empty string represents "unassigned" — kept as string so the <select>
    // value binds cleanly; converted to a number when posting.
    const [assigneeId, setAssigneeId] = useState<string>('');

    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

    // Load members for the assignee dropdown on mount. The 401 path is
    // handled centrally by axiosClient, so a thrown error here just means
    // the dropdown stays empty (with `— Unassigned —` still selectable).
    useEffect(() => {
        let cancelled = false;
        laravelClient
            .get<Envelope<Member[]>>('/api/users')
            .then((r) => {
                if (!cancelled) setMembers(r.data?.data ?? []);
            })
            .catch(() => {
                if (!cancelled) setMembers([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingMembers(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setError(null);
        setFieldErrors({});
        setSubmitting(true);

        // Build the request body. Optional fields are only included when
        // they have a value so the API never receives `description: ""` or
        // `assignee_id: null` when the user simply left them blank.
        const body: Record<string, unknown> = {
            project_id: projectId,
            title: title.trim(),
            priority,
            due_date: dueDate,
        };
        if (description.trim()) body.description = description.trim();
        if (assigneeId) body.assignee_id = Number(assigneeId);

        try {
            await laravelClient.post('/api/tasks', body);
            // Reset form and notify parent so it re-fetches the project.
            setTitle('');
            setDescription('');
            setPriority('MEDIUM');
            setDueDate('');
            setAssigneeId('');
            onCreated();
        } catch (err) {
            const ax = err as AxiosError<Envelope<unknown>>;
            const env = ax.response?.data;
            // 422 carries field-level errors; other failures fall back to
            // the envelope's top-level message.
            setError(env?.message ?? 'Failed to create task.');
            setFieldErrors(env?.errors ?? {});
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div>
                <label>
                    Title
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        disabled={submitting}
                    />
                </label>
                {fieldErrors.title?.map((m) => (
                    <div key={m} role="alert">
                        {m}
                    </div>
                ))}
            </div>
            <div>
                <label>
                    Description
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={submitting}
                    />
                </label>
            </div>
            <div>
                <label>
                    Priority
                    <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as Priority)}
                        disabled={submitting}
                    >
                        {PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div>
                <label>
                    Due date
                    <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        required
                        disabled={submitting}
                    />
                </label>
                {fieldErrors.due_date?.map((m) => (
                    <div key={m} role="alert">
                        {m}
                    </div>
                ))}
            </div>
            <div>
                <label>
                    Assignee
                    <select
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                        disabled={submitting || loadingMembers}
                    >
                        <option value="">— Unassigned —</option>
                        {members.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.name} ({m.email})
                            </option>
                        ))}
                    </select>
                </label>
                {fieldErrors.assignee_id?.map((m) => (
                    <div key={m} role="alert">
                        {m}
                    </div>
                ))}
            </div>
            {error && (
                <div role="alert" style={{ color: 'crimson' }}>
                    {error}
                </div>
            )}
            <button type="submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create task'}
            </button>
        </form>
    );
}

export default TaskCreationForm;
