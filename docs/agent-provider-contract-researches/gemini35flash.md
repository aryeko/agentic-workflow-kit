# Design Proposal: Provider-Neutral Agent Driver Contract (v2)

This proposal outlines the technical architecture for the **kit-vnext** agent driver seam. It establishes a deterministic, type-safe boundary between the control plane and highly variable agent runtimes (such as OpenAI Assistants API, Model Context Protocol (MCP) servers, local CLI loops, or mock test harnesses) without overfitting to any single provider's execution model.

---

## 1. Recommended Abstraction Shape & Rationale

We reject a single monolithic interface because it forces weaker runtimes to implement stubs that either throw exceptions or fake success (capability laundering). It also tricks the control plane into expecting uniform behavior across all backends.

Instead, this design utilizes a **Capability-Negotiated Session Factory** pattern. The control plane interacts with a stateless factory to query capabilities or establish an isolated session handle. Crucially, a session handle does not guarantee any action will succeed natively; it guarantees that it can honestly report _what_ it can do, _why_ it can do it, and return inspectable data values when an operation cannot be fulfilled.

### Why this shape?

- **Decouples Presence from Execution:** The control plane inspects a driver's capability matrix _before_ dispatching work, failing closed if a mandatory capability is unproven or absent.
- **State Isolation:** It treats sessions as ephemeral or durable handles based entirely on the driver's verified ownership state, preventing control leakage.
- **Polymorphism over Subtyping:** We avoid dividing runtimes into separate sub-interfaces (e.g., `ObservableDriver`, `ControllableDriver`). Instead, every driver implements the same uniform surface but returns explicit runtime capability profiles.

---

## 2. The Minimal Contract Surface

The entire seam is governed by two core structural interfaces defined below in TypeScript-like pseudocode.

