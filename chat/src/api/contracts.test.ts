import { describe, expect, it } from 'vitest';
import {
  assertEndpointHasParams,
  getEndpointContract,
  getRuntimeContracts,
  requiredEndpointNames,
} from './endpointContracts';

const expectedParams: Record<string, string[]> = {
  'chat/messages/create-to-room': ['text', 'fileId', 'toRoomId', 'replyId', 'quoteId'],
  'chat/messages/room-timeline': ['limit', 'sinceId', 'untilId', 'roomId'],
  'chat/rooms/show': ['roomId'],
  'chat/rooms/join': ['roomId'],
  'chat/rooms/members': ['roomId', 'limit', 'sinceId', 'untilId'],
  'chat/messages/search': ['query', 'limit', 'untilId', 'userId', 'roomId'],
  'chat/rooms/create': ['name', 'description', 'joinMode'],
  'drive/files/create': ['folderId', 'name', 'comment', 'isSensitive', 'force'],
  'miauth/gen-token': ['session', 'name', 'description', 'iconUrl', 'permission', 'grantees', 'rank'],
  'users/show': ['userId', 'userIds', 'username', 'host', 'detail'],
};

describe('endpoint contracts', () => {
  it('contains every endpoint required by the chat mini app', () => {
    for (const endpoint of requiredEndpointNames) {
      expect(getEndpointContract(endpoint), endpoint).toBeDefined();
    }
  });

  it('matches required parameter names for critical endpoints', () => {
    for (const [endpoint, params] of Object.entries(expectedParams)) {
      expect(() => assertEndpointHasParams(endpoint, params)).not.toThrow();
    }
  });

  it('exposes runtime contract values without concrete tokens', () => {
    const runtime = getRuntimeContracts();

    expect(runtime.miauthCheckPathPattern).toBe('/api/miauth/{session}/check');
    expect(runtime.streamingUrlPattern).toBe('wss://dc.hhhl.cc/streaming?i={token}');
    expect(runtime.streamConnectMessage.body.channel).toBe('main');
    expect(runtime.streamChannelEnvelope.type).toBe('ch');
    expect(runtime.driveUploadEndpoint).toBe('/api/drive/files/create');
    expect(JSON.stringify(runtime)).not.toContain('secret-token');
  });
});
