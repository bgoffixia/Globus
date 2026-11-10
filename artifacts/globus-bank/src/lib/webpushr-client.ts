type WebpushrCommand = (method: string, argument?: unknown) => void;

declare global {
  interface Window {
    webpushr?: WebpushrCommand;
    __globusWebpushrLoad?: Promise<WebpushrCommand>;
    __globusWebpushrSiteKey?: string;
  }
}

export function loadWebpushr(siteKey: string): Promise<WebpushrCommand> {
  if (window.__globusWebpushrLoad) return window.__globusWebpushrLoad;
  window.__globusWebpushrLoad = new Promise((resolve, reject) => {
    const setup = () => {
      const api = window.webpushr;
      if (!api) {
        reject(new Error('Webpushr did not finish loading.'));
        return;
      }
      if (window.__globusWebpushrSiteKey !== siteKey) {
        const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
        const worker = new URL('sw.js', base).pathname;
        api('setup', {
          key: siteKey,
          sw: worker,
          scope: base.pathname,
          integration: 'https',
        });
        window.__globusWebpushrSiteKey = siteKey;
      }
      resolve(api);
    };

    const existing = document.getElementById('webpushr-script') as HTMLScriptElement | null;
    if (existing) {
      if (window.webpushr && window.__globusWebpushrSiteKey === siteKey) {
        resolve(window.webpushr);
      } else {
        existing.addEventListener('load', setup, { once: true });
        existing.addEventListener('error', () => reject(new Error('Webpushr could not be loaded.')), { once: true });
      }
      return;
    }

    if (!window.webpushr) {
      const queue: unknown[][] = [];
      const queuedApi = ((...args: unknown[]) => { queue.push(args); }) as WebpushrCommand & { q?: unknown[][] };
      queuedApi.q = queue;
      window.webpushr = queuedApi;
    }
    const script = document.createElement('script');
    script.id = 'webpushr-script';
    script.src = 'https://cdn.webpushr.com/app.min.js';
    script.async = true;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.onload = setup;
    script.onerror = () => reject(new Error('Webpushr could not be loaded.'));
    document.head.appendChild(script);
  });
  window.__globusWebpushrLoad.catch(() => { window.__globusWebpushrLoad = undefined; });
  return window.__globusWebpushrLoad;
}

export function fetchWebpushrSubscriberId(api: WebpushrCommand): Promise<string | null> {
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => resolve(null), 7000);
    try {
      api('fetch_id', (value: unknown) => {
        window.clearTimeout(timeout);
        resolve(typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value) ? value : null);
      });
    } catch {
      window.clearTimeout(timeout);
      resolve(null);
    }
  });
}