```typescript
export interface AgentDriver {
  readonly driverId: string;

  // Audits capabilities prior to session creation
  queryCapabilities(scope: DiscoveryScope): Promise<CapabilityMatrix>;

  // Session lifecycle hooks
  initialize(config: SessionConfig): Promise<OperationResult<AgentSession>>;
  attach(sessionId: string, scope: DiscoveryScope): Promise<OperationResult<AgentSession>>;
}

export interface AgentSession {
  readonly sessionId: string;

  // Real-time metadata and invariant safety checks
  getOwnership(): OwnershipReport;
  getLatestState(): RunStateReport;

  // Asynchronous Event Pipeline
  observe(options?: ObserveOptions): AsyncIterable<DriverEvent | NormalizationFailureEvent>;

  // Structured Control Plane Interventions
  submitInput(input: WorkItemInput): Promise<OperationResult<void>>;
  answerRequest(requestId: string, answer: RequestAnswer): Promise<OperationResult<void>>;
  signalControl(signal: ControlSignal): Promise<OperationResult<ControlAcknowledgement>>;
}

3. Core Data Concepts
The structural primitives driving this contract are explicitly modeled to avoid stringly-typed or optimistic assumptions:
// Distinct, branded type for historical replay/resume
export type OrderingToken = string & { readonly __brand: unique symbol };

export type CapabilityStatus = 'Native' | 'Emulated' | 'Claimed' | 'Unproven' | 'Absent';

export type OwnershipClassification = 'Owned' | 'RemoteOwned' | 'ObserveOnly';

export type RunState = 'Running' | 'Suspended' | 'Completed' | 'Terminated' | 'Unknown' | 'LostContact';

export interface DiscoveryScope {
  runtime: string;      // e.g., "openai-assistants", "mcp-stdio-server"
  version: string;      // e.g., "2026-03-01", "v1.2.4"
  configuration: Record<string, unknown>;
}

export interface CapabilityBasis {
  status: CapabilityStatus;
  scope: DiscoveryScope;
  evidenceRef: string;  // Content-addressable pointer to audit logs, schemas, or test runs
}

export interface CapabilityMatrix {
  canSubmitInput: CapabilityBasis;
  canObserveStreams: CapabilityBasis;
  canBoundedReplay: CapabilityBasis;
  canAnswerRequests: CapabilityBasis;
  canInterrupt: CapabilityBasis;
}

// Discriminated Union representing inspectable operation results
export type OperationResult<T> =
  | { status: 'Success'; value: T; execution: 'Native' | 'Emulated' }
  | { status: 'Unsupported'; reason: string }
  | { status: 'RejectedByRuntime'; diagnosticsRef: string }
  | { status: 'PermissionDenied'; classification: OwnershipClassification };

4. Operation Specifications & Degradation Behaviors
submitInput
• Purpose: Send new, discrete work boundaries or additional conversational text to the runtime.
• High-Level Input: WorkItemInput (Contains a tracking ID and a StorageReference to the payload content).
• High-Level Output: Promise<OperationResult<void>>
• Required Guarantees: Must reject execution immediately if the underlying session status is ObserveOnly.
• Degraded/Unsupported Behavior: Returns a value-typed { status: 'Unsupported' } variant rather than throwing an unmanaged exception.
observe
• Purpose: Stream normalized logs, milestones, or structured runtime requests out of the agent workspace.
• High-Level Input: ObserveOptions (Optional since: OrderingToken for bounded reconnects).
• High-Level Output: An async iterable stream yielding DriverEvent or NormalizationFailureEvent.
• Required Guarantees: Yielded events must provide an OrderingToken if replayability is supported.
• Degraded/Unsupported Behavior: If passed an OrderingToken on a driver where canBoundedReplay is Absent, the stream yields a terminal error event or the initialization fails with { status: 'Unsupported' }.
answerRequest
• Purpose: Resolve a blocking execution suspension generated by the agent (e.g., tool validation, human-in-the-loop gate).
• High-Level Input: requestId: string, answer: RequestAnswer (maps back to an explicit request event).
• High-Level Output: Promise<OperationResult<void>>
• Required Guarantees: Must explicitly report a failure variant if the run context cannot correlate the answer to that exact request ID.
• Degraded/Unsupported Behavior: Returns a { status: 'RejectedByRuntime' } if the connection channel is severed or if the runtime has already moved past the target state.
5. Capability Discovery Model
Drivers cannot expose a static, hardcoded list of capabilities. Every capability claim must travel with its evaluation criteria so the core plane can safely audit it.
export interface OwnershipReport {
  classification: OwnershipClassification;
  verifiedAt: Date;
  verificationEvidenceRef: string; // Proof of cryptographic session possession or process affinity
}

When a driver declares a capability as Native, it must provide a CapabilityBasis pointing to concrete evaluation evidence (e.g., an MCP server's schema emission or a known vendor API version matrix).
If an operation is marked Emulated (for instance, a local CLI driver simulating an "interrupt" signal by wrapping process suspension), the core can inspect the execution field in the OperationResult to determine whether it trusts driver emulation for that specific security zone.
6. Event, Message, and Request Model (Normalization)
Runtimes emit radically divergent event payloads. The driver's primary responsibility is mapping these payloads to kit-vnext's clean vocabulary without dropping metadata or hiding structural anomalies.
export type DriverEvent =
  | { type: 'StateTransition'; from: RunState; to: RunState; timestamp: Date }
  | { type: 'WorkProduced'; artifactRef: string; timestamp: Date }
  | { type: 'SurfacedRequest'; requestId: string; correlationId: string; requestContextRef: string; timestamp: Date }
  | { type: 'ObservationLogged'; severity: 'info' | 'warn'; messageRef: string; timestamp: Date };

export interface NormalizationFailureEvent {
  type: 'NormalizationFailure';
  failedEventId: string;
  rawPayloadRef: string;       // Original unchanged payload stored safely out-of-band
  targetCategoryHint: string;  // e.g., "Attempted to parse as SurfacedRequest"
  timestamp: Date;
}

Handling Normalization Failures
If an underlying runtime emits a malformed or non-compliant payload, the driver must not guess or map it to a generic text observation log. It emits a NormalizationFailureEvent, capturing the un-parsed content via a safe reference (rawPayloadRef). The core plane detects the normalization edge failure and can trigger a safe halt or audit gap alarm.
7. Mandatory vs. Optional Parts of the Contract
Section of Contract	Status	Core Plane Enforcement Strategy
Capability Matrix Declaration	Mandatory	Every driver must implement queryCapabilities. Returning an empty structure results in an immediate load failure.
Ownership Status Verification	Mandatory	Sessions must declare their OwnershipClassification. ObserveOnly dynamically locks mutations.
Bounded Reconnect (OrderingToken)	Optional	Indicated via canBoundedReplay. Drivers without this capability return an inspectable Unsupported error code if a token is supplied.
Structured Request Targeting	Optional	Tracked via canAnswerRequests. If absent, the control plane knows it cannot intercept or respond to running requests.
8. Alignment with Design Principles (Provider-Neutrality)
To resist inheriting structure from specific vendor surfaces, this design establishes several explicit structural defenses:
• Anti-MCP Bias: MCP is heavily built around JSON-RPC notifications and tool-centric schemas. This contract omits the word "tool" entirely, standardizing instead on SurfacedRequest. A request might be a tool invocation, a human-in-the-loop validation, or an approval gating constraint.
• Anti-OpenAI Assistants Bias: The OpenAI Assistants API couples state persistence and execution tightly into its "Thread" and "Run" resource state machines. We avoid tracking vendor states like cancelling or requires_action. Instead, we flatten runtime state down into a deterministic, queryable RunStateReport, isolating server-side orchestration logic behind our driver interface.
• Anti-CLI/Stream Bias: We avoid assuming a live local process tree or open UNIX sockets. By enforcing the use of OrderingToken and out-of-band StorageReferences, the driver works identically whether it's consuming an active stdio buffer or polling a stateless webhook queue.
9. Domain Boundaries (What is Intentionally Left Out)
To remain maintainable, this contract explicitly pushes adjacent problems out of the driver seam:
• Execution Infrastructure: The contract handles signaling (signalControl), but actually spinning up environments, tracking process limits, or executing docker sandboxes belongs entirely to an external Execution Host domain.
• Policy & Adjudication: The contract surfaces a request; it does not determine whether an agent should be allowed to execute that request. Security clearance, RBAC, and payload analysis belong strictly to kit-vnext's policy engine.
• Payload Persistence: Drivers never hold or transmit large string logs, file text, or system traces directly. They interact with an isolated storage layer to write raw blobs and return stateless artifactRef URIs.
10. Open Questions
1. Token Lifetime and Eviction: When a remote runtime suffers a prolonged disconnect, how long must a driver preserve or honor an OrderingToken before it expires, and how should that expiration be communicated down the event stream?
2. Evidence Schema Standardization: While CapabilityBasis requires an evidenceRef, we have not standardized the internal structural format of the target evidence record. Should it use cryptographic checksums of driver binaries or rely on declarative manifest verification?
Architectural Self-Check Matrix
This matrix verifies full structural compliance against the six critical modeled needs outlined in the design handoff:
Required Modeled Need	Exact Type / Code Unit Satisfying the Need	Rationale / Verification
1. Ownership Verification	OwnershipReport returning OwnershipClassification (Owned | RemoteOwned | ObserveOnly).	Ownership is explicitly computed and declared by the driver, structurally gating control interventions.
2. Capability Claim Basis	CapabilityBasis struct containing explicit DiscoveryScope details and an auditing evidenceRef.	Guarantees that capability claims carry verifiable provenance, preventing hardcoded driver assumptions.
3. Honest Unknown State	RunState enum explicitly defining the Unknown and LostContact members.	Prevents the driver from guessing or optimizing status states when contact with a remote cluster or process is lost.
4. Normalization Failure	Dedicated structural type NormalizationFailureEvent containing rawPayloadRef.	Structural boundaries are preserved; unmappable vendor schemas are exposed explicitly to the core plane rather than dropped.
5. Inspectable Non-Support	Methods wrap execution statuses inside value-typed OperationResult tagged unions rather than throwing exceptions.	Converts "No" into an inspectable runtime data value, removing the need for fragile catch-and-retry blocks in core logic.
6. Bounded Retrieval	OrderingToken unique brand passed through ObserveOptions to resume streams seamlessly.	Models disconnected stream boundaries safely without assuming an infinite, uninterrupted socket connection.
```
