export type EndpointParams = object;

export interface EndpointCaller {
  callEndpoint<TResponse = unknown>(endpoint: string, params?: EndpointParams): Promise<TResponse>;
}

export type TokenProvider = () => string | null | undefined;
