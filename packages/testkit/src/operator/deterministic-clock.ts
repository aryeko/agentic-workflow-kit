export class DeterministicClock {
  readonly #timestamps: string[];
  #index = 0;

  constructor(timestampOrSequence: string | readonly string[] = '2026-01-01T00:00:00.000Z') {
    this.#timestamps = Array.isArray(timestampOrSequence) ? [...timestampOrSequence] : [timestampOrSequence];

    if (this.#timestamps.length === 0) {
      throw new Error('DeterministicClock requires at least one timestamp.');
    }
  }

  now = (): string => {
    const value = this.#timestamps[Math.min(this.#index, this.#timestamps.length - 1)];

    this.#index += 1;

    return value;
  };

  reset(): void {
    this.#index = 0;
  }
}
