import { describe, expect, it } from 'vitest';
import { createDiagnosticsOutput, routeTypeFromPath } from './diagnostics';

function richDiagnosticsInput() {
  return {
    environment: {
      appVersion: '0.3.10',
      mode: 'test',
      isDev: false,
      instanceUrl: 'https://dc.hhhl.cc',
      telegramPresent: true,
      telegramPlatform: 'android',
    },
    auth: {
      status: 'authorized',
      hasUser: true,
      userId: 'user-secret',
      username: 'alice',
      error: 'auth failed for user-secret token=auth-token',
    },
    route: {
      name: 'room-detail',
      path: '/rooms/room-secret?i=query-token',
    },
    realtime: {
      status: 'degraded',
      roomId: 'room-secret',
    },
    storage: {
      status: 'available',
    },
    rooms: {
      loading: false,
      roomCount: 3,
      invitationCount: 2,
      activeRoomId: 'room-secret',
      activeRoomName: 'Secret Room',
      pendingStartRoomId: 'room-pending',
      memberCount: 7,
      outboxInvitationCount: 4,
      error: 'room-secret Secret Room room failed &i=room-token',
    },
    chat: {
      loading: false,
      roomId: 'room-secret',
      timelineCount: 12,
      outgoingCount: 2,
      failedOutgoingCount: 1,
      searchResultCount: 5,
      keySearchResultCount: 1,
      replyTargetPresent: true,
      quoteTargetPresent: false,
      error: 'chat failed token=chat-token',
      searchError: 'search failed for alice',
      keySearchError: 'key search failed',
    },
    raw: 'token=raw-token &i=raw-query {"token":"json-token"} user-secret alice room-secret Secret Room',
  };
}

describe('diagnostics renderer', () => {
  it('renders safe diagnostics without user or room identifiers', () => {
    const { safe } = createDiagnosticsOutput(richDiagnosticsInput());

    expect(safe).toContain('[environment]');
    expect(safe).toContain('appVersion=0.3.10');
    expect(safe).toContain('mode=test');
    expect(safe).toContain('dev=false');
    expect(safe).toContain('instance=https://dc.hhhl.cc');
    expect(safe).toContain('telegramPresent=true');
    expect(safe).toContain('telegramPlatform=android');
    expect(safe).toContain('[auth]');
    expect(safe).toContain('authStatus=authorized');
    expect(safe).toContain('hasUser=true');
    expect(safe).toContain('[route]');
    expect(safe).toContain('routeName=room-detail');
    expect(safe).toContain('routeType=room');
    expect(safe).toContain('isRoomRoute=true');
    expect(safe).toContain('[realtime]');
    expect(safe).toContain('realtimeStatus=degraded');
    expect(safe).toContain('[storage]');
    expect(safe).toContain('storageStatus=available');
    expect(safe).toContain('[rooms]');
    expect(safe).toContain('roomLoading=false');
    expect(safe).toContain('roomCount=3');
    expect(safe).toContain('invitationCount=2');
    expect(safe).toContain('[chat]');
    expect(safe).toContain('chatLoading=false');
    expect(safe).toContain('timelineCount=12');
    expect(safe).toContain('outgoingCount=2');
    expect(safe).toContain('searchResultCount=5');
    expect(safe).toContain('keySearchResultCount=1');
    expect(safe).toContain('[errors]');
    expect(safe).toContain('token=[redacted]');
    expect(safe).toContain('&i=[redacted]');
    expect(safe).toContain('"token":"[redacted]"');
    expect(safe).not.toContain('user-secret');
    expect(safe).not.toContain('alice');
    expect(safe).not.toContain('room-secret');
    expect(safe).not.toContain('Secret Room');
    expect(safe).not.toContain('auth-token');
    expect(safe).not.toContain('room-token');
    expect(safe).not.toContain('chat-token');
    expect(safe).not.toContain('raw-token');
    expect(safe).not.toContain('json-token');
  });

  it('renders detail diagnostics with allowed identifiers and redacted secrets', () => {
    const { detailed } = createDiagnosticsOutput(richDiagnosticsInput());

    expect(detailed).toContain('[details]');
    expect(detailed).toContain('userId=user-secret');
    expect(detailed).toContain('username=alice');
    expect(detailed).toContain('activeRoomId=room-secret');
    expect(detailed).toContain('activeRoomName=Secret Room');
    expect(detailed).toContain('pendingStartRoomId=room-pending');
    expect(detailed).toContain('chatRoomId=room-secret');
    expect(detailed).toContain('memberCount=7');
    expect(detailed).toContain('outboxInvitationCount=4');
    expect(detailed).toContain('replyTargetPresent=true');
    expect(detailed).toContain('quoteTargetPresent=false');
    expect(detailed).toContain('failedOutgoingCount=1');
    expect(detailed).toContain('token=[redacted]');
    expect(detailed).toContain('&i=[redacted]');
    expect(detailed).toContain('"token":"[redacted]"');
    expect(detailed).not.toContain('auth-token');
    expect(detailed).not.toContain('room-token');
    expect(detailed).not.toContain('chat-token');
    expect(detailed).not.toContain('raw-token');
    expect(detailed).not.toContain('json-token');
  });

  it('classifies known route paths', () => {
    expect(routeTypeFromPath('/')).toBe('root');
    expect(routeTypeFromPath('/rooms')).toBe('rooms');
    expect(routeTypeFromPath('/rooms/room-1')).toBe('room');
    expect(routeTypeFromPath('/settings')).toBe('settings');
    expect(routeTypeFromPath('/auth/callback')).toBe('auth-callback');
    expect(routeTypeFromPath('/bot-tools')).toBe('other');
  });
});
