import path from 'node:path';

export function codexSessionLogRoots(home = process.env.HOME): string[] {
  return home ? [path.join(home, '.codex', 'sessions'), path.join(home, '.codex', 'archived_sessions')] : [];
}
