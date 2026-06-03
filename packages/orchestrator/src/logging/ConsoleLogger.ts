import type { Logger } from '../types.js';

export class ConsoleLogger implements Logger {
  info(message: string, fields: Record<string, unknown> = {}): void {
    console.log(format('info', message, fields));
  }
  warn(message: string, fields: Record<string, unknown> = {}): void {
    console.warn(format('warn', message, fields));
  }
  error(message: string, fields: Record<string, unknown> = {}): void {
    console.error(format('error', message, fields));
  }
}

function format(level: string, message: string, fields: Record<string, unknown>): string {
  return Object.keys(fields).length > 0
    ? JSON.stringify({ level, message, ...fields })
    : JSON.stringify({ level, message });
}
