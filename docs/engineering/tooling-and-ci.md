# Tooling and CI

CI should enforce:

- dependency rules for the SDK-centered package model;
- typecheck across all packages;
- unit and integration tests;
- conformance tests for providers and testkit mocks;
- package dry run;
- smoke tests only behind explicit gating.

The SDK package should remain free of provider SDKs and executable wrapper dependencies.
