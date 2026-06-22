import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
  fsyncSync,
} from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

import type { FilesystemBackend, FilesystemFaultRule } from './filesystem-types.js';

const cloneBytes = (bytes: Uint8Array): Uint8Array => Uint8Array.from(bytes);

const parentDirectory = (path: string): string => {
  const directory = posix.dirname(path);
  return directory === '.' ? '/' : directory;
};

const normalizeRelativePath = (path: string): string => {
  return posix.resolve('/', path);
};

const ancestorDirectories = (path: string): string[] => {
  const directories = ['/'];
  let current = normalizeRelativePath(path);

  while (current !== '/') {
    current = parentDirectory(current);
    if (!directories.includes(current)) {
      directories.push(current);
    }
  }

  return directories.reverse();
};

export const createFakeFilesystemBackend = (): FilesystemBackend => {
  const directories = new Set<string>(['/']);
  const files = new Map<string, Uint8Array>();

  const ensureDirectory = (path: string): void => {
    for (const directory of ancestorDirectories(path)) {
      directories.add(directory);
    }
    directories.add(normalizeRelativePath(path));
  };

  const assertParentDirectory = (path: string): void => {
    const directory = parentDirectory(path);
    ensureDirectory(directory);
  };

  return {
    rootLabel: 'memory://filesystem-storage',

    ensureDirectory(path) {
      ensureDirectory(path);
    },

    exists(path) {
      const normalized = normalizeRelativePath(path);
      return files.has(normalized) || directories.has(normalized);
    },

    readFile(path) {
      const bytes = files.get(normalizeRelativePath(path));
      return bytes === undefined ? undefined : cloneBytes(bytes);
    },

    writeFile(path, bytes) {
      const normalized = normalizeRelativePath(path);
      assertParentDirectory(normalized);
      files.set(normalized, cloneBytes(bytes));
    },

    writeExclusive(path, bytes) {
      const normalized = normalizeRelativePath(path);
      assertParentDirectory(normalized);
      if (files.has(normalized)) {
        throw new Error(`EEXIST: ${normalized}`);
      }
      files.set(normalized, cloneBytes(bytes));
    },

    rename(fromPath, toPath) {
      const normalizedFrom = normalizeRelativePath(fromPath);
      const normalizedTo = normalizeRelativePath(toPath);
      const bytes = files.get(normalizedFrom);
      if (bytes === undefined) {
        throw new Error(`ENOENT: ${normalizedFrom}`);
      }
      assertParentDirectory(normalizedTo);
      files.delete(normalizedFrom);
      files.set(normalizedTo, cloneBytes(bytes));
    },

    remove(path) {
      const normalized = normalizeRelativePath(path);
      files.delete(normalized);
    },

    fsyncFile(path) {
      if (!files.has(normalizeRelativePath(path))) {
        throw new Error(`ENOENT: ${path}`);
      }
    },

    fsyncDirectory(path) {
      ensureDirectory(path);
    },

    listFiles(prefix = '/') {
      const normalizedPrefix = normalizeRelativePath(prefix);
      return [...files.keys()].filter((path) => path.startsWith(normalizedPrefix)).sort();
    },

    corruptFile(path, bytes) {
      const normalized = normalizeRelativePath(path);
      if (!files.has(normalized)) {
        throw new Error(`ENOENT: ${normalized}`);
      }
      files.set(normalized, cloneBytes(bytes));
    },
  };
};

