import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './register';

function fakeContainer() {
  return { register: vi.fn().mockResolvedValue({}) } as unknown as ServiceWorkerContainer & {
    register: ReturnType<typeof vi.fn>;
  };
}

describe('registerServiceWorker', () => {
  it('registers /sw.js for the whole site in production', () => {
    const container = fakeContainer();
    registerServiceWorker(true, container);
    expect(container.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('does nothing in development', () => {
    const container = fakeContainer();
    registerServiceWorker(false, container);
    expect(container.register).not.toHaveBeenCalled();
  });

  it('does nothing when the browser has no service worker support', () => {
    expect(() => registerServiceWorker(true, undefined)).not.toThrow();
  });

  it('keeps the app working if registration fails', async () => {
    const container = fakeContainer();
    container.register.mockRejectedValue(new Error('blocked'));
    registerServiceWorker(true, container);
    await Promise.resolve();
    expect(container.register).toHaveBeenCalled();
  });
});
