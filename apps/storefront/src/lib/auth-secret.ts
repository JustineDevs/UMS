type AuthSecretEnv = {
  NEXTAUTH_SECRET?: string;
  AUTH_SECRET?: string;
};

export function getAuthSecret(env: AuthSecretEnv = process.env): string | undefined {
  return env.NEXTAUTH_SECRET?.trim() || env.AUTH_SECRET?.trim() || undefined;
}
