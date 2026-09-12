type AuthSecretEnv = Record<string, string | undefined> & {
  AUTH_SECRET?: string;
};

export function getAuthSecret(env: AuthSecretEnv = process.env): string | undefined {
  return env.AUTH_SECRET?.trim() || undefined;
}
