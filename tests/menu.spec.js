const { test, expect } = require('@playwright/test');

test.describe('Player Selection Menu Tests', () => {

    test.beforeEach(async ({ page }) => {
        // Go to game
        await page.goto('/');
        // Wait for logic to load and menu to appear
        await page.locator('#welcome').waitFor();
        await page.waitForTimeout(1000); // Allow initGame to finish fetching
    });

    test('Menu shows Player Selection UI', async ({ page }) => {
        // Check for the player select UI container
        await expect(page.locator('#player-select-ui')).toBeVisible();

        // Check that Player 1 (Circle) is shown by default
        await expect(page.locator('#player-select-ui h2')).toContainText('Player 1');
    });

    test('Right Arrow cycles to Locked Player', async ({ page }) => {
        // Press Right Arrow (Hold needed for game loop to catch it)
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(100);
        await page.keyboard.up('ArrowRight');
        await page.waitForTimeout(300); // Wait for UI update

        // Should now show Player 2 (Square) and LOCKED status
        await expect(page.locator('#player-select-ui h2')).toContainText('Player 2');
        await expect(page.locator('#player-select-ui h2')).toContainText('(LOCKED)');

        // START button prompt should say LOCKED
        await expect(page.locator('#welcome p').last()).toContainText('LOCKED');
    });

    test('Cannot start game with locked player', async ({ page }) => {
        // Navigate to Locked Player
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(100);
        await page.keyboard.up('ArrowRight');
        await page.waitForTimeout(300);

        // Try to start
        await page.keyboard.press('Space');
        await page.waitForTimeout(500);

        // Should still be in menu (welcome visible)
        await expect(page.locator('#welcome')).toBeVisible();
        // UI should NOT be visible (game hasn't started)
        await expect(page.locator('#ui')).not.toBeVisible();
    });
});
