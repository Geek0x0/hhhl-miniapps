import endpointContractsJson from './__fixtures__/endpoint-contracts.json';
import runtimeContractsJson from './__fixtures__/runtime-contracts.json';

export interface EndpointParamContract {
  name: string;
  type: string;
}

export interface EndpointContract {
  endpoint: string;
  params: EndpointParamContract[];
}

export interface RuntimeContracts {
  miauthCheckPathPattern: string;
  streamingUrlPattern: string;
  streamConnectMessage: {
    type: string;
    body: {
      channel: string;
      id: string;
      params: Record<string, unknown>;
      pong: boolean;
    };
  };
  streamChannelEnvelope: {
    type: string;
    body: {
      id: string;
      type: string;
      body: Record<string, unknown>;
    };
  };
  driveUploadEndpoint: string;
}

export const requiredEndpointNames = [
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
] as const;

const endpointContracts = endpointContractsJson as Record<string, EndpointContract>;
const runtimeContracts = runtimeContractsJson as RuntimeContracts;

export function getEndpointContract(endpoint: string): EndpointContract | undefined {
  return endpointContracts[endpoint];
}

export function assertEndpointHasParams(endpoint: string, params: string[]): void {
  const contract = getEndpointContract(endpoint);
  if (contract == null) {
    throw new Error(`Missing endpoint contract: ${endpoint}`);
  }

  const actual = contract.params.map((param) => param.name);
  for (const param of params) {
    if (!actual.includes(param)) {
      throw new Error(`Endpoint ${endpoint} missing param ${param}`);
    }
  }
}

export function getRuntimeContracts(): RuntimeContracts {
  return runtimeContracts;
}
