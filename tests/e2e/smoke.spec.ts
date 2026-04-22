import { test, expect } from "@playwright/test";

test("app shell loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#authScreen")).toBeVisible();
  await expect(page.locator(".auth-logo-text")).toContainText("smartsana");
});

test("login form has required inputs", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#li_email")).toBeVisible();
  await expect(page.locator("#li_pass")).toBeVisible();
  await expect(page.locator("button", { hasText: "Кіру" })).toBeVisible();
});
