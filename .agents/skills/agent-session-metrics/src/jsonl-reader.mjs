import { readFile } from 'node:fs/promises';

export async function readJsonlFile(filePath) {
  const text = await readFile(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const records = [];
  const warnings = [];
  let lineCount = 0;
  let invalidJsonLines = 0;

  for (const [index, line] of lines.entries()) {
    if (!line.trim()) {
      continue;
    }
    lineCount += 1;
    try {
      records.push({ lineNumber: index + 1, value: JSON.parse(line) });
    } catch {
      invalidJsonLines += 1;
      warnings.push(`Invalid JSON at line ${index + 1}`);
    }
  }

  return {
    records,
    warnings,
    stats: {
      lineCount,
      invalidJsonLines,
    },
  };
}
