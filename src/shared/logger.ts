export function info(message: string, context?: Record<string, unknown>): void {
  write("INFO", message, context);
}

export function warn(message: string, context?: Record<string, unknown>): void {
  write("WARN", message, context);
}

export function error(message: string, context?: Record<string, unknown>): void {
  write("ERROR", message, context);
}

function write(level: string, message: string, context?: Record<string, unknown>): void {
  const payload = context ? ` ${JSON.stringify(context)}` : "";
  process.stderr.write(`[${level}] ${message}${payload}\n`);
}
