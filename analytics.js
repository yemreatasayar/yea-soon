(function () {
  const initialConfig = window.YEA_ANALYTICS_CONFIG || {};
  const eventQueue = [];
  let analyticsReady = false;
  let activeConfig = null;

  window.dataLayer = window.dataLayer || [];

  function trim(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function bool(value) {
    return value === true || value === 'true' || value === '1';
  }

  function hasConfiguredProvider(config) {
    return !!(
      trim(config.gtmId) ||
      trim(config.gaMeasurementId) ||
      trim(config.plausibleDomain) ||
      trim(config.umamiWebsiteId)
    );
  }

  function safeString(value) {
    if (typeof value !== 'string') return value;
    return value.replace(/\s+/g, ' ').trim().slice(0, 180);
  }

  function safeHref(href) {
    if (!href) return undefined;
    try {
      const url = new URL(href, window.location.href);
      return `${url.origin}${url.pathname}`;
    } catch (_error) {
      return undefined;
    }
  }

  function sanitizeParams(params) {
    const output = {};
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (/email|mail|name|message|phone|tel/i.test(key)) return;
      output[key] = typeof value === 'string' ? safeString(value) : value;
    });
    output.page_path = output.page_path || window.location.pathname;
    return output;
  }

  function debugLog(eventName, params) {
    if (!activeConfig || !bool(activeConfig.debug)) return;
    console.info('[yea analytics]', eventName, params);
  }

  function injectScript(src, attributes) {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    Object.entries(attributes || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        script.setAttribute(key, value);
      }
    });
    document.head.appendChild(script);
    return script;
  }

  function sendToProviders(eventName, params) {
    if (!eventName) return;
    const payload = sanitizeParams(params);

    window.dataLayer.push({ event: eventName, ...payload });

    if (typeof window.gtag === 'function' && eventName !== 'page_view') {
      window.gtag('event', eventName, payload);
    }

    if (typeof window.plausible === 'function' && eventName !== 'page_view') {
      window.plausible(eventName, { props: payload });
    }

    if (window.umami && typeof window.umami.track === 'function' && eventName !== 'page_view') {
      window.umami.track(eventName, payload);
    }

    debugLog(eventName, payload);
  }

  window.yeaTrack = function (eventName, params) {
    if (!eventName) return;
    const safeEventName = safeString(eventName).replace(/[^a-zA-Z0-9_:-]/g, '_');
    const safeParams = sanitizeParams(params);

    if (!analyticsReady) {
      eventQueue.push([safeEventName, safeParams]);
      return;
    }

    sendToProviders(safeEventName, safeParams);
  };

  function flushQueue() {
    analyticsReady = true;
    while (eventQueue.length) {
      const [eventName, params] = eventQueue.shift();
      sendToProviders(eventName, params);
    }
  }

  function setupGoogle(config) {
    const gtmId = trim(config.gtmId);
    const gaMeasurementId = trim(config.gaMeasurementId);

    if (gtmId) {
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      injectScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`);
    }

    if (gaMeasurementId && !gtmId) {
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', gaMeasurementId, {
        page_title: document.title,
        page_location: window.location.href,
      });
      injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`);
    }
  }

  function setupPlausible(config) {
    const domain = trim(config.plausibleDomain);
    if (!domain) return;

    window.plausible = window.plausible || function () {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };

    injectScript(trim(config.plausibleSrc) || 'https://plausible.io/js/script.js', {
      defer: '',
      'data-domain': domain,
    });
  }

  function setupUmami(config) {
    const websiteId = trim(config.umamiWebsiteId);
    const scriptUrl = trim(config.umamiSrc);
    if (!websiteId || !scriptUrl) return;

    injectScript(scriptUrl, {
      defer: '',
      'data-website-id': websiteId,
    });
  }

  function setupClickTracking() {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const trackedElement = target.closest('[data-track]');
      if (trackedElement) {
        window.yeaTrack(trackedElement.dataset.track, {
          label: trackedElement.dataset.trackLabel || trackedElement.textContent,
          href: safeHref(trackedElement.href),
        });
      }

      const link = target.closest('a[href]');
      if (!link) return;

      let url;
      try {
        url = new URL(link.href, window.location.href);
      } catch (_error) {
        return;
      }

      const sameOrigin = url.origin === window.location.origin;
      const path = url.pathname;
      const label = link.getAttribute('aria-label') || link.textContent || path;

      if (!sameOrigin) {
        window.yeaTrack('external_link_click', {
          label,
          domain: url.hostname,
          href: safeHref(url.href),
        });
        return;
      }

      if (link.closest('[data-blog-card]') || path.startsWith('/blog/') || path.endsWith('/blog-fate.html')) {
        window.yeaTrack('blog_post_open', {
          label,
          href: safeHref(url.href),
        });
        return;
      }

      const htmlPage = path.match(/\/([^/]+)\.html$/)?.[1];
      const nonProjectPages = new Set(['index', 'about', 'blog', 'blog-fate']);
      if (htmlPage && !nonProjectPages.has(htmlPage)) {
        window.yeaTrack('project_open', {
          label: htmlPage,
          href: safeHref(url.href),
        });
      }
    });
  }

  function setupScrollTracking() {
    const scrollDepthThresholds = [25, 50, 75, 100];
    const trackedScrollDepths = new Set();

    function getScrollDepth() {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollableHeight <= 0) return 100;
      return Math.min(100, Math.round((window.scrollY / scrollableHeight) * 100));
    }

    function trackScrollDepth() {
      const currentDepth = getScrollDepth();

      scrollDepthThresholds.forEach((threshold) => {
        if (currentDepth >= threshold && !trackedScrollDepths.has(threshold)) {
          trackedScrollDepths.add(threshold);
          window.yeaTrack('scroll_depth', {
            percent: threshold,
          });
        }
      });

      if (trackedScrollDepths.size === scrollDepthThresholds.length) {
        window.removeEventListener('scroll', onScrollDepthChange);
      }
    }

    let scrollDepthTicking = false;

    function onScrollDepthChange() {
      if (scrollDepthTicking) return;
      scrollDepthTicking = true;

      requestAnimationFrame(() => {
        trackScrollDepth();
        scrollDepthTicking = false;
      });
    }

    window.addEventListener('scroll', onScrollDepthChange, { passive: true });
    trackScrollDepth();
  }

  function initAnalytics(config) {
    activeConfig = config || {};

    if (bool(activeConfig.disabled)) {
      activeConfig.debug = activeConfig.debug || false;
      flushQueue();
      return;
    }

    setupGoogle(activeConfig);
    setupPlausible(activeConfig);
    setupUmami(activeConfig);
    flushQueue();

    window.yeaTrack('page_view', {
      title: document.title,
      path: window.location.pathname,
    });
  }

  async function loadRuntimeConfig() {
    if (hasConfiguredProvider(initialConfig) || initialConfig.autoFetch === false) {
      return initialConfig;
    }

    const configUrl = trim(initialConfig.configUrl) || '/analytics-config';

    try {
      const response = await fetch(configUrl, {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      });
      if (!response.ok) return initialConfig;
      return { ...initialConfig, ...(await response.json()) };
    } catch (_error) {
      return initialConfig;
    }
  }

  setupClickTracking();
  setupScrollTracking();
  loadRuntimeConfig().then(initAnalytics);
})();
