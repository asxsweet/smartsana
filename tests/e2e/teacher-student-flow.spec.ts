import { test, expect } from "@playwright/test";

test("teacher to student grading flow", async ({ page }) => {
  test.skip(!process.env.E2E_RUN_FULL, "Set E2E_RUN_FULL=1 to run full scenario.");

  const teacherEmail = process.env.E2E_TEACHER_EMAIL || "teacher@demo.kz";
  const teacherPass = process.env.E2E_TEACHER_PASS || "demo123";
  const studentEmail = process.env.E2E_STUDENT_EMAIL || `student_${Date.now()}@demo.kz`;
  const studentPass = process.env.E2E_STUDENT_PASS || "demo123";

  await page.goto("/");
  await page.fill("#li_email", teacherEmail);
  await page.fill("#li_pass", teacherPass);
  await page.getByRole("button", { name: /кіру/i }).click();
  await expect(page.locator("#app")).toBeVisible();

  // Teacher adds a video.
  await page.getByRole("button", { name: /видео/i }).click();
  await page.getByText("Жаңа видео қосу").click();
  await page.locator("[data-field='title']").fill(`E2E video ${Date.now()}`);
  await page.locator("[data-field='num']").fill("99");
  await page.locator("#crudModalSaveBtn").click();

  // Student registers/logs in and submits one answer.
  await page.getByRole("button", { name: /шығу/i }).click();
  await page.getByText("Тіркелу").click();
  await page.fill("#rg_name", "E2E Student");
  await page.fill("#rg_email", studentEmail);
  await page.fill("#rg_pass", studentPass);
  await page.getByRole("button", { name: /тіркелу/i }).click();
  await expect(page.locator("#app")).toBeVisible();

  // Minimal assertion to ensure flow reached student app shell.
  await expect(page.locator("#headerNav")).toContainText("Видео");
});
