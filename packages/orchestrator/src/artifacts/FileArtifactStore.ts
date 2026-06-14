import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
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
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, value);
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
