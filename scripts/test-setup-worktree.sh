#!/usr/bin/env bash
# scripts/test-setup-worktree.sh — test suite for scripts/setup-worktree.sh
#
# Each case runs in an isolated mktemp sandbox; the real repo is never touched.
# node, pnpm, corepack, and git are stubbed via PATH injection.
#
# Usage: bash scripts/test-setup-worktree.sh [--verbose]
set -euo pipefail

REAL_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/setup-worktree.sh"
[[ -f "$REAL_SCRIPT" ]] || { echo "cannot find setup-worktree.sh at $REAL_SCRIPT" >&2; exit 1; }

VERBOSE=false
for arg in "$@"; do
  case "$arg" in
    --verbose) VERBOSE=true ;;
    *) echo "unknown arg: $arg" >&2; exit 1 ;;
  esac
done

PASS=0; FAIL=0
WT_FILE=""   # set by new_sandbox; written directly by add_wt_entry

# ---------------------------------------------------------------------------
# Harness
# ---------------------------------------------------------------------------

pass() { printf 'PASS  %s\n' "$1"; ((++PASS)); }
fail() { printf 'FAIL  %s\n      expected: %s\n      got:      %s\n' "$1" "$2" "$3"; ((++FAIL)); }

assert_exit()        { [[ "$RUN_EXIT" -eq "$2" ]]         && pass "$1" || fail "$1" "exit $2"            "exit $RUN_EXIT"; }
assert_stdout_has()  { echo "$RUN_STDOUT" | grep -qF "$2" && pass "$1" || fail "$1" "stdout has '$2'"    "$RUN_STDOUT"; }
assert_stderr_has()  { echo "$RUN_STDERR" | grep -qF "$2" && pass "$1" || fail "$1" "stderr has '$2'"    "$RUN_STDERR"; }
assert_exists()      { [[ -e "$2" ]]                       && pass "$1" || fail "$1" "$2 exists"          "missing"; }
assert_absent()      { [[ ! -e "$2" ]]                     && pass "$1" || fail "$1" "$2 absent"          "present ($(ls -ld "$2" 2>/dev/null | awk '{print $1}'))"; }
assert_real_dir()    { [[ -d "$2" && ! -L "$2" ]]          && pass "$1" || fail "$1" "$2 is a real dir"   "symlink -> $(readlink "$2" 2>/dev/null || echo n/a)"; }

# Create a resolved sandbox so macOS /tmp -> /private/tmp doesn't skew pwd -P comparisons.
new_sandbox() {
  local _raw; _raw=$(mktemp -d)
  SANDBOX=$(cd "$_raw" && pwd -P)
  mkdir -p "$SANDBOX/scripts" "$SANDBOX/bin"
  ln -sf "$REAL_SCRIPT" "$SANDBOX/scripts/setup-worktree.sh"
  WT_FILE="$SANDBOX/.git-wt-output"
  touch "$WT_FILE"
  # Stub defaults — override before calling run(); append entries with add_wt_entry()
  STUB_NODE_VERSION=24
  STUB_GIT_IN_TREE=true
  CREATE_PACKAGE_JSON=true
}

cleanup() { rm -rf "${SANDBOX:-}"; }

# Append one git-worktree-list --porcelain entry to $WT_FILE.
# Written directly to avoid command-substitution stripping the trailing \n\n
# that the awk blank-line handler depends on.
add_wt_entry() { printf 'worktree %s\nHEAD 0000000000000000000000000000000000000000\nbranch refs/heads/%s\n\n' "$1" "$2" >> "$WT_FILE"; }

write_stubs() {
  # node — prints STUB_NODE_VERSION regardless of arguments
  cat > "$SANDBOX/bin/node" <<EOF
#!/usr/bin/env bash
echo "$STUB_NODE_VERSION"
EOF

  # pnpm — no-op install; returns stub store path
  cat > "$SANDBOX/bin/pnpm" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "store" && "${2:-}" == "path" ]]; then echo "/stub/pnpm/store"; fi
