import { test, expect, type Page } from "@playwright/test";

// /codes is public: guests can browse, search and filter. All filtering is
// client-side over the full list the API returns, so these tests drive the UI
// and assert on what survives the filter.

// Fixed "now" so the status badges are deterministic regardless of when CI runs.
const NOW = new Date("2026-07-19T12:00:00");

// Dates are stored as an instant at local midnight of the chosen day, which is
// what the picker writes.
const midnight = (day: string) => new Date(`${day}T00:00`).toISOString();

const CODES = [
  {
    id: "i1",
    code: "ALWAYSON",
    description: "never expires",
    start_date: null,
    expire_date: null,
    created_at: midnight("2026-07-01"),
    created_by: "someone-else",
  },
  {
    id: "i2",
    code: "LASTDAY",
    description: "expires today — must still read Active",
    start_date: null,
    expire_date: midnight("2026-07-19"),
    created_at: midnight("2026-07-02"),
    created_by: "someone-else",
  },
  {
    id: "i3",
    code: "DEADCODE",
    description: "expired yesterday",
    start_date: null,
    expire_date: midnight("2026-07-18"),
    created_at: midnight("2026-07-03"),
    created_by: "someone-else",
  },
  {
    id: "i4",
    code: "SOONISH",
    description: "starts next month",
    start_date: midnight("2026-08-01"),
    expire_date: null,
    created_at: midnight("2026-07-04"),
    created_by: "someone-else",
  },
];

async function gotoCodes(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.route("**/api/item-codes", (route) =>
    route.fulfill({ json: CODES }),
  );
  await page.goto("/codes");
  await expect(page.getByText("ALWAYSON")).toBeVisible();
}

// The status badge carries `data-status`, so assertions target it directly
// rather than matching visible text that also appears in descriptions.
const statusOf = (page: Page, code: string) =>
  page.locator("li", { hasText: code }).locator("[data-status]");

test.describe("item codes", () => {
  test("a code expiring today still reads Active", async ({ page }) => {
    await gotoCodes(page);

    // Regression: status is compared at day granularity. Comparing against the
    // raw stored instant (local midnight) made a code read Expired for the
    // whole of the day it was supposed to still work.
    await expect(statusOf(page, "LASTDAY")).toHaveAttribute(
      "data-status",
      "active",
    );
  });

  test("badges reflect expired and not-yet-started codes", async ({ page }) => {
    await gotoCodes(page);

    await expect(statusOf(page, "DEADCODE")).toHaveAttribute(
      "data-status",
      "expired",
    );
    await expect(statusOf(page, "SOONISH")).toHaveAttribute(
      "data-status",
      "scheduled",
    );
    // The visible label is localized off the same status.
    await expect(statusOf(page, "SOONISH")).toHaveText("Scheduled");
  });

  test("usable codes sort above scheduled and expired ones", async ({
    page,
  }) => {
    await gotoCodes(page);

    const codes = await page.locator("li code").allTextContents();
    // Active (soonest expiry first, no-expiry last), then Scheduled, then Expired.
    expect(codes).toEqual(["LASTDAY", "ALWAYSON", "SOONISH", "DEADCODE"]);
  });

  test("status filter narrows the list", async ({ page }) => {
    await gotoCodes(page);

    await page.getByRole("button", { name: "Expired", exact: true }).click();
    await expect(page.locator("li code")).toHaveText(["DEADCODE"]);

    await page.getByRole("button", { name: "Scheduled", exact: true }).click();
    await expect(page.locator("li code")).toHaveText(["SOONISH"]);

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.locator("li code")).toHaveCount(4);
  });

  test("search matches both code and description", async ({ page }) => {
    await gotoCodes(page);
    const search = page.getByPlaceholder("Search code or description...");

    await search.fill("deadc");
    await expect(page.locator("li code")).toHaveText(["DEADCODE"]);

    // Description-only match.
    await search.fill("never expires");
    await expect(page.locator("li code")).toHaveText(["ALWAYSON"]);

    await search.fill("nothing matches this");
    await expect(page.getByText("No codes match your filters.")).toBeVisible();
  });

  test("guests get no edit or delete controls", async ({ page }) => {
    await gotoCodes(page);

    // created_by never matches a signed-out viewer, so owner controls stay off.
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  });
});
