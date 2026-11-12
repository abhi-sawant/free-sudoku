import { expect, test, type Page } from '@playwright/test';

// End-to-end cases for the arcade games (Road Racer, Crazy Cat, Qubo). Each title starts with its case ID from
// docs/testing/test-cases.md. Time is faked (page.clock) so runs are fast, and Math.random is fixed to 0 so the
// traffic, obstacles and towers are the same every run.

async function prepare(page: Page, storage: Record<string, unknown> = {}) {
  await page.addInitScript((seed) => {
    Math.random = () => 0;
    for (const [k, v] of Object.entries(seed)) {
      if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); // keep updates across reloads
    }
  }, storage);
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
}

const dialogOpen = (page: Page) => page.locator('#end-dialog').evaluate((d: HTMLDialogElement) => d.open);
const readJSON = (page: Page, key: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

test.describe('Road Racer', () => {
  test('TC-RACER-SYS-001 play, crash, see the result and saved history', async ({ page }) => {
    await prepare(page);
    await page.goto('/racer/index.html');
    await page.locator('[data-level="country"]').click();
    await expect(page.locator('#status')).toContainText('Tap to start');
    await page.keyboard.press('Space'); // first tap starts the run
    await expect(page.locator('#status')).toHaveText('');
    await page.clock.runFor(8000);
    expect(await dialogOpen(page)).toBe(true);
    await expect(page.locator('#end-dialog h2')).toHaveText('Crash!');
    await expect(page.locator('#end-summary')).toContainText('points');
    const stats = await readJSON(page, 'racer.stats');
    expect(stats.country.runs).toBe(1);
    const hist = await readJSON(page, 'racer.history');
    expect(hist).toHaveLength(1);
    expect(hist[0].level).toBe('country');
  });

  for (const [name, act] of [
    ['ArrowLeft key', (p: Page) => p.keyboard.press('ArrowLeft')],
    ['A key', (p: Page) => p.keyboard.press('a')],
    ['left button', (p: Page) => p.locator('#left-btn').dispatchEvent('pointerdown')],
  ] as const) {
    test(`TC-RACER-SYS-002 steering works: ${name} avoids the traffic that crashes an unsteered car`, async ({ page }) => {
      await prepare(page);
      await page.goto('/racer/index.html');
      await page.locator('[data-level="country"]').click();
      await page.keyboard.press('Space');
      await act(page); // middle lane -> left lane, the one lane kept free in this fixed-random setup
      await page.clock.runFor(8000);
      expect(await dialogOpen(page)).toBe(false);
      expect(Number(await page.locator('#score').textContent())).toBeGreaterThan(0);
    });
  }

  test('TC-RACER-SYS-003 best score is saved per level and survives a reload', async ({ page }) => {
    await prepare(page);
    await page.goto('/racer/index.html');
    await page.locator('[data-level="country"]').click();
    await page.keyboard.press('Space');
    await page.clock.runFor(8000);
    expect(await dialogOpen(page)).toBe(true);
    const best = (await readJSON(page, 'racer.stats')).country.best;
    expect(best).toBeGreaterThan(0);
    await page.reload();
    await page.locator('[data-level="country"]').click();
    await expect(page.locator('#best')).toHaveText(String(best));
    await page.locator('#back-btn').click();
    await page.locator('[data-level="highway"]').click();
    await expect(page.locator('#best')).toHaveText('0'); // other levels are separate
  });

  test('TC-RACER-SYS-004 opening the rules pauses the run and a tap carries on', async ({ page }) => {
    await prepare(page);
    await page.goto('/racer/index.html');
    await page.locator('[data-level="country"]').click();
    await page.keyboard.press('Space');
    await page.clock.runFor(500);
    await page.evaluate(() => document.dispatchEvent(new Event('guide:open')));
    await expect(page.locator('#status')).toContainText('Paused');
    const score = await page.locator('#score').textContent();
    await page.clock.runFor(5000); // nothing moves while paused
    await expect(page.locator('#score')).toHaveText(score!);
    await page.keyboard.press('Space');
    await expect(page.locator('#status')).toHaveText('');
  });
});

test.describe('Crazy Cat', () => {
  test('TC-CAT-SYS-001 start with Space, crash, then run again', async ({ page }) => {
    await prepare(page);
    await page.goto('/crazycat/index.html');
    await page.locator('[data-level="easy"]').click();
    await expect(page.locator('#status')).toContainText('Tap to start');
    await page.keyboard.press('Space');
    await expect(page.locator('#status')).toHaveText('');
    await page.clock.runFor(10000); // an unjumped cat runs into the first crate
    expect(await dialogOpen(page)).toBe(true);
    await expect(page.locator('#end-summary')).toContainText('points');
    await page.locator('#end-again').click();
    expect(await dialogOpen(page)).toBe(false);
    await expect(page.locator('#score')).toHaveText('0');
    await expect(page.locator('#status')).toContainText('Tap to start');
  });

  test('TC-CAT-SYS-002 a finished run is saved and an existing best is kept', async ({ page }) => {
    await prepare(page, { 'crazycat.stats': { easy: { runs: 3, best: 42, fish: 5 } } });
    await page.goto('/crazycat/index.html');
    await page.locator('[data-level="easy"]').click();
    await expect(page.locator('#best')).toHaveText('42');
    await page.keyboard.press('Space');
    await page.clock.runFor(10000);
    expect(await dialogOpen(page)).toBe(true);
    await expect(page.locator('#end-summary')).toContainText('Your best on');
    const stats = await readJSON(page, 'crazycat.stats');
    expect(stats.easy.runs).toBe(4);
    expect(stats.easy.best).toBe(42);
    expect(await readJSON(page, 'crazycat.history')).toHaveLength(1);
  });
});

test.describe('Qubo', () => {
  test('TC-QUBO-SYS-001 a player who never taps loses and sees the result', async ({ page }) => {
    await prepare(page);
    await page.goto('/qubo/index.html');
    await page.locator('#play-btn').click();
    await expect(page.locator('#status')).toContainText('Tap to start');
    await page.keyboard.press('Space'); // first tap starts the tower tipping
    await expect(page.locator('#status')).toHaveText('');
    await page.clock.runFor(15000);
    expect(await dialogOpen(page)).toBe(true);
    await expect(page.locator('#end-summary')).toContainText('towers crossed');
  });

  test('TC-QUBO-SYS-002 best score shows on the menu and in game, and is kept after a lower run', async ({ page }) => {
    await prepare(page, { 'qubo.best': 7 });
    await page.goto('/qubo/index.html');
    await expect(page.locator('#home-best')).toHaveText('Best 7');
    await page.locator('#play-btn').click();
    await expect(page.locator('#best')).toHaveText('7');
    await page.keyboard.press('Space');
    await page.clock.runFor(15000);
    expect(await dialogOpen(page)).toBe(true);
    await expect(page.locator('#end-summary')).toContainText('Your best is 7');
    expect(await readJSON(page, 'qubo.best')).toBe(7);
  });

  test('TC-QUBO-SYS-003 Space on the end dialog plays again', async ({ page }) => {
    await prepare(page);
    await page.goto('/qubo/index.html');
    await page.locator('#play-btn').click();
    await page.keyboard.press('Space');
    await page.clock.runFor(15000);
    expect(await dialogOpen(page)).toBe(true);
    await page.keyboard.press('Space');
    expect(await dialogOpen(page)).toBe(false);
    await expect(page.locator('#score')).toHaveText('0');
  });
});

test.describe('All arcade games', () => {
  const pages = ['/racer/index.html', '/crazycat/index.html', '/qubo/index.html'];

  for (const url of pages) {
    test(`TC-ALL-SYS-002 @mobile ${url} has no horizontal scroll on a phone, menu and game`, async ({ page }) => {
      await prepare(page);
      await page.goto(url);
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(await overflow()).toBeLessThanOrEqual(0);
      await page.locator('[data-level], #play-btn').first().click();
      await expect(page.locator('#game')).toBeVisible();
      expect(await overflow()).toBeLessThanOrEqual(0);
      const box = await page.locator('#stage').boundingBox();
      expect(box!.width).toBeGreaterThan(200);
    });
  }

  test('home page lists the three arcade games', async ({ page }) => {
    await page.goto('/');
    for (const href of ['/racer/index.html', '/crazycat/index.html', '/qubo/index.html']) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeAttached();
    }
  });
});
