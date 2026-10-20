import { existsSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const viewportWidths = [320, 360, 375, 402];
const authenticatedState = process.env.GLOBUS_VIEWPORT_STORAGE_STATE;
const validAuthenticatedState =
  authenticatedState && existsSync(authenticatedState) ? authenticatedState : undefined;

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const measurements = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const visibleOverflowingElements: string[] = [];

    for (const element of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        Number(style.opacity) === 0 ||
        style.position === 'fixed' ||
        rect.width === 0 ||
        rect.height === 0
      ) {
        continue;
      }

      let ancestor = element.parentElement;
      let containedByHorizontalScroller = false;
      while (ancestor && ancestor !== document.body) {
        const overflowX = window.getComputedStyle(ancestor).overflowX;
        if (['auto', 'scroll', 'hidden'].includes(overflowX)) {
          containedByHorizontalScroller = true;
          break;
        }
        ancestor = ancestor.parentElement;
      }

      if (!containedByHorizontalScroller && rect.right > viewportWidth + 1) {
        const identifier = element.id ? `#${element.id}` : '';
        const classes =
          typeof element.className === 'string'
            ? `.${element.className.trim().replace(/\s+/g, '.')}`
            : '';
        visibleOverflowingElements.push(
          `${element.tagName.toLowerCase()}${identifier}${classes} ends at ${Math.round(rect.right)}px`,
        );
      }
    }

    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      visibleOverflowingElements: visibleOverflowingElements.slice(0, 8),
    };
  });

  expect(
    measurements.documentWidth,
    `${context}: document scroll width exceeds its ${measurements.viewportWidth}px viewport`,
  ).toBeLessThanOrEqual(measurements.viewportWidth);
  expect(
    measurements.bodyWidth,
    `${context}: body scroll width exceeds its ${measurements.viewportWidth}px viewport`,
  ).toBeLessThanOrEqual(measurements.viewportWidth);
  expect(
    measurements.visibleOverflowingElements,
    `${context}: visible content extends beyond the viewport: ${measurements.visibleOverflowingElements.join('; ')}`,
  ).toEqual([]);
}

async function openAndCheck(page: Page, path: string, width: number, context: string) {
  await page.setViewportSize({ width, height: 850 });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  if (path === '/') {
    await expect(page.locator('h1').first()).toBeVisible();
  } else {
    await expect(page.locator('.gb-auth-shell')).toBeVisible();
  }
  if (path === '/sign-in') {
    await expect(page.locator('#gb-customer-id')).toHaveCount(1);
    expect(await page.locator('#gb-customer-id').getAttribute('placeholder')).toBeNull();
  }
  await expectNoHorizontalOverflow(page, `${context} at ${width}px (${path})`);
}

test.describe('public and authentication pages at phone widths', () => {
  for (const width of viewportWidths) {
    test(`landing, sign-in, and sign-up fit at ${width}px`, async ({ page }) => {
      for (const path of ['/', '/sign-in', '/sign-up']) {
        await openAndCheck(page, path, width, 'Public/authentication page');
      }
    });
  }
});

