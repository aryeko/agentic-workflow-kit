import type { Result } from '../../../../src/index.js';

const impossibleResult: Result<string, number> = {
  ok: true,
  value: 'ready',
  error: 1,
};

void impossibleResult;
