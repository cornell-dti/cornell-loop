import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./helpers/fixtures";
import { signInAs } from "./helpers/auth";
import { resetUserState, seedDb } from "./helpers/seed";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { getConvexUrl } from "./helpers/env";
import type { Result } from "axe-core";

const A11Y_EMAIL = "loop-a11y@cornell.edu";

const SCANNED_ROUTES: { path: string; name: string }[] = [
  { path: "/", name: "Landing" },
  { path: "/onboarding", name: "Onboarding" },
  { path: "/home", name: "Home" },
  { path: "/bookmarks", name: "Bookmarks" },
  { path: "/subscriptions", name: "Subscriptions" },
  { path: "/orgs/wicc", name: "Org page" },
  { path: "/search?q=WICC", name: "Search results" },
  { path: "/profile", name: "Profile modal" },
];

function summariseViolations(violations: Result[]): string {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(", ");
      return `[${v.impact}] ${v.id}: ${v.help} → ${nodes}`;
    })
    .join("\n");
}

test.describe("Accessibility — axe scans on key routes", () => {
  test.beforeAll(async () => {
    await seedDb();
  });

  test.beforeEach(async ({ page }) => {
    await resetUserState(A11Y_EMAIL);
    const { token } = await signInAs(page, A11Y_EMAIL);
    const client = new ConvexHttpClient(getConvexUrl());
    client.setAuth(token);
    await client.mutation(api.users.updateProfile, {
      major: "Computer Science",
      gradYear: "2027",
      interests: ["Tech"],
    });
    await client.mutation(api.users.completeOnboarding, {});
    // Follow a couple of orgs so /home + /subscriptions have real content.
    for (const slug of ["wicc", "acsu"]) {
      const orgId = await client.query(api.dev.triggerOrgIdForSlug, { slug });
      if (orgId !== null) await client.mutation(api.follows.follow, { orgId });
    }
  });

  for (const { path, name } of SCANNED_ROUTES) {
    test(`no serious/critical violations on ${name} (${path})`, async ({
      page,
    }) => {
      await page.goto(path);
      // Give Convex queries a moment to resolve so axe scans rendered content.
      await page.waitForLoadState("networkidle").catch(() => {
        /* networkidle can flake under hot reload — ignore */
      });

      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const seriousOrCritical = result.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );

      // The detailed summary lands in the assertion message below so failures
      // are self-describing in CI logs; no separate console.log needed.

      expect(seriousOrCritical, summariseViolations(seriousOrCritical)).toEqual(
        [],
      );
    });
  }
});
