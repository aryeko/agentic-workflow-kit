import type {
  CreateRunInput,
  LeaseCapability,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventLog,
  RunReplay,
  RunReplayFailure,
  RunWriter,
  WaitRunEventsRequest,
  WaitRunEventsResult,
} from '../../../../src/index.js';

const writer: RunWriter = {
  append: (): { ok: true; value: RunAppendReceipt } => {
    throw new Error('not reached');
  },
  renew: (_lease: LeaseCapability): { ok: false; error: RunAppendFailure } => {
    throw new Error('not reached');
  },
};

const invalidLog: RunEventLog = {
  createRun: (_input: CreateRunInput) => writer,
  openWriter: () => ({ ok: true, value: writer }),
  replay: (_runId: string): { ok: true; value: RunReplay } => {
    throw new Error('not reached');
  },
  waitRunEvents: async (_request: WaitRunEventsRequest): Promise<{ ok: true; value: WaitRunEventsResult }> => {
    throw new Error('not reached');
  },
  project: (_runId: string): { ok: false; error: RunReplayFailure } => {
    throw new Error('not reached');
  },
};

void invalidLog;
