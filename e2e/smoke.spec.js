import { readdir } from 'fs/promises';
import { test, expect } from '@playwright/test';

const demos = await readdir('./demos');

test.describe.parallel('Demos', () => {
  demos.forEach((demo) => {
    test(`demo: ${demo} should not crash`, async ({ page }) => {
      page.on('pageerror', (exception) => {
        expect(exception.message).toBe('');
      });
      await page.goto(`http://localhost:3333/demos/${demo}/`);
    });

    test(`demo: ${demo} should match screenshot`, async ({ page }) => {
      await page.goto(`http://localhost:3333/demos/${demo}/`);
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000);
      expect(await page.screenshot()).toMatchSnapshot({ maxDiffPixelRatio: demo === 'sample-tour' ? 0.2 : 0 });
    });
  });
});
