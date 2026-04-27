declare const process: { env: Record<string, string | undefined> };

export function requireAdminToken(token: string) {
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    throw new Error("ADMIN_TOKEN is not configured.");
  }

  if (token !== expected) {
    throw new Error("Invalid admin token.");
  }
}
