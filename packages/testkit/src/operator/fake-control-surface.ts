import type {
  InspectRunParams,
  OperatorCommandEnvelope,
  OperatorCommandResult,
  PreviewRunParams,
  PreviewRunView,
  RunInspectionView,
  RunStartedView,
  StartRunParams,
} from 'sdk';

type SmokeActionKind = 'preview-run' | 'start-run' | 'inspect-run';

type SmokeCallMap = {
  'preview-run': OperatorCommandEnvelope<PreviewRunParams>;
  'start-run': OperatorCommandEnvelope<StartRunParams>;
  'inspect-run': OperatorCommandEnvelope<InspectRunParams>;
};

type SmokeResultMap = {
  'preview-run': OperatorCommandResult<PreviewRunView>;
  'start-run': OperatorCommandResult<RunStartedView>;
  'inspect-run': OperatorCommandResult<RunInspectionView>;
};

export type FakeOperatorControlSurfaceCall<K extends SmokeActionKind = SmokeActionKind> = {
  action: K;
  envelope: SmokeCallMap[K];
};

const defaultStatus = (action: SmokeActionKind): SmokeResultMap[SmokeActionKind]['status'] => {
  switch (action) {
    case 'preview-run':
      return 'completed';
    case 'start-run':
      return 'accepted';
    case 'inspect-run':
      return 'completed';
  }
};

export class FakeOperatorControlSurface {
  readonly #calls: FakeOperatorControlSurfaceCall[] = [];
  readonly #results: Partial<SmokeResultMap> = {};

  setResult<K extends SmokeActionKind>(action: K, result: SmokeResultMap[K]): void {
    this.#results[action] = result;
  }

  callCount(): number {
    return this.#calls.length;
  }

  get lastCall(): FakeOperatorControlSurfaceCall | undefined {
    return this.#calls[this.#calls.length - 1];
  }

  callsFor<K extends SmokeActionKind>(action: K): FakeOperatorControlSurfaceCall<K>[] {
    return this.#calls.filter((call) => call.action === action) as FakeOperatorControlSurfaceCall<K>[];
  }

  previewRun = (envelope: OperatorCommandEnvelope<PreviewRunParams>): OperatorCommandResult<PreviewRunView> => {
    this.#calls.push({
      action: 'preview-run',
      envelope,
    });

    return (
      this.#results['preview-run'] ?? {
        schema: 'kit-vnext.operator-command-result.v1',
        actionId: envelope.actionId,
        status: defaultStatus('preview-run'),
        errors: [],
      }
    );
  };

  startRun = (envelope: OperatorCommandEnvelope<StartRunParams>): OperatorCommandResult<RunStartedView> => {
    this.#calls.push({
      action: 'start-run',
      envelope,
    });

    return (
      this.#results['start-run'] ?? {
        schema: 'kit-vnext.operator-command-result.v1',
        actionId: envelope.actionId,
        status: defaultStatus('start-run'),
        errors: [],
      }
    );
  };

  inspectRun = (envelope: OperatorCommandEnvelope<InspectRunParams>): OperatorCommandResult<RunInspectionView> => {
    this.#calls.push({
      action: 'inspect-run',
      envelope,
    });

    return (
      this.#results['inspect-run'] ?? {
        schema: 'kit-vnext.operator-command-result.v1',
        actionId: envelope.actionId,
        status: defaultStatus('inspect-run'),
        errors: [],
      }
    );
  };
}
