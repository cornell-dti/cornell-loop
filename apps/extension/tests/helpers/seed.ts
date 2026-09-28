/**
 * Seed helpers for extension Playwright tests.
 * Thin wrappers around the dashboard CLI helpers — the extension shares the
 * same Convex deployment so the same seed data is visible to both.
 */

import {
  clearDb as dashboardClearDb,
  resetUserState as dashboardResetUserState,
  seedDb as dashboardSeedDb,
} from "../../../dashboard/tests/helpers/seed";

export async function seedDb(): Promise<void> {
  await dashboardSeedDb();
}

export async function clearDb(): Promise<void> {
  await dashboardClearDb();
}

export async function resetUserState(email: string): Promise<void> {
  await dashboardResetUserState(email);
}
