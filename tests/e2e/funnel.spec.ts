import { expect, test } from "@playwright/test";

/**
 * The critical B2C path on a phone, in demo mode:
 * landing page → personalization → real 15 s preview → sign in → free 5-minute session → library → paid offer.
 */
test("landing → preview → sign-in → full session → upsell", async ({ page }) => {
  const shots = process.env.E2E_SCREENSHOTS;
  await page.goto("/pl/trening-jacobsona");
  await expect(page.locator("h1")).toContainText("Trening Jacobsona");
  if (shots) await page.screenshot({ path: `${shots}/1-landing.png`, fullPage: false });

  await page.getByLabel("Twoje imię").fill("Marek");
  await expect(page.locator("#addressAs")).toHaveValue("Marku");
  await page.getByRole("button", { name: "Dalej" }).click();
  await page.getByRole("button", { name: "Kark i ramiona" }).click();
  if (shots) await page.screenshot({ path: `${shots}/2-questions.png` });
  await page.getByRole("button", { name: "Dalej" }).click();
  await page.getByRole("button", { name: /Wygeneruj moją osobistą próbkę/ }).click();

  await expect(page.getByText("Ta chwila należy do Ciebie, Marek.")).toBeVisible({ timeout: 30_000 });
  if (shots) await page.screenshot({ path: `${shots}/3-preview.png` });
  await page.getByRole("button", { name: "Odblokuj pełne doświadczenie" }).click();
  await expect(page.getByText("Twoja podróż właśnie się zaczęła.")).toBeVisible();
  await page.getByRole("link", { name: /Odblokuj moje doświadczenie/ }).click();

  await expect(page).toHaveURL(/\/pl\/login/);
  await page.getByRole("checkbox").first().check();
  await page.getByPlaceholder("Twój e-mail").fill(`e2e-${Date.now()}@example.com`);
  await page.getByRole("button", { name: /Kontynuuj/ }).click();

  await expect(page).toHaveURL(/\/pl\/continue\//);
  if (shots) await page.screenshot({ path: `${shots}/4-generating.png` });
  await expect(page).toHaveURL(/\/pl\/experience\//, { timeout: 150_000 });
  await expect(page.getByText("Idź dalej")).toBeVisible();
  await expect(page.getByText("Wydłuż do 30 minut")).toBeVisible();
  await expect(page.getByText(/29\s?zł/).first()).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/5-experience.png`, fullPage: true });

  await page.goto("/pl/space");
  await expect(page.getByText("Witaj ponownie, Marek.")).toBeVisible();
  await expect(page.getByText("Jak chcesz się dziś poczuć?")).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/6-space.png`, fullPage: true });
});

test("homepage renders on mobile without horizontal scroll", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("h1")).toHaveText("Close your eyes. Open your world.");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  if (process.env.E2E_SCREENSHOTS) await page.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/0-home.png`, fullPage: true });
});
