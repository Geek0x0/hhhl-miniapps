import { redactSensitiveText } from './errors';

export interface LoggerSink {
  debug?: (message: string) => void;
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
}

export interface Logger {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

function emit(sink: ((message: string) => void) | undefined, message: string): void {
  sink?.(redactSensitiveText(message));
}

export function createLogger(sink: LoggerSink = console): Logger {
  return {
    debug: (message) => emit(sink.debug, message),
    info: (message) => emit(sink.info, message),
    warn: (message) => emit(sink.warn, message),
    error: (message) => emit(sink.error, message),
  };
}
