# Provider-Neutral Agent Driver Contract (v2)

This design addresses the critical failure modes of standard provider abstractions by forcing safety boundaries, "unknown" states, and capability variability directly into the type system—preventing developers from casting undocumented features to `true` or `running` to satisfy a compiler.

---

### 1. The Recommended Abstraction Shape and Why

The abstraction takes the form of a **capability-queriable Session Driver**.

Instead of an inheritance hierarchy (`BaseDriver`, `StreamingDriver`, `PollingDriver`) which bakes in network transport assumptions, the design uses a single unified driver interface that yields a `DriverSession`. Every action attempted on that session returns an inspectable `OperationOutcome` discriminated union.

- **Why:** A method throwing `NotImplementedError` is an application crash. A method returning `{ status: 'unsupported' }` is a branchable control-flow decision. This fulfills the "fail closed" and "honesty over optimism" guardrails. By decoupling observation (reading events via tokens) from transport (streams vs. polls), we allow a local CLI to emulate bounded retrieval via an in-memory ring buffer, while a remote API uses pagination cursors—both seamlessly fulfilling the same contract.

### 2. The Minimal Contract Surface

This pseudocode represents the exact seam `kit-vnext` uses. It assumes no runtime implementation details.

```typescript
// The entry point
interface AgentDriver {
  getCapabilities(): DriverCapabilities;

  // Both return an OperationOutcome to account for driver-level rejection
  startNewRun(configRef: EvidenceRef): Promise<OperationOutcome<DriverSession>>;
  attachToRun(runId: string): Promise<OperationOutcome<DriverSession>>;
}

interface DriverSession {
  readonly id: string;
  readonly ownership: RunOwnership; // Need 1: Modeled ownership

  // Need 6: Bounded retrieval and reconnect
  observe(
    request: ObservationRequest,
  ): Promise<OperationOutcome<ObservationResult>>;

  // State classification
  getRunState(): Promise<RunState>; // Need 3: Modeled unknown/lost states

  // Interactions
  submitInput(
    inputRef: EvidenceRef,
  ): Promise<OperationOutcome<SubmissionReceipt>>;
  answerRequest(
    requestToken: string,
    answerRef: EvidenceRef,
  ): Promise<OperationOutcome<SubmissionReceipt>>;

  // Control
  requestStop(): Promise<OperationOutcome<void>>;
}
```

### 3. Core Data Concepts

To satisfy the safety boundaries and v2 requirements, the data types _must_ express doubt, emulation, and failure.

```typescript
// Need 5: Non-support as inspectable outcomes
type OperationOutcome<T> =
  | { status: "success"; value: T; emulation: "native" | "emulated" }
  | { status: "unsupported"; reason: string }
  | { status: "rejected-by-runtime"; reason: string };

// Need 1: Ownership
type RunOwnership =
  | "owned" // Driven and lifecycle-managed by this kit-vnext instance
  | "remote-owned" // Driven by us, but lifecycle lives on a remote server
  | "observe-only"; // We are watching, we cannot input or stop

// Need 3: Honest State
type RunState =
  | "running"
  | "suspended-awaiting-answer"
  | "terminated"
  | "unknown" // Driver cannot parse the state
  | "lost-contact"; // Network drop, process uncommunicative, etc.

// Opaque reference to an artifact stored elsewhere
type EvidenceRef = string;

// Need 2: Capability claims with basis
type CapabilityLevel = "native" | "emulated" | "unproven" | "absent";

interface CapabilityBasis {
  scope: { runtimeName: string; version: string; configHash: string };
  evidenceRef: EvidenceRef; // Pointer to test runs, docs, or handshake events
}

interface CapabilityClaim {
  level: CapabilityLevel;
  basis: CapabilityBasis;
}

interface DriverCapabilities {
  canStart: CapabilityClaim;
  canAttach: CapabilityClaim;
  canObserve: CapabilityClaim;
  canReceiveInput: CapabilityClaim;
  canAnswerRequests: CapabilityClaim;
  canInterrupt: CapabilityClaim;
}
```

### 4. Operation & Capability Breakdown

- **`attach/start`**
  - **Purpose:** Bootstraps the `DriverSession`.
  - **Guarantees:** Must accurately label `ownership` upon creation.
  - **Degraded behavior:** If `attach` is unsupported (e.g., standard CLI wrapper without a daemon), returns `{ status: 'unsupported' }`.
- **`observe`**
  - **Purpose:** Retrieves provider-visible events.
  - **Input:** `ObservationRequest` (contains optional `sinceToken` and `maxEvents`).
  - **Output:** `ObservationResult` (contains an array of `NormalizedEvent`, a `nextToken`, and a `hasMore` boolean).
  - **Guarantees:** If `sinceToken` is provided, the driver guarantees no dropped or duplicated events _from the perspective of its own awareness_.
- **`submitInput` vs `answerRequest`**
  - **Purpose:** Preserves the critical distinction between throwing information into a run (input) vs. fulfilling a specific permission/action block (answer).
  - **Input:** `submitInput` takes an artifact ref. `answerRequest` requires the exact `requestToken` minted by the runtime during observation.
  - **Degraded behavior:** Attempting to answer a request on an `observe-only` session returns `{ status: 'unsupported' }`.
- **`requestStop`**
  - **Purpose:** Asks the runtime to gracefully halt.
  - **Guarantees:** Does _not_ guarantee the underlying process is dead (that is execution host territory), only that the stop signal was natively issued or cleanly emulated.

