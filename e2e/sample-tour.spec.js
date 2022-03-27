import { test, expect } from "@playwright/test";

test("has info hotstpots", async ({ page }) => {
  await page.goto("http://localhost:3333/");

  // Click text=sample-tour
  await page.locator("text=sample-tour").click();
  await expect(page).toHaveURL(
    "http://localhost:3333/demos/sample-tour/index.html"
  );

  await page.waitForSelector("#titleBar");
  // TODO: find better way
  await page.waitForTimeout(1000);
  expect(await (await page.locator("#titleBar").textContent()).trim()).toEqual(
    "Oriente Station"
  );
  await expect(page.locator(".info-hotspot:visible")).toHaveCount(1);

  await page.locator("#viewRight").click();
  await page.waitForTimeout(500);
  await page.locator("#viewRight").click();
  await page.waitForTimeout(500);
  await page.locator("#viewRight").click();
  await page.waitForTimeout(500);
  await page.locator("#viewRight").click();
  await page.waitForTimeout(500);
  await page.locator("#viewRight").click();
  await page.waitForTimeout(500);
  await page.locator("#viewRight").click();
  await page.waitForTimeout(500);

  await page.locator(".link-hotspot:visible").click();

  await page.waitForTimeout(1000);
  await expect(
    await (await page.locator("#titleBar").textContent()).trim()
  ).toEqual("Electricity Museum");
  await expect(page.locator(".info-hotspot:visible")).toHaveCount(1);
});
