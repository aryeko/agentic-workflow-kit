export function renderJson(report, { pretty = false } = {}) {
  return `${JSON.stringify(report, null, pretty ? 2 : 0)}\n`;
}
