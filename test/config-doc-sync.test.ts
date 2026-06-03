import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface SchemaProperty {
  path: string;
  node: Record<string, unknown>;
}

interface DocRow {
  path: string;
  type: string;
  defaultValue: string;
}

function collectProperties(node: unknown, acc: SchemaProperty[], prefix = ''): SchemaProperty[] {
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj.properties && typeof obj.properties === 'object') {
      for (const key of Object.keys(obj.properties as Record<string, unknown>)) {
        const path = prefix ? `${prefix}.${key}` : key;
        const child = (obj.properties as Record<string, unknown>)[key] as Record<string, unknown>;
        if (child.properties && typeof child.properties === 'object') {
          collectProperties(child, acc, path);
        } else {
          acc.push({ path, node: child });
        }
      }
    }
  }
  return acc;
}

function parseDocRows(markdown: string): DocRow[] {
  const rows: DocRow[] = [];
  let sectionPrefix = '';

  for (const line of markdown.split('\n')) {
    const section = line.match(/^## `([^`]+)`/);
    if (section) {
      sectionPrefix = section[1] ?? '';
      continue;
    }
    if (line.startsWith('## Top level')) {
      sectionPrefix = '';
      continue;
    }
    if (!line.startsWith('| `') || line.includes('| --- |')) continue;

    const cells = splitMarkdownRow(line);
    if (cells.length < 3) continue;

    const key = stripCode(cells[0] ?? '');
    rows.push({
      path: sectionPrefix ? `${sectionPrefix}.${key}` : key,
      type: cells[1] ?? '',
      defaultValue: stripCode(cells[2] ?? ''),
    });
  }

  return rows;
}

function splitMarkdownRow(line: string): string[] {
  const escapedPipe = '\u0000';
  return line
    .slice(1, -1)
    .replaceAll('\\|', escapedPipe)
    .split('|')
    .map((cell) => cell.replaceAll(escapedPipe, '|').trim());
}

function stripCode(value: string): string {
  return value.replace(/^`|`$/g, '');
}

function expectedDefault(node: Record<string, unknown>): string | undefined {
  if ('default' in node) return formatDefault(node.default);
  if ('const' in node) return formatDefault(node.const);
  return undefined;
}

function formatDefault(value: unknown): string {
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (value === null) return 'null';
  return String(value);
}

function documentedEnums(type: string): string[] {
  return [...type.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? '').filter((value) => value !== '');
}

describe('config-schema.md stays in sync with config.schema.json', () => {
  const schema = JSON.parse(readFileSync('references/config.schema.json', 'utf8'));
  const doc = readFileSync('references/config-schema.md', 'utf8');
  const schemaProperties = collectProperties(schema, []);
  const docRows = parseDocRows(doc);

  it('documents every schema property', () => {
    const documented = new Set(docRows.map((row) => row.path));
    const missing = schemaProperties.map((property) => property.path).filter((path) => !documented.has(path));
    expect(missing).toEqual([]);
  });

  it('does not document fields that are absent from the schema', () => {
    const schemaPaths = new Set(schemaProperties.map((property) => property.path));
    const stale = docRows.map((row) => row.path).filter((path) => !schemaPaths.has(path));
    expect(stale).toEqual([]);
  });

  it('documents schema defaults exactly', () => {
    const rowsByPath = new Map(docRows.map((row) => [row.path, row]));
    const mismatches = schemaProperties.flatMap((property) => {
      const expected = expectedDefault(property.node);
      const actual = rowsByPath.get(property.path)?.defaultValue;
      return expected !== undefined && actual !== expected ? [{ path: property.path, expected, actual }] : [];
    });

    expect(mismatches).toEqual([]);
  });

  it('documents enum members exactly', () => {
    const rowsByPath = new Map(docRows.map((row) => [row.path, row]));
    const mismatches = schemaProperties.flatMap((property) => {
      const expected = Array.isArray(property.node.enum) ? (property.node.enum as string[]) : [];
      if (expected.length === 0) return [];

      const actual = documentedEnums(rowsByPath.get(property.path)?.type ?? '');
      return actual.join('\0') === expected.join('\0') ? [] : [{ path: property.path, expected, actual }];
    });

    expect(mismatches).toEqual([]);
  });
});
