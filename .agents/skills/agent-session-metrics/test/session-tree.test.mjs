import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSessionTree, selectSessionsByScope } from '../src/session-tree.mjs';

const summaries = [
  { provider: 'codex', sessionId: 'root', parentSessionId: null, depth: null },
  { provider: 'codex', sessionId: 'child-a', parentSessionId: 'root', depth: 1 },
  { provider: 'codex', sessionId: 'child-b', parentSessionId: 'root', depth: 1 },
  { provider: 'codex', sessionId: 'grandchild', parentSessionId: 'child-a', depth: 2 },
];

test('builds recursive tree nodes in stable traversal order', () => {
  const tree = buildSessionTree({ rootSessionId: 'root', sessions: summaries });

  assert.deepEqual(
    tree.nodes.map((node) => node.sessionId),
    ['root', 'child-a', 'grandchild', 'child-b'],
  );
  assert.deepEqual(tree.nodes.find((node) => node.sessionId === 'root').children, ['child-a', 'child-b']);
});

test('ignores unrelated orphan sessions while building a target tree', () => {
  const tree = buildSessionTree({
    rootSessionId: 'root',
    sessions: [...summaries, { provider: 'codex', sessionId: 'orphan', parentSessionId: 'missing-parent', depth: 1 }],
  });

  assert.equal(tree.warnings.length, 0);
  assert.deepEqual(
    tree.nodes.map((node) => node.sessionId),
    ['root', 'child-a', 'grandchild', 'child-b'],
  );
});

test('selects tree, main, and children scopes', () => {
  const tree = buildSessionTree({ rootSessionId: 'root', sessions: summaries });

  assert.deepEqual(
    selectSessionsByScope({ sessions: summaries, tree, scope: 'tree' }).map((s) => s.sessionId),
    ['root', 'child-a', 'grandchild', 'child-b'],
  );
  assert.deepEqual(
    selectSessionsByScope({ sessions: summaries, tree, scope: 'main' }).map((s) => s.sessionId),
    ['root'],
  );
  assert.deepEqual(
    selectSessionsByScope({ sessions: summaries, tree, scope: 'children' }).map((s) => s.sessionId),
    ['child-a', 'grandchild', 'child-b'],
  );
});
