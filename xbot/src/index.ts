export class BridgeObject {
  constructor(_state: DurableObjectState, _env: unknown) {}
}

export default {
  async fetch(request: Request, _env: unknown, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return Response.json({ ok: true, service: 'xbot' });
    }

    return Response.json({ ok: false, error: 'not found' }, { status: 404 });
  },
} satisfies ExportedHandler;
