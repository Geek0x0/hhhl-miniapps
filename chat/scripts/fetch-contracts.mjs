import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const requiredEndpoints = [
  'i',
  'miauth/gen-token',
  'chat/history',
  'chat/rooms/create',
  'chat/rooms/delete',
  'chat/rooms/invitations/create',
  'chat/rooms/invitations/ignore',
  'chat/rooms/invitations/inbox',
  'chat/rooms/invitations/outbox',
  'chat/rooms/join',
  'chat/rooms/joining',
  'chat/rooms/leave',
  'chat/rooms/members',
  'chat/rooms/mute',
  'chat/rooms/owned',
  'chat/rooms/show',
  'chat/rooms/update',
  'chat/messages/context',
  'chat/messages/create-to-room',
  'chat/messages/delete',
  'chat/messages/react',
  'chat/messages/room-timeline',
  'chat/messages/search',
  'chat/messages/show',
  'chat/messages/unreact',
  'drive/files/create',
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../src/api/__fixtures__/endpoint-contracts.json');

async function fetchEndpointContract(endpoint) {
  const response = await fetch('https://dc.hhhl.cc/api/endpoint', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch contract for ${endpoint}: HTTP ${response.status}`);
  }

  const contract = await response.json();
  return {
    endpoint,
    params: Array.isArray(contract.params)
      ? contract.params.map((param) => ({ name: param.name, type: param.type }))
      : [],
  };
}

async function main() {
  const contracts = {};

  for (const endpoint of requiredEndpoints) {
    const contract = await fetchEndpointContract(endpoint);
    contracts[endpoint] = contract;
    console.log(endpoint);
  }

  const sortedContracts = Object.fromEntries(Object.entries(contracts).sort(([left], [right]) => left.localeCompare(right)));

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(sortedContracts, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
