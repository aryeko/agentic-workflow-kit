import type { Clock } from '../types.js';

export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
  nowMs(): number {
    return Date.now();
  }
}
