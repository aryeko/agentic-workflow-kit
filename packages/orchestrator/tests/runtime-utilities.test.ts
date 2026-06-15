import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemClock } from '../src/clock/SystemClock';
import { ConsoleLogger } from '../src/logging/ConsoleLogger';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('runtime utilities', () => {
  it('returns ISO time and epoch milliseconds from the system clock', () => {
    vi.setSystemTime(new Date('2026-06-16T00:00:00.000Z'));
    const clock = new SystemClock();

    expect(clock.now()).toBe('2026-06-16T00:00:00.000Z');
    expect(clock.nowMs()).toBe(Date.parse('2026-06-16T00:00:00.000Z'));
  });

  it('writes structured console log records', () => {
    const info = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = new ConsoleLogger();

    logger.info('started');
    logger.warn('slow', { storyId: 'AWK1315' });
    logger.error('failed', { code: 'E_TEST' });

    expect(info).toHaveBeenCalledWith(JSON.stringify({ level: 'info', message: 'started' }));
    expect(warn).toHaveBeenCalledWith(JSON.stringify({ level: 'warn', message: 'slow', storyId: 'AWK1315' }));
    expect(error).toHaveBeenCalledWith(JSON.stringify({ level: 'error', message: 'failed', code: 'E_TEST' }));
  });
});
