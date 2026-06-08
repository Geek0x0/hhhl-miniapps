import type { Env } from './env';
import { handleRequest } from './http';
export { BridgeObject } from './realtime/BridgeObject';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
