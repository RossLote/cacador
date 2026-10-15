import { describe, expect, it, vi } from 'vitest';
import { watchForUpdate } from './registerServiceWorker';

/** The part of a ServiceWorkerContainer the watcher reads: the controller at load and its controllerchange event. */
function container(controller: object | null) {
  const target = Object.assign(new EventTarget(), { controller });
  const takeOver = () => target.dispatchEvent(new Event('controllerchange'));
  return { container: target as unknown as ServiceWorkerContainer, takeOver };
}

describe('watchForUpdate', () => {
  it('calls an update when a new worker takes over a page a worker already controlled', () => {
    const { container: sw, takeOver } = container({});
    const onUpdate = vi.fn();
    watchForUpdate(sw, onUpdate);
    expect(onUpdate).not.toHaveBeenCalled();
    takeOver();
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it('does not call the first worker claiming a page that loaded without one an update, but calls the next one', () => {
    const { container: sw, takeOver } = container(null);
    const onUpdate = vi.fn();
    watchForUpdate(sw, onUpdate);
    takeOver();
    expect(onUpdate).not.toHaveBeenCalled();
    takeOver();
    expect(onUpdate).toHaveBeenCalledOnce();
  });
});
