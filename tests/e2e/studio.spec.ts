import { expect, test } from "@playwright/test";

/** Professional Studio → product creation → public product page with a working personalized preview. */
test("studio: create, publish and open a product page", async ({ page }) => {
  const slug = `anna-${Date.now().toString(36)}`;
  await page.goto("/en/login?next=/en/studio/onboarding");
  await page.getByRole("checkbox").first().check();
  await page.getByPlaceholder("Your email").fill(`${slug}@example.com`);
  await page.getByRole("button", { name: /Continue/ }).click();

  await expect(page).toHaveURL(/studio\/onboarding/);
  await page.locator('input[name="displayName"]').fill("Anna Kowalska");
  await page.locator('input[name="slug"]').fill(slug);
  await page.locator('select[name="profession"]').selectOption("coach");
  await page.locator('input[name="acceptTerms"]').check();
  await page.getByRole("button", { name: "Create Studio" }).click();

  await expect(page.getByText("Welcome, Anna Kowalska")).toBeVisible();
  await page.goto("/en/studio/new");
  await page.locator('input[name="title"]').fill("Evening release");
  await page.locator('select[name="techniqueId"]').selectOption("deep_relaxation");
  await page.getByRole("button", { name: "Compose script" }).click();

  await expect(page).toHaveURL(/studio\/templates\//, { timeout: 30_000 });
  const first = page.locator("textarea").first();
  await expect(first).toHaveValue(/\{\{name\}\}/);
  await first.fill(((await first.inputValue()) + " Take your time.").trim());
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("All changes saved")).toBeVisible();

  await page.getByRole("link", { name: "Create product" }).click();
  await page.locator('input[name="title"]').fill("7 Days of Deep Relaxation");
  await page.locator('input[name="slug"]').fill("7-days-relaxation");
  await page.locator('textarea[name="description"]').fill("A calm programme of deep relaxation, personalized with your name.");
  await page.locator('input[name="price_pln"]').fill("79");
  await page.getByRole("button", { name: "Create product" }).click();

  await expect(page).toHaveURL(/studio\/products\//);
  await page.locator('input[name="ack"]').check();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published")).toBeVisible();

  await page.goto(`/${slug}/7-days-relaxation`);
  await expect(page.locator("h1")).toHaveText("7 Days of Deep Relaxation");
  await page.getByLabel("Your first name").fill("Lucy");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Generate my personal preview/ }).click();
  await expect(page.getByText("This moment belongs to you, Lucy.")).toBeVisible({ timeout: 30_000 });
  await page.getByText("Show what is said").click();
  await expect(page.getByText(/Lucy/).last()).toBeVisible();
  if (process.env.E2E_SCREENSHOTS) await page.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/7-product.png`, fullPage: true });
});