EOF

  # corepack — no-op
  printf '#!/usr/bin/env bash\n: # no-op\n' > "$SANDBOX/bin/corepack"

  # git — handles the two calls the script makes; worktree output already in $WT_FILE
  local in_tree="$STUB_GIT_IN_TREE"
  cat > "$SANDBOX/bin/git" <<EOF
#!/usr/bin/env bash
case "\$*" in
  "rev-parse --is-inside-work-tree")
    [[ "$in_tree" == "true" ]] && echo "true" || { echo "not a git repo" >&2; exit 128; } ;;
  "worktree list --porcelain")
    cat "$WT_FILE" ;;
  *) ;;
esac
EOF

  chmod +x "$SANDBOX/bin/node" "$SANDBOX/bin/pnpm" "$SANDBOX/bin/corepack" "$SANDBOX/bin/git"
  [[ "$CREATE_PACKAGE_JSON" == true ]] && touch "$SANDBOX/package.json" || true
}

# Run the script under test. Populates RUN_EXIT, RUN_STDOUT, RUN_STDERR.
run() {
  write_stubs
  local stderr_f; stderr_f=$(mktemp)
  set +e
  RUN_STDOUT=$(PATH="$SANDBOX/bin:$PATH" bash "$SANDBOX/scripts/setup-worktree.sh" "$@" 2>"$stderr_f")
  RUN_EXIT=$?
  RUN_STDERR=$(cat "$stderr_f"); rm -f "$stderr_f"
  set -e
  if [[ "$VERBOSE" == true ]]; then
    printf '  exit:   %s\n  stdout: %s\n  stderr: %s\n' "$RUN_EXIT" "$RUN_STDOUT" "$RUN_STDERR"
  fi
}

# ---------------------------------------------------------------------------
# Cases: validate_env
# ---------------------------------------------------------------------------
echo "=== validate_env ==="

new_sandbox
CREATE_PACKAGE_JSON=false
run
assert_exit       "no package.json → exit 1"             1
assert_stderr_has "no package.json → error message"       "package.json not found"
cleanup

new_sandbox
STUB_NODE_VERSION=20
run
assert_exit       "Node < 24 → exit 1"                   1
assert_stderr_has "Node < 24 → error message"             "Node.js 24+"
cleanup

new_sandbox
run
assert_exit       "valid env → exits cleanly"             0
cleanup

# ---------------------------------------------------------------------------
# Cases: arg parsing
# ---------------------------------------------------------------------------
echo ""
echo "=== arg parsing ==="

new_sandbox
run --foo
assert_exit       "unknown flag → exit 1"                 1
assert_stderr_has "unknown flag → message"                "unknown option"
cleanup

new_sandbox
run --warn-as-error          # no warnings should fire in a clean sandbox
assert_exit       "--warn-as-error, no warnings → exit 0" 0
cleanup

# ---------------------------------------------------------------------------
# Cases: seed_turbo_cache — .turbo already present locally
# ---------------------------------------------------------------------------
echo ""
echo "=== seed_turbo_cache: .turbo already exists ==="

new_sandbox
mkdir "$SANDBOX/.turbo"
run
assert_exit       ".turbo exists, no flag → continues (exit 0)"         0
assert_stderr_has ".turbo exists, no flag → warning printed"            ".turbo already exists"
cleanup

new_sandbox
mkdir "$SANDBOX/.turbo"
run --warn-as-error
assert_exit       ".turbo exists, --warn-as-error → exit 1"             1
assert_stderr_has ".turbo exists, --warn-as-error → warning printed"    ".turbo already exists"
cleanup

# ---------------------------------------------------------------------------
# Cases: seed_turbo_cache — primary checkout lookup
# ---------------------------------------------------------------------------
echo ""
echo "=== seed_turbo_cache: primary checkout ==="

