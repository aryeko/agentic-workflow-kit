import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runInspectHandler } from '../src/commands/handlers';
import {
  notifyRunSubscriptions,
  runSubscribeHandler,
  runSubscriptionPollHandler,
  runUnsubscribeHandler,
} from '../src/commands/runSubscriptions';

async function createRun(status = 'running'): Promise<string> {
  const runPath = await mkdtemp(path.join(os.tmpdir(), 'awk-subscriptions-'));
  await mkdir(runPath, { recursive: true });
  await writeFile(
    path.join(runPath, 'state.json'),
    JSON.stringify({
      runId: 'run-1',
      status,
      active: status === 'running' ? ['LK02'] : [],
      completed: status === 'complete' ? [{ storyId: 'LK02' }] : [],
    }),
  );
  await appendEvent(runPath, { type: 'run-started', message: 'Run started' });
  await appendEvent(runPath, { type: 'child-session-linked', storyId: 'LK02', message: 'Child linked' });
  return runPath;
}

async function appendEvent(runPath: string, event: Record<string, unknown>): Promise<void> {
  const recordedAt = typeof event.recordedAt === 'string' ? event.recordedAt : new Date().toISOString();
  await writeFile(
    path.join(runPath, 'events.ndjson'),
    `${JSON.stringify({ recordedAt, eventAt: recordedAt, ...event })}\n`,
    { flag: 'a' },
  );
}

async function readSubscription(runPath: string, subscriptionId: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(runPath, 'subscriptions', `${subscriptionId}.json`), 'utf8'));
}

async function readWakeSignal(runPath: string, wakeArtifact: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(runPath, wakeArtifact), 'utf8'));
}

