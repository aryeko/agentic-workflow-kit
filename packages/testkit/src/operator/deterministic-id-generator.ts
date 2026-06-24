export class DeterministicIdGenerator {
  readonly #ids: string[];
  #index = 0;

  constructor(idOrSequence: string | readonly string[] = 'action-001') {
    this.#ids = Array.isArray(idOrSequence) ? [...idOrSequence] : [idOrSequence];

    if (this.#ids.length === 0) {
      throw new Error('DeterministicIdGenerator requires at least one id.');
    }
  }

  nextId = (): string => {
    const value = this.#ids[Math.min(this.#index, this.#ids.length - 1)];

    this.#index += 1;

    return value;
  };

  reset(): void {
    this.#index = 0;
  }
}
