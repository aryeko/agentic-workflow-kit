import { adoptionReport, configLoadedEvent, diagnosticsFor } from './adoption.js';
import { resolveRunPolicy } from './resolution.js';
import type {
  AdoptionContext,
  AdoptionDiagnosticFailure,
  AdoptionReport,
  AdoptionSource,
  ConfigurationPolicy,
  ConfigSource,
  PolicyResolutionFailure,
  ResolutionContext,
  ResolvedPolicyResult,
  RunConfigInput,
} from './types.js';
import type { Result } from './result.js';

export const createConfigurationPolicy = (): ConfigurationPolicy => ({
  diagnoseAdoption(
    sources: AdoptionSource,
    context: AdoptionContext,
  ): Result<AdoptionReport, AdoptionDiagnosticFailure> {
    const diagnostics = diagnosticsFor(sources);
    const hasConfigDiagnostic = diagnostics.some((diagnostic) => diagnostic.path === sources.config.path);
    if (!hasConfigDiagnostic) {
      const write = context.eventWriter.appendConfigLoaded(configLoadedEvent(sources.config, context.occurredAt));
      if (!write.ok) {
        return {
          ok: false,
          error: { reason: 'config-loaded-write-failed', blockingState: 'config-loaded-unrecorded' },
        };
      }
    }
    return { ok: true, value: adoptionReport(sources, context.occurredAt) };
  },
  resolveRunPolicy(
    source: ConfigSource,
    input: RunConfigInput,
    context: ResolutionContext,
  ): Result<ResolvedPolicyResult, PolicyResolutionFailure> {
    return resolveRunPolicy(source, input, context);
  },
});
