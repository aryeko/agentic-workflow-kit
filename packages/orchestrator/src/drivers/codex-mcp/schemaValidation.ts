import { isRecord } from '../../internal/guards.js';

export interface McpTool {
  name: string;
  inputSchema: Record<string, unknown>;
  [key: string]: unknown;
}

const REQUIRED_APPROVAL_POLICIES = ['never', 'on-failure', 'on-request', 'untrusted'] as const;
const REQUIRED_SANDBOX_MODES = ['danger-full-access', 'read-only', 'workspace-write'] as const;

export function validateCodexToolSchemas(tools: McpTool[]): void {
  const codex = tools.find((tool) => tool.name === 'codex');
  if (!codex) {
    throw new Error('Codex MCP server must expose a codex tool');
  }
  if (codex.inputSchema?.type !== 'object') {
    throw new Error('Codex MCP codex tool must declare an object input schema');
  }
  const properties = codex.inputSchema.properties;
  if (!isRecord(properties) || !isRecord(properties.prompt)) {
    throw new Error('Codex MCP codex tool must declare a prompt input property');
  }

  requireProperty(properties, 'model');
  requireProperty(properties, 'config');
  const approvalPolicy = requireProperty(properties, 'approval-policy');
  const sandbox = requireProperty(properties, 'sandbox');

  validateEnumIfPresent(approvalPolicy, REQUIRED_APPROVAL_POLICIES, 'approval-policy');
  validateEnumIfPresent(sandbox, REQUIRED_SANDBOX_MODES, 'sandbox');
}

function requireProperty(properties: Record<string, unknown>, propertyName: string): unknown {
  if (!(propertyName in properties)) {
    const article = propertyName === 'approval-policy' ? 'an' : 'a';
    throw new Error(`Codex MCP codex tool must declare ${article} ${propertyName} input property`);
  }
  return properties[propertyName];
}

function validateEnumIfPresent(schema: unknown, requiredValues: readonly string[], propertyName: string): void {
  if (!isRecord(schema) || schema.enum === undefined) {
    return;
  }
  if (!Array.isArray(schema.enum)) {
    throw new Error(`Codex MCP ${propertyName} input enum must be an array`);
  }
  const values = new Set(schema.enum);
  for (const required of requiredValues) {
    if (!values.has(required)) {
      throw new Error(`Codex MCP ${propertyName} input enum must include "${required}"`);
    }
  }
}
