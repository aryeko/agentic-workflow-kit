import { spawn } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import readline from 'node:readline';

export async function findCodexSessionCandidatePaths({ providerHome, sessionId }) {
  const roots = await existingCodexRoots(providerHome);
  if (roots.length === 0) {
    return [];
  }

  const strategies = [listWithRipgrep, listWithFind, listWithNode];
  for (const strategy of strategies) {
    try {
      const paths = await strategy({ roots, sessionId });
      return paths.sort();
    } catch {}
  }
  return [];
}

export async function listCodexJsonlPaths({ providerHome }) {
  const roots = await existingCodexRoots(providerHome);
  if (roots.length === 0) {
    return [];
  }
  return (await listWithNode({ roots, sessionId: '' })).sort();
}

async function existingCodexRoots(providerHome) {
  const roots = [join(providerHome, 'sessions'), join(providerHome, 'archived_sessions')];
  const existing = [];
  for (const root of roots) {
    try {
      await access(root);
      existing.push(root);
    } catch {
      // Missing roots are normal for fresh Codex homes and fixtures.
    }
  }
  return existing;
}

async function listWithRipgrep({ roots, sessionId }) {
  const args = ['--files', '-g', sessionId ? `*${escapeGlob(sessionId)}*.jsonl` : '*.jsonl', ...roots];
  return runLineCommand({
    command: 'rg',
    args,
    allowedExitCodes: new Set([0, 1]),
    filter: (line) => isMatchingJsonlPath(line, sessionId),
  });
}

async function listWithFind({ roots, sessionId }) {
  const results = await Promise.all(
    roots.map((root) =>
      runLineCommand({
        command: 'find',
        args: [root, '-type', 'f', '-name', sessionId ? `*${sessionId}*.jsonl` : '*.jsonl'],
        allowedExitCodes: new Set([0]),
        filter: (line) => isMatchingJsonlPath(line, sessionId),
      }),
    ),
  );
  return results.flat();
}

async function listWithNode({ roots, sessionId }) {
  const results = await Promise.all(roots.map((root) => listNodeRecursive({ root, sessionId })));
  return results.flat();
}

async function listNodeRecursive({ root, sessionId }) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        return listNodeRecursive({ root: path, sessionId });
      }
      return entry.isFile() && isMatchingJsonlPath(path, sessionId) ? [path] : [];
    }),
  );
  return nested.flat();
}

function runLineCommand({ command, args, allowedExitCodes, filter }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false });
    const lines = [];
    const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });

    rl.on('line', (line) => {
      if (filter(line)) {
        lines.push(line);
      }
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (allowedExitCodes.has(code)) {
        resolve(lines);
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function isMatchingJsonlPath(path, sessionId) {
  if (!path.endsWith('.jsonl')) {
    return false;
  }
  if (!sessionId) {
    return true;
  }
  return basename(path).includes(sessionId);
}

function escapeGlob(value) {
  return value.replace(/[\\*?[{]/gu, '\\$&');
}
