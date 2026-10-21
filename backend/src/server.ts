import { createServer } from 'node:http';
import { createRequestHandler } from './app.ts';
import { loadProductConfig } from './config.ts';
import * as fixtures from './fixtures.ts';
import { createStore } from './store.ts';

// Temporary fixture-backed API. Replaced by real integrations in build order step 6.
const DEFAULT_PORT = 4000;
const port = Number(process.env.PORT ?? DEFAULT_PORT);

const store = createStore(loadProductConfig(), fixtures, {
  connectionDelayMs: fixtures.sampleConnectionDelayMs,
});
const server = createServer(createRequestHandler(store));

server.listen(port, () => {
  console.log(`backend listening on http://localhost:${port} (sample data)`);
});
