import { readdir } from "fs/promises";
import { test, expect } from "@playwright/test";

const demos = await readdir("./demos");

test.describe.parallel("Demos", () => {
  demos.forEach((demo) => {
    test(`demo: ${demo}`, async ({ page }) => {
      page.on('pageerror', exception => {
        expect(exception.message).toBe('');
      });
      await page.goto(`http://localhost:3333/demos/${demo}/`);
    });
  });
});
