import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { capturedRequests, capturedUploads, handlers } from './handlers';

export const server = setupServer(...handlers);

export function setupMswServer(): void {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    capturedRequests.length = 0;
    capturedUploads.length = 0;
  });
  afterAll(() => server.close());
}
