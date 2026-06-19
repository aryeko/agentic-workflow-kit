import type { StorageHealth } from './types.js';

export class StorageRootState {
  #health: StorageHealth;

  constructor(initialHealth: StorageHealth) {
    this.#health = initialHealth;
  }

  get health(): StorageHealth {
    return this.#health;
  }

  mark(health: StorageHealth): void {
    if (this.#health === 'ok' || this.#health === 'log-tail-repaired') {
      this.#health = health;
    }
  }

  authoritativeWritesAvailable(): boolean {
    return this.#health === 'ok' || this.#health === 'log-tail-repaired';
  }
}
