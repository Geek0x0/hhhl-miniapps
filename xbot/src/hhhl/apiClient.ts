import type { EndpointParams, HhhlEndpointCaller, HhhlFetch } from './types';

export interface HhhlApiClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: HhhlFetch;
}

export class HhhlApiClient implements HhhlEndpointCaller {
  private readonly baseUrl: string;
  private readonly fetchImpl: HhhlFetch;
  private readonly token: string;

  constructor(options: HhhlApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  async callEndpoint<TResponse = unknown>(endpoint: string, params: EndpointParams = {}): Promise<TResponse> {
    const normalizedEndpoint = normalizeEndpoint(endpoint);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/${normalizedEndpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...params, i: this.token }),
      });
    } catch {
      throw new Error(`HHHL endpoint ${normalizedEndpoint} failed`);
    }

    return parseJsonResponse<TResponse>(response, `HHHL endpoint ${normalizedEndpoint}`);
  }

  async uploadFile<TResponse = unknown>(formData: FormData): Promise<TResponse> {
    const uploadData = new FormData();
    for (const [key, value] of formData.entries()) {
      uploadData.append(key, value);
    }
    uploadData.set('i', this.token);
    uploadData.set('force', 'true');

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/drive/files/create`, {
        method: 'POST',
        body: uploadData,
      });
    } catch {
      throw new Error('HHHL upload failed');
    }

    return parseJsonResponse<TResponse>(response, 'HHHL upload');
  }
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/^\/+/, '');
}

async function parseJsonResponse<TResponse>(response: Response, operation: string): Promise<TResponse> {
  if (!response.ok) {
    throw new Error(`${operation} failed with status ${response.status}`);
  }

  try {
    return (await response.json()) as TResponse;
  } catch {
    throw new Error(`${operation} failed with invalid response`);
  }
}