test.describe('signed-in member pages at phone widths', () => {
  if (validAuthenticatedState) {
    test.use({ storageState: validAuthenticatedState });
  }

  test.skip(
    !validAuthenticatedState,
    'Set GLOBUS_VIEWPORT_STORAGE_STATE to a valid Playwright storage-state file to run signed-in viewport checks.',
  );

  const memberPaths = [
    '/dashboard',
    '/wallets',
    '/transactions',
    '/send',
    '/receive',
    '/add-money',
    '/calculator',
    '/withdraw',
    '/profile',
    '/settings',
  ];

  for (const width of viewportWidths) {
    test(`all member pages fit at ${width}px`, async ({ page }) => {
      for (const path of memberPaths) {
        if (path === '/add-money' || path === '/withdraw') {
          await page.route('**/bank/saved-payment-methods', async (route) => {
            await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
          });
        }
        await page.setViewportSize({ width, height: 850 });
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.app-shell')).toBeVisible();
        await expectNoHorizontalOverflow(page, `Signed-in member page at ${width}px (${path})`);
        const documentHeight = await page.evaluate(() => ({
          viewport: window.innerHeight,
          document: document.documentElement.scrollHeight,
        }));
        expect(
          documentHeight.document,
          `Member page at ${width}px (${path}) should keep scrolling inside its content panel`,
        ).toBeLessThanOrEqual(documentHeight.viewport + 1);
        if (path === '/add-money') {
          await expect(page.getByTestId('deposit-workflow')).toBeVisible();
          await expect(page.getByText('Administrator review required')).toHaveCount(0);
          await expect(page.getByText('Account activity is recorded in Globus. A deposit request does not transfer outside funds.')).toHaveCount(0);
          const firstWallet = page.locator('[data-testid^="button-select-deposit-wallet-"]').first();
          if (await firstWallet.count()) {
            await firstWallet.click();
            await expect(page.getByTestId('deposit-wallet-details')).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible();
            await expect(page.getByTestId('deposit-request-form')).toBeVisible();
            await expect(page.getByTestId('input-deposit-reference')).toHaveCount(0);
            await expect(page.getByTestId('input-deposit-note')).toHaveCount(0);
            await expect(page.getByTestId('input-deposit-amount')).toBeVisible();
            await expect(page.getByTestId('input-deposit-pin')).toBeVisible();
            await page.getByTestId('button-deposit-bank-card').click();
            await expect(page.getByTestId('deposit-card-options')).toBeVisible();
            await expect(page.getByTestId('deposit-card-form')).toBeVisible();
            await expect(page.getByTestId('input-card-last-four')).toBeVisible();
          }
        }
        if (path === '/withdraw') {
          await expect(page.getByTestId('withdrawal-workflow')).toBeVisible();
          await expect(page.getByTestId('withdrawal-wallet-picker')).toBeVisible();
          const firstWallet = page.locator('[data-testid^="button-select-withdrawal-wallet-"]').first();
          if (await firstWallet.count()) {
            await firstWallet.click();
            await expect(page.getByTestId('withdrawal-wallet-details')).toBeVisible();
            await expect(page.getByTestId('button-withdrawal-bank-card')).toBeVisible();
            await page.getByTestId('button-withdrawal-bank-card').click();
            await expect(page.getByTestId('withdrawal-destination-form')).toBeVisible();
          }
        }
        if (path === '/calculator') {
          await expect(page.getByTestId('currency-calculator')).toBeVisible();
          await expect(page.getByTestId('select-source-currency')).toBeVisible();
          await expect(page.getByTestId('select-destination-currency')).toBeVisible();
          await expect(page.getByTestId('input-conversion-amount')).toBeVisible();
        }
        if (path === '/dashboard') {
          const toolbar = page.getByTestId('dashboard-bottom-toolbar');
          const quickActions = page.getByTestId('dashboard-action-toolbar');
          await expect(toolbar).toBeVisible();
          await expect(quickActions.locator('[data-testid^="dashboard-quick-"]')).toHaveCount(6);
          const columnCount = await quickActions.locator('[role="toolbar"]').evaluate(element =>
            getComputedStyle(element).gridTemplateColumns.split(' ').length,
          );
          expect(columnCount, 'Dashboard quick actions should use three columns').toBe(3);
          await page.getByTestId('link-header-profile').click();
          await expect(page).toHaveURL(/\/profile$/);
          await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
        }
      }
    });
  }
});

test.describe('admin pages and wide tables at phone widths', () => {
  if (validAuthenticatedState) {
    test.use({ storageState: validAuthenticatedState });
  }

  test.skip(
    !validAuthenticatedState,
    'Set GLOBUS_VIEWPORT_STORAGE_STATE to a valid Playwright storage-state file to run admin viewport checks.',
  );

  for (const width of viewportWidths) {
    test(`admin view fits and confines wide-table scrolling at ${width}px`, async ({ page }) => {
      await page.route('**/api/bank/admin/**', async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.endsWith('/access')) {
          await route.fulfill({ json: { allowed: true, roles: ['operations'] } });
        } else if (pathname.endsWith('/summary')) {
          await route.fulfill({
            json: {
              registeredUsers: 1,
              activeWallets: 1,
              pendingLedgerRequests: 0,
              ledgerTransactions: 0,
            },
          });
        } else if (pathname.endsWith('/users')) {
          await route.fulfill({
            json: [
              {
                id: 'viewport-member',
                email: 'viewport-member@example.test',
                firstName: 'Viewport',
                lastName: 'Member',
                country: 'US',
                verificationStatus: 'approved',
                verificationNote: null,
                accountStatus: 'active',
                walletCount: 1,
              },
            ],
          });
        } else {
          await route.fulfill({ json: [] });
        }
      });

      await page.setViewportSize({ width, height: 850 });
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await expect(
        page.locator('main h1').filter({ hasText: 'Operations overview' }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page, `Admin page at ${width}px`);

      const wideTableContainers = await page.locator('table').evaluateAll((tables) =>
        tables
          .filter((table) => table.scrollWidth > table.clientWidth)
          .map((table) => {
            let container = table.parentElement;
            while (container) {
              const overflowX = window.getComputedStyle(container).overflowX;
              if (overflowX === 'auto' || overflowX === 'scroll') break;
              container = container.parentElement;
            }
            return container
              ? {
                  containerScrollWidth: container.scrollWidth,
                  containerClientWidth: container.clientWidth,
                  overflowX: window.getComputedStyle(container).overflowX,
                }
              : null;
          }),
      );

      expect(wideTableContainers.length, 'The admin fixture should render a wide member table').toBeGreaterThan(0);
      expect(wideTableContainers.every(Boolean), 'Every wide table must have its own scroll container').toBe(true);
      expect(
        wideTableContainers.every(
          (container) =>
            container!.overflowX === 'auto' &&
            container!.containerScrollWidth > container!.containerClientWidth,
        ),
        'Wide tables should scroll within their own containers',
      ).toBe(true);
    });
  }
});
