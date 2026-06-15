import { randomUUID } from 'node:crypto';
import { appendFile, chmod, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ArtifactStore, RunEvent } from '../types.js';

export class FileArtifactStore implements ArtifactStore {
  private readonly appendQueues = new Map<string, Promise<void>>();

  constructor(private readonly root: string) {}

  async writeJson(relativePath: string, value: unknown): Promise<void> {
    await this.writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
  }

  async writeText(relativePath: string, value: string): Promise<void> {
    const filePath = path.join(this.root, relativePath);
    const directory = path.dirname(filePath);
    await mkdir(directory, { recursive: true });
    const tempPath = path.join(
      directory,
      `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`,
    );
    try {
      const mode = await existingFileMode(filePath);
      await writeFile(tempPath, value, mode === null ? undefined : { mode });
      if (mode !== null) await chmod(tempPath, mode);
      await rename(tempPath, filePath);
    } catch (error) {
      await unlink(tempPath).catch(() => undefined);
      throw error;
    }
  }

  async readText(relativePath: string): Promise<string | null> {
    try {
      return await readFile(path.join(this.root, relativePath), 'utf8');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async appendText(relativePath: string, value: string): Promise<void> {
    const filePath = path.join(this.root, relativePath);
    await this.enqueueAppend(filePath, async () => {
      await mkdir(path.dirname(filePath), { recursive: true });
      await appendFile(filePath, value);
    });
  }

  async appendEvent(event: RunEvent): Promise<void> {
    const filePath = path.join(this.root, 'events.ndjson');
    await this.enqueueAppend(filePath, async () => {
      await mkdir(path.dirname(filePath), { recursive: true });
      await appendFile(filePath, `${JSON.stringify(event)}\n`);
    });
  }

  private async enqueueAppend(filePath: string, write: () => Promise<void>): Promise<void> {
    const previous = this.appendQueues.get(filePath) ?? Promise.resolve();
    const current = previous.then(write, write);
    this.appendQueues.set(filePath, current);
    try {
      await current;
    } finally {
      if (this.appendQueues.get(filePath) === current) {
        this.appendQueues.delete(filePath);
      }
    }
  }
}

async function existingFileMode(filePath: string): Promise<number | null> {
  try {
    return (await stat(filePath)).mode & 0o777;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}