### 5. Capability Discovery Model

Drivers do not implement interfaces like `ICanAnswerRequests`. Instead, they return a `DriverCapabilities` object via `getCapabilities()`.

To prevent "capability laundering", a boolean flag is insufficient. Every capability is a `CapabilityClaim`. If a CLI driver claims it can `canInterrupt`, it must provide a `CapabilityBasis` stating: _Scope: (bash-wrapper, v1.0)_, _EvidenceRef: (pointer-to-sigint-handling-tests)_.

`kit-vnext` uses this model to avoid guessing. If `canAnswerRequests.level === 'unproven'`, the core will physically disable the capability to reply to structured requests, preventing the dispatch of answers into the void.

### 6. Event/Message/Request Model

Events returned by `observe()` must separate verified facts from raw output.

```typescript
type NormalizedEvent =
  | { type: "agent-message"; messageRef: EvidenceRef; sequenceId: string }
  | {
      type: "surfaced-request";
      requestToken: string;
      payloadRef: EvidenceRef;
      sequenceId: string;
    }
  | { type: "run-ended"; reason: string; sequenceId: string }
  // Need 4: Normalization failure
  | {
      type: "normalization-failure";
      rawEvidenceRef: EvidenceRef;
      reason: string;
      sequenceId: string;
    };
```

- **Normalization Failure:** If an MCP server emits a custom proprietary RPC notification that the driver cannot map to `agent-message` or `surfaced-request`, it **must not** drop it, and **must not** shove it into an `agent-message`. It yields a `normalization-failure`. `kit-vnext` can log this boundary failure, preserving the evidence.
- **Neutrality:** Notice there is no `ToolCallEvent`. There is a `surfaced-request`. Whether the agent is asking to run a calculator, hit an API, or asking for human permission to overwrite a file, it is merely a request needing an answer.

### 7. Mandatory vs. Optional Parts

- **Mandatory:** `getCapabilities()`, `getRunState()`, and the accurate reporting of `ownership`. A driver _must_ be able to identify itself and report on its connection/state honesty.
- **Optional:** Everything else (`start`, `attach`, `observe`, `submitInput`, `answerRequest`, `requestStop`). If an integration can only dump a final file (final-result-only), its `observe` capability simply returns `{ status: 'unsupported' }`, and `kit-vnext` will wait for `RunState` to become `terminated` before looking for the file.

### 8. Defending Provider-Neutrality

Standard provider shapes are intentionally resisted here:

- **No Streams:** Sockets break. Read streams drop. By forcing `observe(token)`, we decouple the _network reality_ from the _retrieval reality_. A local driver might satisfy this with an array; a remote driver with HTTP range requests.
- **No "Tool" Vocabulary:** "Tool" implies a functional execution. By using `surfaced-request` and `answerRequest`, the core remains agnostic to _what_ is being asked. It just brokers the boundary.
- **No Process IDs or Hard Kills:** `requestStop()` is cooperative. Bounding a run to an OS process is a local-only assumption that breaks the moment you use an Assistants API or an external App Server.

### 9. Left to Other Domains

The following are omitted as they belong to adjacent domains:

- **Storage/References:** How an `EvidenceRef` resolves to a BLOB or DB row.
- **Execution Hosting:** Emitting a SIGKILL to a rogue process tree.
- **Policy/Adjudication:** Deciding _if_ a `surfaced-request` should be approved. The contract merely surfaces the request and accepts the answer.
- **State Persistence:** How `kit-vnext` stores the `sinceToken` across its own reboots.

### 10. Open Questions

1. **Credential Scope During Reconnects:** If a `lost-contact` state persists for hours, and `kit-vnext` attempts to reconnect via `observe(token)`, how is credential rotation passed to the driver if the driver itself holds the transport layer?
2. **Granular Emulation Costs:** The contract surfaces `emulated` as a success state. Should `OperationOutcome` also carry a generic "cost" or "latency" flag for emulated operations, so the core can decide if an emulated feature is too expensive to use routinely?

---

### Self-Check: Tracking the 6 V2 Needs to the Model

1. **Ownership must be reported and verified.** \* _Satisfied by:_ `DriverSession.ownership: RunOwnership` (`'owned' | 'remote-owned' | 'observe-only'`).
2. **A capability claim must carry its basis.** \* _Satisfied by:_ `CapabilityBasis` interface, carrying `scope` and `evidenceRef`.
3. **"Unknown" and "lost contact" must be expressible run states.** \* _Satisfied by:_ `RunState` union explicitly including `'unknown' | 'lost-contact'`.
4. **A failure to normalize must be an expressible event.** \* _Satisfied by:_ `NormalizedEvent` discriminated union including `{ type: 'normalization-failure', rawEvidenceRef, reason }`.
5. **Non-support and degradation must be inspectable outcomes.** \* _Satisfied by:_ Every operational method returning `Promise<OperationOutcome<T>>`, which includes `{ status: 'unsupported' }` and `emulation: 'native' | 'emulated'`.
6. **Bounded retrieval and reconnect must be modeled.** \* _Satisfied by:_ `DriverSession.observe(request: ObservationRequest)` taking a `sinceToken` and returning a `nextToken`.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../README.md) · **← Prev:** [Tooling and CI](../engineering/tooling-and-ci.md) · **Next →:** [Design Proposal: Provider-Neutral Agent Driver Contract (v2)](./gemini35flash.md)

<!-- /DOCS-NAV -->
