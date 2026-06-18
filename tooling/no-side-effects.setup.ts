import { beforeEach, vi } from 'vitest';

// Zero-real-process / network guard for the hermetic test lanes (unit, conformance-mock).
// Real process-spawning and network APIs are replaced with stubs that throw an Error whose
// message contains "forbidden", so tests can assert the guard bites.
//
// node: builtins are replaced via vi.mock — their ESM namespace exports are non-configurable,
// so vi.spyOn cannot redefine them. globalThis.fetch is replaced via vi.stubGlobal.
// Each factory defines its own thrower inline to avoid vi.mock hoisting / TDZ issues.

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  const block = (name: string) => () => {
    throw new Error(`[no-side-effects] child_process.${name} is forbidden in this lane`);
  };
  return {
    ...actual,
    spawn: block('spawn'),
    exec: block('exec'),
    execFile: block('execFile'),
    fork: block('fork'),
    spawnSync: block('spawnSync'),
    execSync: block('execSync'),
    execFileSync: block('execFileSync'),
  } as unknown as typeof actual;
});

vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:net')>();
  const block = (name: string) => () => {
    throw new Error(`[no-side-effects] net.${name} is forbidden in this lane`);
  };
  return {
    ...actual,
    connect: block('connect'),
    createConnection: block('createConnection'),
    createServer: block('createServer'),
  } as unknown as typeof actual;
});

vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>();
  const block = (name: string) => () => {
    throw new Error(`[no-side-effects] http.${name} is forbidden in this lane`);
  };
  return { ...actual, request: block('request'), get: block('get') } as unknown as typeof actual;
});

vi.mock('node:https', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:https')>();
  const block = (name: string) => () => {
    throw new Error(`[no-side-effects] https.${name} is forbidden in this lane`);
  };
  return { ...actual, request: block('request'), get: block('get') } as unknown as typeof actual;
});

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('[no-side-effects] network (fetch) is forbidden in this lane');
  });
});
