import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../src/api/__fixtures__/runtime-contracts.json');

const runtimeContracts = {
  miauthCheckPathPattern: '/api/miauth/{session}/check',
  streamingUrlPattern: 'wss://dc.hhhl.cc/streaming?i={token}',
  streamConnectMessage: {
    type: 'connect',
    body: {
      channel: 'main',
      id: 'test-main',
      params: {},
      pong: true,
    },
  },
  streamChannelEnvelope: {
    type: 'ch',
    body: {
      id: 'test-main',
      type: 'eventName',
      body: {},
    },
  },
  driveUploadEndpoint: '/api/drive/files/create',
};

async function main() {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(runtimeContracts, null, 2)}\n`);
  console.log('runtime-contracts');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
