/* eslint-disable no-undef */
/**
 * Popup/modal/cookie banner detection and auto-close utilities.
 *
 * Handles multiple types of overlays including:
 * - Google Funding Choices (FC) consent dialogs
 * - Habr cookie banners (tm-cookie-banner)
 * - Generic modals, overlays, and notification popups
 *
 * Based on best practices from https://github.com/link-foundation/meta-theory
 */

/**
 * Close any popup overlays/modals on a Playwright or Puppeteer page.
 * Should be called after page content has loaded and before taking screenshots.
 *
 * @param {Object} page - A PageAdapter (from browser.js) or raw Playwright/Puppeteer page
 */
export async function dismissPopups(page) {
  // Get the underlying page object if wrapped in an adapter
  const rawPage = page._page || page;

  // Handle Playwright dialog events (browser-level alerts/confirms)
  if (typeof rawPage.on === 'function') {
    rawPage.on('dialog', async (dialog) => {
      try {
        await dialog.dismiss();
      } catch {
        /* ignore */
      }
    });
  }

  // Try to click the Google Funding Choices "Consent" button first
  const fcConsentClicked = await rawPage.evaluate(() => {
    const consentBtn = document.querySelector('.fc-cta-consent');
    if (consentBtn) {
      try {
        consentBtn.click();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  });

  if (fcConsentClicked) {
    await sleep(rawPage, 1000);
  }

  // Click all known close/dismiss buttons and remove overlay elements
  await rawPage.evaluate(() => {
    const closeSelectors = [
      // Google Funding Choices (FC) consent dialog
      '.fc-cta-consent',
      '.fc-close',
      '.fc-dismiss-button',
      // Cookie consent
      '.tm-cookie-banner__close',
      '.cookie-banner__close',
      '[data-test-id="cookie-banner-close"]',
      // Consent popup buttons
      '.consent-popup__close',
      '.consent__close',
      'button[data-testid="consent-close"]',
      'button[data-testid="consent-reject"]',
      // Generic close buttons
      '.tm-popup__close',
      '.popup__close',
      '.modal__close',
      '.overlay__close',
      '[aria-label="Close"]',
      '[aria-label="Закрыть"]',
      '.tm-base-modal__close',
      '.tm-notification__close',
    ];

    for (const selector of closeSelectors) {
      const els = document.querySelectorAll(selector);
      for (const el of els) {
        try {
          el.click();
        } catch {
          /* ignore */
        }
      }
    }

    // Remove Google FC consent dialog elements from DOM
    for (const sel of ['.fc-consent-root', '.fc-dialog-overlay']) {
      const el = document.querySelector(sel);
      if (el) {
        try {
          el.remove();
        } catch {
          /* ignore */
        }
      }
    }

    // Hide fixed-position overlays that cover content
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const style = getComputedStyle(el);
      if (style.position === 'fixed' && el.offsetParent !== null) {
        const rect = el.getBoundingClientRect();
        if (
          rect.height > 200 ||
          (el.className &&
            el.className.match &&
            el.className.match(
              /popup|modal|overlay|banner|cookie|notification|consent|fc-/i
            ))
        ) {
          el.style.display = 'none';
        }
      }
    }
  });

  await sleep(rawPage, 500);

  // Press Escape to dismiss remaining popups
  try {
    if (rawPage.keyboard) {
      await rawPage.keyboard.press('Escape');
      await sleep(rawPage, 300);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Scroll through the page to trigger lazy-loaded content.
 * Makes multiple passes for media-heavy pages.
 *
 * @param {Object} page - Page object (raw or adapter)
 * @param {Object} options
 * @param {number} options.passes - Number of scroll passes (default: 2)
 * @param {number} options.stepDelay - Delay between scroll steps in ms (default: 100)
 * @param {number} options.passDelay - Delay between passes in ms (default: 1000)
 */
export async function scrollToLoadContent(page, options = {}) {
  const rawPage = page._page || page;
  const { passes = 2, stepDelay = 100, passDelay = 1000 } = options;

  for (let pass = 0; pass < passes; pass++) {
    await rawPage.evaluate(
      async ({ delay }) => {
        const scrollHeight = document.documentElement.scrollHeight;
        const viewportHeight = window.innerHeight;
        const scrollSteps = Math.ceil(scrollHeight / viewportHeight);
        for (let i = 0; i < scrollSteps; i++) {
          window.scrollTo(0, i * viewportHeight);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        window.scrollTo(0, 0);
      },
      { delay: stepDelay }
    );
    await sleep(rawPage, passDelay);
  }

  // Extra wait for images to finish loading
  await sleep(rawPage, 2000);
}

/** Portable sleep that works with both Playwright and Puppeteer pages */
async function sleep(page, ms) {
  if (typeof page.waitForTimeout === 'function') {
    await page.waitForTimeout(ms);
  } else {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
