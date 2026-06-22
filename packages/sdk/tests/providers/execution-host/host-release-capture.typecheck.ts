import type {
  CommandResult,
  ExecutionHostProvider,
  HostFailure,
  HostObservation,
  HostReleaseResult,
} from '../../../src/index.js';

import {
  credentialDestroyUnconfirmedObservation,
  credentialDestroyUnconfirmedRelease,
} from './fixtures/credential-destroy-unconfirmed.fixture.js';
import { runnerCommandCaptureIncompleteFailure } from './fixtures/runner-command-capture-incomplete.fixture.js';
import { commandResultFixture, hostReleaseResultFixture } from './fixtures/shared.js';

const commandResult = commandResultFixture() satisfies CommandResult;
const releaseResult = hostReleaseResultFixture() satisfies HostReleaseResult;
const degradedRelease = credentialDestroyUnconfirmedRelease satisfies HostReleaseResult;
const degradedObservation = credentialDestroyUnconfirmedObservation satisfies Extract<
  HostObservation,
  { type: 'host-failure' }
>;

type ReleaseWorkspaceReturn = ReturnType<ExecutionHostProvider['releaseWorkspace']>;
type RunCommandReturn = ReturnType<ExecutionHostProvider['runCommand']>;

void commandResult;
void releaseResult;
void degradedRelease;
void degradedObservation;

// @ts-expect-error AC-7 CommandResult requires outputDigest.
const commandResultWithoutOutputDigest: CommandResult = {
  operationId: 'op-verify-01',
  commandDigest: 'command-digest-01',
  cwd: '/tmp/worktrees/run-01',
  redactionApplied: true,
  startedAt: '2026-06-22T10:05:00.000Z',
  finishedAt: '2026-06-22T10:06:00.000Z',
};

// @ts-expect-error AC-7 releaseWorkspace cannot return HostFailure.
const releaseWorkspaceFailure: ReleaseWorkspaceReturn = runnerCommandCaptureIncompleteFailure as unknown as HostFailure;

const runCommandFailure: RunCommandReturn = runnerCommandCaptureIncompleteFailure;

void commandResultWithoutOutputDigest;
void releaseWorkspaceFailure;
void runCommandFailure;
