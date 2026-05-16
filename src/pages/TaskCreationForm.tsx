import { FormEvent, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { CalendarDays, FileText, Loader2, Plus, UserRound } from 'lucide-react';
import { laravelClient } from '../api/axiosClient';

interface Member {
    id: number;
    name: string;
    email: string;
}

interface Envelope<T> {
    success: boolean;
    data: T | null;
    message: string;
    errors: Record<string, string[]> | null;
}

interface Props {
    projectId: number;
    onCreated: () => void;
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
type Priority = typeof PRIORITIES[number];

export function TaskCreationForm({ projectId, onCreated }: Props): JSX.Element {
    const [members, setMembers] = useState<Member[]>([]);
    const [loadingMembers, setLoadingMembers] = useState<boolean>(true);

    const [title, setTitle] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [priority, setPriority] = useState<Priority>('MEDIUM');
    const [dueDate, setDueDate] = useState<string>('');
    const [assigneeId, setAssigneeId] = useState<string>('');

    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

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
            setTitle('');
            setDescription('');
            setPriority('MEDIUM');
            setDueDate('');
            setAssigneeId('');
            onCreated();
        } catch (err) {
            const ax = err as AxiosError<Envelope<unknown>>;
            const env = ax.response?.data;
            setError(env?.message ?? 'Failed to create task.');
            setFieldErrors(env?.errors ?? {});
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form className="task-form" onSubmit={handleSubmit} noValidate>
            <div className="field field-wide">
                <label className="field-label" htmlFor="task-title">
                    Title
                </label>
                <div className="input-wrap">
                    <FileText size={18} aria-hidden="true" />
                    <input
                        id="task-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        disabled={submitting}
                    />
                </div>
                {fieldErrors.title?.map((message) => (
                    <div className="field-error" key={message} role="alert">
                        {message}
                    </div>
                ))}
            </div>

            <div className="field field-wide">
                <label className="field-label" htmlFor="task-description">
                    Description
                </label>
                <textarea
                    id="task-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={submitting}
                />
            </div>

            <div className="field">
                <label className="field-label" htmlFor="task-priority">
                    Priority
                </label>
                <select
                    id="task-priority"
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
            </div>

            <div className="field">
                <label className="field-label" htmlFor="task-due-date">
                    Due date
                </label>
                <div className="input-wrap">
                    <CalendarDays size={18} aria-hidden="true" />
                    <input
                        id="task-due-date"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        required
                        disabled={submitting}
                    />
                </div>
                {fieldErrors.due_date?.map((message) => (
                    <div className="field-error" key={message} role="alert">
                        {message}
                    </div>
                ))}
            </div>

            <div className="field field-wide">
                <label className="field-label" htmlFor="task-assignee">
                    Assignee
                </label>
                <div className="input-wrap">
                    <UserRound size={18} aria-hidden="true" />
                    <select
                        id="task-assignee"
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                        disabled={submitting || loadingMembers}
                    >
                        <option value="">Unassigned</option>
                        {members.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.name} ({member.email})
                            </option>
                        ))}
                    </select>
                </div>
                {fieldErrors.assignee_id?.map((message) => (
                    <div className="field-error" key={message} role="alert">
                        {message}
                    </div>
                ))}
            </div>

            {error && (
                <div className="alert alert-danger field-wide" role="alert">
                    {error}
                </div>
            )}

            <div className="form-actions field-wide">
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? (
                        <Loader2 className="icon-spin" size={17} aria-hidden="true" />
                    ) : (
                        <Plus size={17} aria-hidden="true" />
                    )}
                    <span>{submitting ? 'Creating...' : 'Create task'}</span>
                </button>
            </div>
        </form>
    );
}

export default TaskCreationForm;
