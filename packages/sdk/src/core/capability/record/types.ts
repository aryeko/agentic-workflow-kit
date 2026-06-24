import type { RunAppendFailure } from '../../run-lifecycle/contracts/index.js';

export class GateRecordUnwritable extends Error {
  readonly token = 'gate-record-unwritable';
  readonly causeCode: RunAppendFailure['code'];

  constructor(cause: RunAppendFailure) {
    super(`Capability gate record is unwritable: ${cause.code}`);
    this.name = 'GateRecordUnwritable';
    this.causeCode = cause.code;
  }
}
