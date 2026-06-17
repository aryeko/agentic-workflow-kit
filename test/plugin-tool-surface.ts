import { expect } from 'vitest';

export const PRODUCT_MCP_TOOLS = [
  'workflow_runtime_info',
  'workflow_config_status',
  'workflow_config_upgrade',
  'workflow_project_inspect',
  'workflow_run_preview',
  'workflow_run_status',
  'workflow_run_stream',
  'workflow_run_inspect',
  'workflow_run_report',
  'workflow_run_export',
  'workflow_run_control',
  'workflow_child_reply',
  'workflow_child_interrupt',
  'workflow_driver_check',
  'workflow_tracker_validate',
  'workflow_tracker_migrate',
] as const;

export const LEGACY_MCP_TOOLS = [
  'list_tracks',
  'list_stories',
  'list_eligible',
  'run_eligible',
  'run_story',
  'watch_run',
  'watch_run_start',
  'watch_run_poll',
  'watch_run_stop',
  'codex_reply',
  'codex_interrupt',
  'analyze_run',
  'check_codex_mcp',
] as const;

export const EXPECTED_MCP_TOOLS = [...PRODUCT_MCP_TOOLS, ...LEGACY_MCP_TOOLS] as const;

export function expectWorkflowKitMcpTools(toolNames: string[]): void {
  expect(new Set(toolNames).size).toBe(toolNames.length);
  expect([...toolNames].sort()).toEqual([...EXPECTED_MCP_TOOLS].sort());
}
