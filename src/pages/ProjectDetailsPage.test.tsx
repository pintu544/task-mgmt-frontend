import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDetailsPage } from './ProjectDetailsPage';

const mocks = vi.hoisted(() => ({
    auth: {
        currentUser: {
            id: 2,
            name: 'Test User',
            email: 'user@example.com',
            role: 'user',
        },
    },
    laravelClient: {
        get: vi.fn(),
        patch: vi.fn(),
    },
    djangoClient: {
        post: vi.fn(),
    },
}));

vi.mock('../auth/AuthContext', () => ({
    useAuth: () => mocks.auth,
}));

vi.mock('../api/axiosClient', () => ({
    laravelClient: mocks.laravelClient,
    djangoClient: mocks.djangoClient,
}));

function renderPage(): void {
    render(
        <MemoryRouter initialEntries={['/projects/1']}>
            <Routes>
                <Route path="/projects/:id" element={<ProjectDetailsPage />} />
            </Routes>
        </MemoryRouter>,
    );
}

const baseProject = {
    id: 1,
    title: 'Portal',
    description: null,
    tasks: [
        {
            id: 10,
            title: 'Wire up status',
            description: null,
            status: 'TODO',
            priority: 'HIGH',
            due_date: '2026-05-20',
            project_id: 1,
            assignee_id: 2,
            assignee: {
                id: 2,
                name: 'Test User',
                email: 'user@example.com',
            },
        },
    ],
};

describe('ProjectDetailsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth.currentUser = {
            id: 2,
            name: 'Test User',
            email: 'user@example.com',
            role: 'user',
        };
        mocks.laravelClient.get.mockImplementation((url: string) => {
            if (url === '/api/users') {
                return Promise.resolve({ data: { data: [] } });
            }
            return Promise.resolve({ data: { data: baseProject } });
        });
        mocks.laravelClient.patch.mockResolvedValue({ data: { data: null } });
        mocks.djangoClient.post.mockResolvedValue({ data: { data: null } });
    });

    it('updates a visible task status through Laravel', async () => {
        renderPage();

        const status = await screen.findByLabelText('Status for Wire up status');
        fireEvent.change(status, { target: { value: 'IN_PROGRESS' } });

        await waitFor(() => {
            expect(mocks.laravelClient.patch).toHaveBeenCalledWith('/api/tasks/10/status', {
                status: 'IN_PROGRESS',
            });
        });
    });

    it('lets admins close overdue tasks through Django', async () => {
        mocks.auth.currentUser = {
            id: 1,
            name: 'Admin User',
            email: 'admin@example.com',
            role: 'admin',
        };
        mocks.laravelClient.get.mockImplementation((url: string) => {
            if (url === '/api/users') {
                return Promise.resolve({ data: { data: [] } });
            }
            return Promise.resolve({
                data: {
                    data: {
                        ...baseProject,
                        tasks: [{ ...baseProject.tasks[0], status: 'OVERDUE' }],
                    },
                },
            });
        });

        renderPage();

        fireEvent.click(await screen.findByRole('button', { name: 'Close' }));

        await waitFor(() => {
            expect(mocks.djangoClient.post).toHaveBeenCalledWith('/api/overdue/10/close');
        });
    });
});
