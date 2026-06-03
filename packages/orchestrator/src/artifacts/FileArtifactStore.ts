import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ArtifactStore, RunEvent } from '../types.js';

export class FileArtifactStore implements ArtifactStore {
  constructor(private readonly root: string) {}

  async writeJson(relativePath: string, value: unknown): Promise<void> {
    await this.writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
  }

  async writeText(relativePath: string, value: string): Promise<void> {
    const filePath = path.join(this.root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, value);
  }

  async appendEvent(event: RunEvent): Promise<void> {
    const filePath = path.join(this.root, 'events.ndjson');
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(event)}\n`);
  }
}
