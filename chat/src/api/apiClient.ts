import { ApiError, NetworkError, redactSensitiveText } from '@/shared/errors';
import { API_BASE_URL } from '@/shared/config';
import type { EndpointParams, TokenProvider } from './endpointTypes';
import type { DriveFile } from '@/shared/types';

export interface ApiClientOptions {
  baseUrl?: string;
  tokenProvider: TokenProvider;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class ApiClient {
  private readonly baseUrl: string;
  readonly tokenProvider: TokenProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl ?? API_BASE_URL;
    this.tokenProvider = options.tokenProvider;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  async callEndpoint<TResponse = unknown>(endpoint: string, params: EndpointParams = {}): Promise<TResponse> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const token = this.tokenProvider();
      const body = token != null && token !== '' ? { ...params, i: token } : { ...params };
      const response = await this.fetchImpl(`${this.baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const errorPayload = payload as { error?: { code?: string; message?: string } } | null;
        const code = errorPayload?.error?.code ?? `HTTP_${response.status}`;
        const message = redactSensitiveText(errorPayload?.error?.message ?? response.statusText);
        throw new ApiError(code, message, response.status);
      }

      return payload as TResponse;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new NetworkError('TIMEOUT', 'Request timed out');
      }

      throw new NetworkError('NETWORK_ERROR', redactSensitiveText(error instanceof Error ? error.message : String(error)));
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async uploadFile(formData: FormData, onProgress?: (progress: number) => void): Promise<DriveFile> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/drive/files/create`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const errorPayload = payload as { error?: { code?: string; message?: string } } | null;
        const code = errorPayload?.error?.code ?? `HTTP_${response.status}`;
        const message = redactSensitiveText(errorPayload?.error?.message ?? response.statusText);
        throw new ApiError(code, message, response.status);
      }

      onProgress?.(1);
      return payload as DriveFile;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new NetworkError('TIMEOUT', 'Request timed out');
      }

      throw new NetworkError('NETWORK_ERROR', redactSensitiveText(error instanceof Error ? error.message : String(error)));
    } finally {
      window.clearTimeout(timeout);
    }
  }
}
