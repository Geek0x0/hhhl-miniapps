import type { Env } from './env';
import { handleRequest } from './http';

export class BridgeObject {
  constructor(_state: DurableObjectState, _env: Env) {}
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
