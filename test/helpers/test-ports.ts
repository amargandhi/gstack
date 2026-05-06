const DEFAULT_HOST = '127.0.0.1';

function portCandidate(attempt: number): number {
  const base = 20_000 + ((process.pid * 131) % 20_000);
  return 10_000 + ((base + attempt * 997 + Date.now()) % 50_000);
}

export function isCodexNetworkSandbox(): boolean {
  return process.env.CODEX_SANDBOX === 'seatbelt' && process.env.CODEX_SANDBOX_NETWORK_DISABLED === '1';
}

export function serveOnFreePort(
  options: Parameters<typeof Bun.serve>[0],
  retries = 30,
): ReturnType<typeof Bun.serve> {
  const requested = Number((options as { port?: number }).port ?? 0);
  if (requested > 0) {
    return Bun.serve(options);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    const port = portCandidate(attempt);
    try {
      return Bun.serve({
        hostname: DEFAULT_HOST,
        ...options,
        port,
      });
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string }).code;
      if (code !== 'EADDRINUSE' && code !== 'EACCES' && code !== 'EPERM') {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No free test port found');
}