# No primary (only current worktree in list) → silent no-op
new_sandbox
add_wt_entry "$SANDBOX" "feature-x"
run
assert_exit   "only self in worktree list → exit 0"        0
assert_absent "only self in worktree list → no .turbo"     "$SANDBOX/.turbo"
cleanup

# Primary exists but has no .turbo → log skip message, no local .turbo
new_sandbox
FAKE="$SANDBOX/fake-primary"; mkdir -p "$FAKE"
add_wt_entry "$SANDBOX" "feature-x"
add_wt_entry "$FAKE"    "v-next"
run
assert_exit       "primary has no .turbo → exit 0"                     0
assert_stdout_has "primary has no .turbo → logged skip"                "turbo will create on first run"
assert_absent     "primary has no .turbo → no .turbo locally"          "$SANDBOX/.turbo"
cleanup

# Primary has .turbo → copy it; result must be a real dir, not a symlink
new_sandbox
FAKE="$SANDBOX/fake-primary"
mkdir -p "$FAKE/.turbo/cache"
echo "artifact" > "$FAKE/.turbo/cache/entry"
add_wt_entry "$SANDBOX" "feature-x"
add_wt_entry "$FAKE"    "v-next"
run
assert_exit       "primary has .turbo → exit 0"                        0
assert_stdout_has "primary has .turbo → seeded log"                    "seeded .turbo"
assert_exists     "primary has .turbo → .turbo created"                "$SANDBOX/.turbo"
assert_real_dir   "primary has .turbo → .turbo is a real dir"          "$SANDBOX/.turbo"
assert_exists     "primary has .turbo → contents copied"               "$SANDBOX/.turbo/cache/entry"
cleanup

# ---------------------------------------------------------------------------
# Cases: find_primary_checkout — branch selection
# ---------------------------------------------------------------------------
echo ""
echo "=== find_primary_checkout: branch selection ==="

# No v-next; fallback is the first other worktree
new_sandbox
FAKE="$SANDBOX/other-worktree"; mkdir -p "$FAKE/.turbo"
add_wt_entry "$SANDBOX" "feature-x"
add_wt_entry "$FAKE"    "some-branch"
run
assert_exit   "no v-next, fallback → exit 0"                           0
assert_exists "no v-next, fallback → .turbo seeded from fallback"      "$SANDBOX/.turbo"
cleanup

# Not inside a git repo → no primary, no .turbo
new_sandbox
STUB_GIT_IN_TREE=false
run
assert_exit   "not in git repo → exit 0"                               0
assert_absent "not in git repo → no .turbo"                            "$SANDBOX/.turbo"
cleanup

# ---------------------------------------------------------------------------
# Cases: end-to-end
# ---------------------------------------------------------------------------
echo ""
echo "=== end-to-end ==="

# Happy path: primary has .turbo → copied, pnpm runs
new_sandbox
FAKE="$SANDBOX/fake-primary"; mkdir -p "$FAKE/.turbo/cache"
add_wt_entry "$SANDBOX" "feature-x"
add_wt_entry "$FAKE"    "v-next"
run
assert_exit       "happy path (.turbo available) → exit 0"             0
assert_exists     "happy path → .turbo present"                        "$SANDBOX/.turbo"
assert_real_dir   "happy path → .turbo is a real dir"                  "$SANDBOX/.turbo"
assert_stdout_has "happy path → pnpm store logged"                     "pnpm store:"
cleanup

# Happy path: no primary .turbo → no .turbo created, pnpm still runs
new_sandbox
FAKE="$SANDBOX/fake-primary"; mkdir -p "$FAKE"
add_wt_entry "$SANDBOX" "feature-x"
add_wt_entry "$FAKE"    "v-next"
run
assert_exit       "happy path (no .turbo source) → exit 0"             0
assert_absent     "happy path → no .turbo created"                     "$SANDBOX/.turbo"
assert_stdout_has "happy path → pnpm store logged"                     "pnpm store:"
cleanup

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
printf 'Results: %d passed, %d failed\n' "$PASS" "$FAIL"
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
