import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/test/render';
import { API, makeTask, server } from '@/test/server';
import { TaskItem } from './TaskItem';

const renderItem = (props: Parameters<typeof TaskItem>[0]) =>
  renderWithQuery(
    <ul>
      <TaskItem {...props} />
    </ul>,
  );

describe('TaskItem', () => {
  it('VIEWER : aucune action d’édition, case non cochable', () => {
    renderItem({ task: makeTask(), role: 'VIEWER', onOpen: () => undefined });
    expect(screen.queryByRole('button', { name: /Actions pour/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Terminer/ })).toBeDisabled();
  });

  it('MEMBER : suppression désactivée sur une tâche DONE, réouverture impossible', async () => {
    renderItem({
      task: makeTask({ status: 'DONE', completedAt: '2026-01-02T00:00:00.000Z' }),
      role: 'MEMBER',
      onOpen: () => undefined,
    });
    expect(screen.getByRole('checkbox', { name: /Rouvrir/ })).toBeDisabled();

    await userEvent.setup().click(screen.getByRole('button', { name: /Actions pour/ }));
    expect(
      await screen.findByRole('menuitem', { name: /Supprimer \(réservé aux admins\)/ }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'À faire' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('ADMIN : peut supprimer une tâche DONE', async () => {
    renderItem({
      task: makeTask({ status: 'DONE', completedAt: '2026-01-02T00:00:00.000Z' }),
      role: 'ADMIN',
      onOpen: () => undefined,
    });
    await userEvent.setup().click(screen.getByRole('button', { name: /Actions pour/ }));
    expect(await screen.findByRole('menuitem', { name: 'Supprimer' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it('cocher la case termine la tâche via l’API', async () => {
    let body: unknown;
    server.use(
      http.patch(`${API}/tasks/:id`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(makeTask({ status: 'DONE' }));
      }),
    );
    renderItem({ task: makeTask(), role: 'MEMBER', onOpen: () => undefined });
    await userEvent.setup().click(screen.getByRole('checkbox', { name: /Terminer/ }));
    await vi.waitFor(() => expect(body).toEqual({ status: 'DONE' }));
  });

  it('indique le retard sans se reposer sur la couleur', () => {
    renderItem({
      task: makeTask({ dueDate: '2020-01-01T00:00:00.000Z' }),
      role: 'MEMBER',
      onOpen: () => undefined,
    });
    expect(screen.getByText('En retard :')).toBeInTheDocument();
  });
});
