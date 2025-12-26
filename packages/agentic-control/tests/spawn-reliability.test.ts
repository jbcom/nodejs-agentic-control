import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { Fleet } from '../src/fleet/fleet.js';

describe('Fleet Spawn Reliability', () => {
  let fleet: Fleet;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.CURSOR_API_KEY = 'test-key';
    fleet = new Fleet({
      apiKey: 'test-key',
      retryDelay: 1, // Very fast retries for testing
    });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.CURSOR_API_KEY;
    vi.restoreAllMocks();
  });

  it('should fail when API returns 500 without retries', async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
      headers: { get: () => 'text/plain' },
    });

    const result = await fleet.spawn({
      repository: 'owner/repo',
      task: 'test task',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('API Error 500');
    expect(global.fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('should succeed if API succeeds after a transient failure (with retries implemented)', async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
        headers: { get: () => 'text/plain' },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'bc-123', status: 'RUNNING' }),
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve(JSON.stringify({ id: 'bc-123', status: 'RUNNING' })),
      });

    const result = await fleet.spawn({
      repository: 'owner/repo',
      task: 'test task',
    });

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should retry on timeouts', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    (global.fetch as Mock).mockRejectedValueOnce(abortError).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'bc-123', status: 'RUNNING' }),
      headers: { get: () => 'application/json' },
      text: () => Promise.resolve(JSON.stringify({ id: 'bc-123', status: 'RUNNING' })),
    });

    const result = await fleet.spawn({
      repository: 'owner/repo',
      task: 'test task',
    });

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should retry on network errors', async () => {
    (global.fetch as Mock)
      .mockRejectedValueOnce(new Error('Network connection lost'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'bc-123', status: 'RUNNING' }),
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve(JSON.stringify({ id: 'bc-123', status: 'RUNNING' })),
      });

    const result = await fleet.spawn({
      repository: 'owner/repo',
      task: 'test task',
    });

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