async function readEvents(runPath: string): Promise<Array<Record<string, unknown>>> {
  return (await readFile(path.join(runPath, 'events.ndjson'), 'utf8'))
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('detached run subscriptions', () => {
  it('rejects missing run artifacts before creating subscription records', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'awk-subscriptions-missing-'));
    const missingRunPath = path.join(root, 'missing-run');

    await expect(runSubscribeHandler({ runPath: missingRunPath })).rejects.toThrow(/run not found/i);
    await expect(stat(path.join(missingRunPath, 'subscriptions'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('creates a schemaVersion 1 record with replay tail and wake artifacts', async () => {
    const runPath = await createRun();

    const result = await runSubscribeHandler({
      runPath,
      subscription: { topics: ['child'], replay: { lastEvents: 1 }, includeData: 'summary' },
    });

    expect(result).toMatchObject({
      runId: 'run-1',
      committedCursor: 'events.ndjson:0',
      nextCursor: 'events.ndjson:4',
      terminal: false,
      replay: [expect.objectContaining({ type: 'child-session-linked', topic: 'child', storyId: 'LK02' })],
      hostAdapter: {
        watch: expect.stringMatching(/^subscriptions\/sub_[\w-]+\.wake$/),
        poll: { mcpTool: 'workflow_run_subscription_poll' },
        close: { mcpTool: 'workflow_run_unsubscribe' },
      },
    });
    expect(result.wakeArtifact).toBe(`subscriptions/${result.subscriptionId}.wake`);
    expect(result.subscriptionArtifact).toBe(`subscriptions/${result.subscriptionId}.json`);
    await expect(stat(path.join(runPath, result.wakeArtifact))).resolves.toBeTruthy();
    await expect(readSubscription(runPath, result.subscriptionId)).resolves.toMatchObject({
      schemaVersion: 1,
      id: result.subscriptionId,
      runId: 'run-1',
      status: 'active',
      committedCursor: 'events.ndjson:0',
      filter: { topics: ['child'], includeData: 'summary' },
      metrics: { wakeCount: 1, lastWakeCursor: 'events.ndjson:3' },
    });
  });

  it('journals lifecycle events without self-wake recursion and tracks wake/delivery metrics', async () => {
    const runPath = await createRun();

    const subscribed = await runSubscribeHandler({
      runPath,
      now: '2026-06-17T10:00:00.000Z',
      subscription: { topics: ['child'], replay: { lastEvents: 0 } },
    });

    expect((await readEvents(runPath)).map((event) => event.type)).toEqual([
      'run-started',
      'child-session-linked',
      'subscription-created',
      'subscription-woken',
    ]);

    await notifyRunSubscriptions(runPath, { now: '2026-06-17T10:00:01.000Z' });
    expect((await readEvents(runPath)).filter((event) => event.type === 'subscription-woken')).toHaveLength(1);

    await appendEvent(runPath, {
      type: 'child-progress',
      storyId: 'LK02',
      message: 'Working',
      recordedAt: '2026-06-17T10:00:02.000Z',
    });
    await notifyRunSubscriptions(runPath, { now: '2026-06-17T10:00:03.000Z' });

    const polled = await runSubscriptionPollHandler({
      runPath,
      subscriptionId: subscribed.subscriptionId,
      ackCursor: subscribed.nextCursor,
      now: '2026-06-17T10:00:04.000Z',
    });
    await runUnsubscribeHandler({
      runPath,
      subscriptionId: subscribed.subscriptionId,
      now: '2026-06-17T10:00:05.000Z',
    });

    expect(polled.events).toEqual([expect.objectContaining({ type: 'child-progress', storyId: 'LK02' })]);
    expect((await readEvents(runPath)).map((event) => event.type)).toEqual([
      'run-started',
      'child-session-linked',
      'subscription-created',
      'subscription-woken',
      'child-progress',
      'subscription-woken',
      'subscription-closed',
    ]);
    await expect(readSubscription(runPath, subscribed.subscriptionId)).resolves.toMatchObject({
      status: 'closed',
      metrics: {
        wakeCount: 2,
        matchedEventCount: 1,
        coalescedEventCount: 0,
        deliveredEventCount: 1,
        lastWakeCursor: 'events.ndjson:5',
        lastObservedCursor: 'events.ndjson:5',
      },
    });
  });

  it('surfaces compact detached subscription observability in run inspect output', async () => {
    const runPath = await createRun();
    const subscribed = await runSubscribeHandler({
      runPath,
      now: '2026-06-17T10:00:00.000Z',
      subscription: { topics: ['child'], replay: { lastEvents: 0 } },
    });
    await appendEvent(runPath, {
      type: 'child-progress',
      storyId: 'LK02',
      message: 'Working',
      recordedAt: '2026-06-17T10:00:02.000Z',
    });
    await notifyRunSubscriptions(runPath, { now: '2026-06-17T10:00:03.000Z' });

    await expect(runInspectHandler({ runPath })).resolves.toMatchObject({
      runId: 'run-1',
      subscriptions: {
        activeSubscriptions: 1,
        totalSubscriptions: 1,
        lastWakeAt: '2026-06-17T10:00:03.000Z',
        items: [
          {
            subscriptionId: subscribed.subscriptionId,
            status: 'active',
            terminal: false,
            committedCursor: 'events.ndjson:0',
            lastWakeAt: '2026-06-17T10:00:03.000Z',
            metrics: {
              wakeCount: 2,
              matchedEventCount: 1,
              coalescedEventCount: 0,
              deliveredEventCount: 0,
              lastWakeCursor: 'events.ndjson:5',
            },
          },
        ],
      },
    });
  });

  it('uses two-phase ack so unacked batches replay and acked batches advance', async () => {
    const runPath = await createRun();
    const subscribed = await runSubscribeHandler({
      runPath,
      subscription: { topics: ['child'], replay: { lastEvents: 0 } },
    });
    await appendEvent(runPath, { type: 'child-progress', storyId: 'LK02', message: 'Working' });
    await notifyRunSubscriptions(runPath);

    const first = await runSubscriptionPollHandler({
      runPath,
      subscriptionId: subscribed.subscriptionId,
      ackCursor: subscribed.nextCursor,
    });
    const replayed = await runSubscriptionPollHandler({ runPath, subscriptionId: subscribed.subscriptionId });
    const acked = await runSubscriptionPollHandler({
      runPath,
      subscriptionId: subscribed.subscriptionId,
      ackCursor: first.nextCursor,
    });

    expect(first).toMatchObject({
      committedCursor: subscribed.nextCursor,
      nextCursor: 'events.ndjson:6',
      terminal: false,
      events: [expect.objectContaining({ type: 'child-progress', message: 'Working' })],
    });
    expect(replayed.events.map((event) => event.id)).toEqual(first.events.map((event) => event.id));
    expect(acked).toMatchObject({
      committedCursor: first.nextCursor,
      nextCursor: first.nextCursor,
      events: [],
    });
  });

  it('paginates from the earliest unacked matching event when max caps delivery', async () => {
    const runPath = await createRun();
    const subscribed = await runSubscribeHandler({
      runPath,
      subscription: { topics: ['child'], replay: { lastEvents: 0 } },
    });
    await appendEvent(runPath, { type: 'child-progress', storyId: 'LK02', message: 'First' });
    await appendEvent(runPath, { type: 'child-progress', storyId: 'LK02', message: 'Second' });
    await appendEvent(runPath, { type: 'child-progress', storyId: 'LK02', message: 'Third' });

    const firstPage = await runSubscriptionPollHandler({
      runPath,
      subscriptionId: subscribed.subscriptionId,
      ackCursor: subscribed.nextCursor,
      max: 2,
    });
    const secondPage = await runSubscriptionPollHandler({
      runPath,
      subscriptionId: subscribed.subscriptionId,
      ackCursor: firstPage.nextCursor,
      max: 2,
    });

    expect(firstPage.events.map((event) => event.message)).toEqual(['First', 'Second']);
    expect(firstPage.nextCursor).toBe('events.ndjson:6');
    expect(secondPage.events.map((event) => event.message)).toEqual(['Third']);
    expect(secondPage.nextCursor).toBe('events.ndjson:7');
  });

  it('rejects malformed cursors and unknown future subscription artifact versions', async () => {
    const runPath = await createRun();
    const subscribed = await runSubscribeHandler({ runPath, subscription: { replay: { lastEvents: 0 } } });

    await expect(
      runSubscriptionPollHandler({ runPath, subscriptionId: subscribed.subscriptionId, ackCursor: 'events.ndjson:99' }),
    ).rejects.toThrow(/ackCursor.*beyond/i);

    const recordPath = path.join(runPath, 'subscriptions', `${subscribed.subscriptionId}.json`);
    const record = JSON.parse(await readFile(recordPath, 'utf8'));
    await writeFile(recordPath, JSON.stringify({ ...record, schemaVersion: 2 }, null, 2));

    await expect(runSubscriptionPollHandler({ runPath, subscriptionId: subscribed.subscriptionId })).rejects.toThrow(
      /unsupported subscription artifact schemaVersion 2/i,
    );
  });

  it('touches wake files for wakeOn matches, throttles duplicate wakes, and always wakes terminal state', async () => {
    const runPath = await createRun();
    const subscribed = await runSubscribeHandler({
      runPath,
      subscription: {
        topics: ['child', 'error', 'run'],
        wakeOn: { minLevel: 'warn', types: ['run-complete'] },
        throttleMs: 10_000,
        replay: { lastEvents: 0 },
      },
    });
    const wakePath = path.join(runPath, subscribed.wakeArtifact);
    const initialWake = await readWakeSignal(runPath, subscribed.wakeArtifact);

    await appendEvent(runPath, { type: 'child-progress', storyId: 'LK02', message: 'Routine progress' });
    await notifyRunSubscriptions(runPath);
    expect(await readWakeSignal(runPath, subscribed.wakeArtifact)).toEqual(initialWake);

    await appendEvent(runPath, { type: 'child-error', storyId: 'LK02', message: 'Child failed' });
    await notifyRunSubscriptions(runPath);
    const warningWake = await readWakeSignal(runPath, subscribed.wakeArtifact);
    expect(warningWake).toMatchObject({ reason: 'events-available', cursorAtWake: 'events.ndjson:6' });
    expect(warningWake).not.toEqual(initialWake);

    await appendEvent(runPath, { type: 'child-error', storyId: 'LK02', message: 'Duplicate warning' });
    await notifyRunSubscriptions(runPath);
    expect(await readWakeSignal(runPath, subscribed.wakeArtifact)).toEqual(warningWake);

    await writeFile(path.join(runPath, 'state.json'), JSON.stringify({ runId: 'run-1', status: 'complete' }));
    await appendEvent(runPath, { type: 'run-complete', message: 'Done' });
    await notifyRunSubscriptions(runPath);

    const terminal = await runSubscriptionPollHandler({
      runPath,
      subscriptionId: subscribed.subscriptionId,
      ackCursor: 'events.ndjson:5',
    });
    await expect(readFile(wakePath, 'utf8').then((content) => JSON.parse(content))).resolves.toMatchObject({
      reason: 'terminal',
      cursorAtWake: 'events.ndjson:9',
    });
    expect(terminal).toMatchObject({ terminal: true, status: 'complete' });
  });

  it('wakes and marks terminal from a terminal event before state.json is terminal', async () => {
    const runPath = await createRun();
    const subscribed = await runSubscribeHandler({
      runPath,
      subscription: {
        topics: ['child'],
        wakeOn: { types: ['child-error'] },
        replay: { lastEvents: 0 },
      },
    });
    const initialWake = await readWakeSignal(runPath, subscribed.wakeArtifact);

    await appendEvent(runPath, { type: 'run-complete', message: 'Done before state write' });
    await notifyRunSubscriptions(runPath);

    const terminalWake = await readWakeSignal(runPath, subscribed.wakeArtifact);
    expect(terminalWake).toMatchObject({ reason: 'terminal', cursorAtWake: 'events.ndjson:5' });
    expect(terminalWake).not.toEqual(initialWake);
    await expect(readSubscription(runPath, subscribed.subscriptionId)).resolves.toMatchObject({
      terminal: true,
      status: 'complete',
    });
  });

  it('enforces active subscription cap and removes idle orphan records', async () => {
    const runPath = await createRun();
    let oldestSubscriptionId = '';
    let oldestWakeArtifact = '';
    for (let index = 0; index < 20; index += 1) {
      const subscribed = await runSubscribeHandler({ runPath, subscription: { replay: { lastEvents: 0 } } });
      if (index === 0) {
        oldestSubscriptionId = subscribed.subscriptionId;
        oldestWakeArtifact = subscribed.wakeArtifact;
      }
    }
    await expect(runSubscribeHandler({ runPath, subscription: { replay: { lastEvents: 0 } } })).rejects.toThrow(
      /active subscription limit 20/i,
    );

    const first = await runSubscribeHandler({
      runPath,
      subscription: { replay: { lastEvents: 0 } },
      now: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
    });

    expect(first.subscriptionId).toMatch(/^sub_/);
    expect((await readSubscription(runPath, first.subscriptionId)).status).toBe('active');
    await expect(stat(path.join(runPath, 'subscriptions', `${oldestSubscriptionId}.json`))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(stat(path.join(runPath, oldestWakeArtifact))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('closes subscriptions idempotently and removes the wake artifact', async () => {
    const runPath = await createRun();
    const subscribed = await runSubscribeHandler({ runPath, subscription: { replay: { lastEvents: 0 } } });

    await expect(runUnsubscribeHandler({ runPath, subscriptionId: subscribed.subscriptionId })).resolves.toEqual({
      subscriptionId: subscribed.subscriptionId,
      closed: true,
    });
    await expect(runUnsubscribeHandler({ runPath, subscriptionId: subscribed.subscriptionId })).resolves.toEqual({
      subscriptionId: subscribed.subscriptionId,
      closed: true,
    });
    await expect(stat(path.join(runPath, subscribed.wakeArtifact))).rejects.toMatchObject({ code: 'ENOENT' });

    await appendEvent(runPath, { type: 'child-progress', storyId: 'LK02', message: 'Late progress' });
    await notifyRunSubscriptions(runPath);

    await expect(stat(path.join(runPath, subscribed.wakeArtifact))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readSubscription(runPath, subscribed.subscriptionId)).resolves.toMatchObject({
      status: 'closed',
      terminal: true,
    });
  });
});
