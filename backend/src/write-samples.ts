// Writes the sample statements to samples/ at the repo root, as CSV files to
// upload by hand when showing the app. The app itself never offers them.
// Run: npm run samples -w backend
import { mkdirSync, writeFileSync } from 'node:fs';
import { sampleFiles } from './fixtures.ts';

const dir = new URL('../../samples/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const file of sampleFiles) {
  writeFileSync(new URL(file.name, dir), file.csv);
  console.log(`samples/${file.name}`);
}
