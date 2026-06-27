import { codexAdapter } from './adapters/codex/index.mjs';
import { MetricsError } from './contracts.mjs';

const adapters = new Map([[codexAdapter.id, codexAdapter]]);

export function listProviderAdapters() {
  return [...adapters.keys()].sort();
}

export function getProviderAdapter(provider = 'codex') {
  const adapter = adapters.get(provider);
  if (!adapter) {
    throw new MetricsError(`provider adapter not implemented: ${provider}`);
  }
  return adapter;
}
