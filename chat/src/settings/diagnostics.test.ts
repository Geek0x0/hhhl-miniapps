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

  it('redacts forbidden patterns embedded in detailed identifier fields', () => {
    const { detailed } = createDiagnosticsOutput({
      rooms: {
        activeRoomId: 'room-secret',
        activeRoomName: 'thumbnailUrl=https://cdn.example/private.png',
        pendingStartRoomId: 'Authorization: Bearer secret-token',
      },
      chat: {
        roomId: 'messageIds: ["msg-1"]',
      },
    });

    expect(detailed).toContain('activeRoomId=room-secret');
    expect(detailed).toContain('activeRoomName=[redacted]');
    expect(detailed).toContain('pendingStartRoomId=[redacted]');
    expect(detailed).toContain('chatRoomId=[redacted]');
    expect(detailed).not.toContain('private.png');
    expect(detailed).not.toContain('secret-token');
    expect(detailed).not.toContain('msg-1');
  });

  it('redacts raw Telegram initData-like values', () => {
    const { safe, detailed } = createDiagnosticsOutput({
      raw: 'query_id=abc&user=%7B%22id%22%3A1%7D&auth_date=1&hash=secret&signature=sig',
    });

    expect(safe).toContain('[raw]\n[redacted]');
    expect(detailed).toContain('[raw]\n[redacted]');
    expect(safe).not.toContain('query_id=abc');
    expect(detailed).not.toContain('hash=secret');
  });

  it('redacts encoded Telegram initData-like raw diagnostics', () => {
    const { safe, detailed } = createDiagnosticsOutput({
      raw: 'initData=query_id%3Dabc%26user%3D%257B%2522id%2522%253A1%257D%26auth_date%3D1%26hash%3Dsecret',
    });

    expect(safe).toContain('[raw]\n[redacted]');
    expect(detailed).toContain('[raw]\n[redacted]');
    expect(safe).not.toContain('query_id');
    expect(detailed).not.toContain('hash%3Dsecret');
  });

  it('redacts URL-encoded identifiers from free-form errors', () => {
    const { safe } = createDiagnosticsOutput({
      auth: { username: 'alice@example' },
      rooms: {
        activeRoomName: 'Secret Room',
        error: 'failed for alice%40example in Secret%20Room',
      },
    });

    expect(safe).toContain('roomsError=failed for [redacted] in [redacted]');
    expect(safe).not.toContain('alice%40example');
    expect(safe).not.toContain('Secret%20Room');
  });

  it('redacts over-encoded known identifiers in free-form diagnostics', () => {
    const { safe } = createDiagnosticsOutput({
      auth: { username: 'alice' },
      rooms: { activeRoomId: 'room-secret', error: 'failed al%69ce room%2Dsecret' },
    });

    expect(safe).toContain('roomsError=[redacted]');
    expect(safe).not.toContain('al%69ce');
    expect(safe).not.toContain('room%2Dsecret');
  });

  it('redacts lowercase percent-encoded known identifiers in free-form diagnostics', () => {
    const { safe } = createDiagnosticsOutput({
      rooms: { activeRoomId: 'room/secret', error: 'failed room%2fsecret' },
    });

    expect(safe).toContain('roomsError=failed [redacted]');
    expect(safe).not.toContain('room%2fsecret');
  });

  it('redacts display identifiers case-insensitively from free-form errors', () => {
    const { safe } = createDiagnosticsOutput({
      auth: { username: 'Alice' },
      rooms: { activeRoomName: 'Secret Room', error: 'failed for alice in secret room' },
    });

    expect(safe).toContain('roomsError=failed for [redacted] in [redacted]');
    expect(safe).not.toContain('alice');
    expect(safe).not.toContain('secret room');
  });

  it('redacts route-only room IDs from raw diagnostics', () => {
    const { safe } = createDiagnosticsOutput({
      route: { name: 'room-detail', path: '/rooms/room-secret' },
      raw: 'room-secret failed before stores loaded',
    });

    expect(safe).toContain('[raw]\n[redacted] failed before stores loaded');
    expect(safe).not.toContain('room-secret');
  });

  it('redacts file and media URLs from raw diagnostics', () => {
    const { safe } = createDiagnosticsOutput({
      raw: 'thumbnailUrl=https://dc.hhhl.cc/files/secret-image.png',
    });

    expect(safe).toContain('[raw]\n[redacted]');
    expect(safe).not.toContain('/files/secret-image.png');
  });

  it('redacts media URLs from raw diagnostics', () => {
    const { safe } = createDiagnosticsOutput({
      raw: 'render failed for https://dc.hhhl.cc/media/secret.png',
    });

    expect(safe).toContain('[raw]\n[redacted]');
    expect(safe).not.toContain('/media/secret.png');
  });

  it('redacts mediaUrl fields from raw diagnostics', () => {
    const { safe } = createDiagnosticsOutput({
      raw: 'preview failed mediaUrl=https://dc.hhhl.cc/media/secret.png',
    });

    expect(safe).toContain('[raw]\n[redacted]');
    expect(safe).not.toContain('mediaUrl=');
  });

  it('redacts file and media marker variants from raw diagnostics', () => {
    for (const raw of [
      'failed /drive/files/secret.png',
      'failed downloadUrl=https://dc.hhhl.cc/files/secret.png',
      'failed fileUrl=https://dc.hhhl.cc/files/secret.png',
      'failed mediaUrl=https://dc.hhhl.cc/media/secret.png',
      'failed previewUrl=https://cdn.example/secret.png',
      'failed webUrl=https://cdn.example/secret.png',
    ]) {
      const { safe } = createDiagnosticsOutput({ raw });

      expect(safe).toContain('[raw]\n[redacted]');
      expect(safe).not.toContain('secret.png');
    }
  });

  it('redacts object-log media url fields in raw diagnostics', () => {
    for (const raw of [
      '{"previewUrl":"https://cdn.example/private.png"}',
      'webUrl: https://cdn.example/private.png',
      'downloadUrl : https://cdn.example/private.png',
      'fileUrl = https://cdn.example/private.png',
    ]) {
      const { safe, detailed } = createDiagnosticsOutput({ raw });
      expect(safe).toContain('[raw]\n[redacted]');
      expect(detailed).toContain('[raw]\n[redacted]');
      expect(safe).not.toContain('private.png');
      expect(detailed).not.toContain('private.png');
    }
  });

  it('redacts object-log file url aliases in raw diagnostics', () => {
    for (const raw of [
      '{"url":"https://cdn.example/private.png"}',
      'src: https://cdn.example/private.png',
      'thumbnail = https://cdn.example/private.png',
      'webpublicUrl: https://cdn.example/private.png',
    ]) {
      const { safe, detailed } = createDiagnosticsOutput({ raw });
      expect(safe).toContain('[raw]\n[redacted]');
      expect(detailed).toContain('[raw]\n[redacted]');
      expect(safe).not.toContain('private.png');
      expect(detailed).not.toContain('private.png');
    }
  });

  it('redacts broader token-like free-form diagnostics', () => {
    for (const raw of [
      'Token=secret-token',
      'access_token=secret-token',
      'refresh_token=secret-token',
      'id_token=secret-token',
      'authToken=secret-token',
      'botToken: secret-token',
      'Authorization: Bearer secret-token',
      'Bearer secret-token',
      'token%3Dsecret-token',
    ]) {
      const { safe } = createDiagnosticsOutput({ raw });
      expect(safe).toContain('[raw]\n[redacted]');
      expect(safe).not.toContain('secret-token');
    }
  });

  it('redacts encoded token markers even after malformed percent text', () => {
    const { safe } = createDiagnosticsOutput({ raw: 'bad% token%3Dsecret-token' });
    expect(safe).toContain('[raw]\n[redacted]');
    expect(safe).not.toContain('secret-token');
  });

  it('redacts message ID lists from raw diagnostics', () => {
    const { safe } = createDiagnosticsOutput({
      raw: '{"messageIds":["msg-1","msg-2"]}',
    });

    expect(safe).toContain('[raw]\n[redacted]');
    expect(safe).not.toContain('msg-1');
  });

  it('redacts prose-prefixed message ID lists from raw diagnostics', () => {
    const { safe } = createDiagnosticsOutput({ raw: 'failed messageIds=msg-1,msg-2' });

    expect(safe).toContain('[raw]\n[redacted]');
    expect(safe).not.toContain('msg-1');
  });

  it('redacts object-log message id fields in raw diagnostics', () => {
    for (const raw of ['failed messageIds: ["msg-1"]', 'failed messageId: "msg-1"']) {
      const { safe } = createDiagnosticsOutput({ raw });
      expect(safe).toContain('[raw]\n[redacted]');
      expect(safe).not.toContain('msg-1');
    }
  });

  it('redacts message ID array marker variants from raw diagnostics', () => {
    for (const raw of [
      'failed messageIds[]=msg-1&messageIds[]=msg-2',
      'failed messageIds%5B%5D=msg-1',
      'failed messageId=msg-1',
      'failed messageId%5b%5d=msg-1',
    ]) {
      const { safe } = createDiagnosticsOutput({ raw });

      expect(safe).toContain('[raw]\n[redacted]');
      expect(safe).not.toContain('msg-1');
    }
  });

  it('infers hasUser from normalized identifiers', () => {
    const { safe } = createDiagnosticsOutput({
      auth: { userId: '   ', username: '   ' },
    });

    expect(safe).toContain('hasUser=false');
  });

  it('renders not-set route name when route name is null', () => {
    const { safe } = createDiagnosticsOutput({
      route: { name: null, path: '/settings' },
    });

    expect(safe).toContain('routeName=not-set');
    expect(safe).toContain('routeType=settings');
  });

  it('redacts short identifiers from free-form safe values without corrupting labels', () => {
    const { safe } = createDiagnosticsOutput({
      auth: {
        status: 'authorized',
        hasUser: true,
        userId: 'a',
        username: 'room',
      },
      route: {
        name: 'room-detail',
        path: '/rooms/room-1',
      },
      rooms: {
        roomCount: 1,
        activeRoomId: 'x',
        activeRoomName: 'chat',
        error: 'a room chat x failed',
      },
      chat: {
        loading: false,
        error: 'chat a room x failed',
      },
      raw: 'a room chat x raw',
    });

    expect(safe).toContain('[rooms]');
    expect(safe).toContain('roomCount=1');
    expect(safe).toContain('routeType=room');
    expect(safe).toContain('chatLoading=false');
    expect(safe).toContain('roomsError=[redacted]');
    expect(safe).toContain('chatError=[redacted]');
    expect(safe).toContain('[raw]\n[redacted]');
    expect(safe).not.toContain('a room chat x failed');
    expect(safe).not.toContain('a room chat x raw');
  });

  it('redacts label-like identifiers from free-form safe values without corrupting labels', () => {
    const { safe } = createDiagnosticsOutput({
      auth: { username: 'route' },
      route: { name: 'room-detail', path: '/rooms/room-1' },
      rooms: { roomCount: 2, activeRoomName: 'roomCount', error: 'route roomCount failed' },
    });

    expect(safe).toContain('routeType=room');
    expect(safe).toContain('roomCount=2');
    expect(safe).toContain('roomsError=[redacted] [redacted] failed');
  });

  it('redacts identifiers from the safe section of detailed diagnostics', () => {
    const { detailed } = createDiagnosticsOutput(richDiagnosticsInput());
    const safeSection = detailed.split('[details]')[0];

    expect(safeSection).not.toContain('user-secret');
    expect(safeSection).not.toContain('alice');
    expect(safeSection).not.toContain('room-secret');
    expect(safeSection).not.toContain('Secret Room');
  });

  it('renders legacy status fields', () => {
    const { safe } = createDiagnosticsOutput({
      instanceUrl: 'https://legacy.example',
      realtimeStatus: 'connected',
      storageStatus: 'memory-only',
    });

    expect(safe).toContain('instance=https://legacy.example');
    expect(safe).toContain('realtimeStatus=connected');
    expect(safe).toContain('storageStatus=memory-only');
  });

  it('renders default values for empty input', () => {
    const { safe } = createDiagnosticsOutput();

    expect(safe).toContain('appVersion=not-set');
    expect(safe).toContain('authStatus=not-set');
    expect(safe).toContain('storageStatus=not-set');
    expect(safe).toContain('authError=none');
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
