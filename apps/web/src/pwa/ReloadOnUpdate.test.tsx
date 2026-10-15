import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReloadOnUpdate } from './ReloadOnUpdate';

const worker = vi.hoisted(() => ({ updated: false }));
vi.mock('./registerServiceWorker', () => ({ isUpdated: () => worker.updated }));

function renderAt(path: string) {
  const reload = vi.fn();
  render(
    <MemoryRouter initialEntries={[path]}>
      <Link to="/">Home</Link>
      <Link to="/practice">Practice</Link>
      <Link to="/practice?topic=patos">Ducks</Link>
      <ReloadOnUpdate reload={reload} />
    </MemoryRouter>,
  );
  return reload;
}

describe('ReloadOnUpdate', () => {
  beforeEach(() => {
    worker.updated = false;
  });

  it('never reloads while no newer worker has taken over', async () => {
    const reload = renderAt('/');
    await userEvent.click(screen.getByRole('link', { name: 'Practice' }));
    await userEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(reload).not.toHaveBeenCalled();
  });

  it('once a newer worker has taken over, reloads at the next change of screen and not on the screen in use', async () => {
    const reload = renderAt('/practice');
    worker.updated = true;
    // A change within the screen in use (a focused pool on the same screen) is not a change of screen.
    await userEvent.click(screen.getByRole('link', { name: 'Ducks' }));
    expect(reload).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(reload).toHaveBeenCalledOnce();
  });
});