export const createLocalFilesystemBackend = ({ rootPath }: { readonly rootPath: string }): FilesystemBackend => {
  const toAbsolutePath = (path: string): string => join(rootPath, normalizeRelativePath(path).slice(1));

  const ensureDirectory = (path: string): void => {
    mkdirSync(toAbsolutePath(path), { recursive: true });
  };

  const closeDescriptor = (descriptor: number): void => {
    closeSync(descriptor);
  };

  return {
    rootLabel: rootPath,

    ensureDirectory(path) {
      ensureDirectory(path);
    },

    exists(path) {
      return existsSync(toAbsolutePath(path));
    },

    readFile(path) {
      const absolutePath = toAbsolutePath(path);
      if (!existsSync(absolutePath)) {
        return undefined;
      }
      return new Uint8Array(readFileSync(absolutePath));
    },

    writeFile(path, bytes) {
      ensureDirectory(parentDirectory(normalizeRelativePath(path)));
      writeFileSync(toAbsolutePath(path), bytes);
    },

    writeExclusive(path, bytes) {
      ensureDirectory(parentDirectory(normalizeRelativePath(path)));
      const descriptor = openSync(toAbsolutePath(path), 'wx');
      try {
        writeFileSync(descriptor, bytes);
      } finally {
        closeDescriptor(descriptor);
      }
    },

    rename(fromPath, toPath) {
      ensureDirectory(parentDirectory(normalizeRelativePath(toPath)));
      renameSync(toAbsolutePath(fromPath), toAbsolutePath(toPath));
    },

    remove(path) {
      rmSync(toAbsolutePath(path), { force: true });
    },

    fsyncFile(path) {
      const descriptor = openSync(toAbsolutePath(path), 'r');
      try {
        fsyncSync(descriptor);
      } finally {
        closeDescriptor(descriptor);
      }
    },

    fsyncDirectory(path) {
      ensureDirectory(path);
      const descriptor = openSync(toAbsolutePath(path), 'r');
      try {
        fsyncSync(descriptor);
      } finally {
        closeDescriptor(descriptor);
      }
    },

    listFiles(prefix = '/') {
      if (!existsSync(rootPath)) {
        return [];
      }

      const collected: string[] = [];
      const recurse = (absoluteDirectory: string): void => {
        for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
          const absolutePath = join(absoluteDirectory, entry.name);
          if (entry.isDirectory()) {
            recurse(absolutePath);
            continue;
          }
          const relativePath = `/${relative(rootPath, absolutePath).split(sep).join('/')}`;
          collected.push(relativePath);
        }
      };

      recurse(rootPath);

      const normalizedPrefix = normalizeRelativePath(prefix);
      return collected.filter((path) => path.startsWith(normalizedPrefix)).sort();
    },

    corruptFile(path, bytes) {
      writeFileSync(toAbsolutePath(path), bytes);
    },
  };
};

export const createFaultInjectingFilesystemBackend = ({
  backend,
  faults,
}: {
  readonly backend: FilesystemBackend;
  readonly faults: readonly FilesystemFaultRule[];
}): FilesystemBackend => {
  const remaining = faults.map((fault) => ({
    ...fault,
    times: fault.times ?? 1,
  }));
  let phase: 'probe' | 'runtime' = 'probe';

  const maybeThrow = (operation: FilesystemFaultRule['operation'], path: string): void => {
    for (const fault of remaining) {
      if (fault.operation !== operation) {
        continue;
      }
      if (!path.includes(fault.pathIncludes)) {
        continue;
      }
      if (fault.afterProbePhase === true && phase !== 'runtime') {
        continue;
      }
      if (fault.times <= 0) {
        continue;
      }

      fault.times -= 1;
      throw new Error(`Injected filesystem fault for ${operation} at ${path}`);
    }
  };

  return {
    ...backend,

    writeFile(path, bytes) {
      maybeThrow('write-file', path);
      backend.writeFile(path, bytes);
    },

    writeExclusive(path, bytes) {
      maybeThrow('write-exclusive', path);
      backend.writeExclusive(path, bytes);
    },

    rename(fromPath, toPath) {
      maybeThrow('rename', `${fromPath}->${toPath}`);
      backend.rename(fromPath, toPath);
    },

    remove(path) {
      maybeThrow('remove', path);
      backend.remove(path);
    },

    fsyncFile(path) {
      maybeThrow('fsync-file', path);
      backend.fsyncFile(path);
    },

    fsyncDirectory(path) {
      maybeThrow('fsync-directory', path);
      backend.fsyncDirectory(path);
    },

    setPhase(nextPhase) {
      phase = nextPhase;
      backend.setPhase?.(nextPhase);
    },
  };
};
