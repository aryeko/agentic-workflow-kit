import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeConfigJsonSchema } from './jsonSchema.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, '../../../../references/config.schema.json');
writeFileSync(target, serializeConfigJsonSchema());
console.error(`wrote ${target}`);
