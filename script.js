const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Site-wide casual-download blocker for <video> and the PDF catalogue canvas.
// Removes "Save Video As" / "Open Video in New Tab" / drag-out from default
// browser UI. Determined users can still grab assets via DevTools — this
// just keeps drive-by downloads off the visible surface.
(function lockDownMedia() {
  const block = (event) => event.preventDefault();
  const harden = (el) => {
    el.addEventListener('contextmenu', block);
    el.addEventListener('dragstart', block);
  };
  document.querySelectorAll('video').forEach((video) => {
    video.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('disableremoteplayback', '');
    harden(video);
  });
  document.querySelectorAll('[data-denim-catalogue-canvas], [data-denim-catalogue-stage]').forEach(harden);
})();

if (document.documentElement.classList.contains('is-black-hole-entry')) {
  requestAnimationFrame(() => {
    document.documentElement.classList.add('is-black-hole-entry-ready');
    sessionStorage.removeItem('blackHoleEntry');
  });
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.18,
    rootMargin: '0px 0px -12% 0px',
  },
);

const revealInstant = window.matchMedia('(max-width: 760px)').matches;
if (revealInstant) document.documentElement.classList.add('reveal-instant');

document.querySelectorAll('[data-reveal]').forEach((element, index) => {
  if (revealInstant) return; // mobile: load everything at once, no scroll reveal
  if (!element.style.getPropertyValue('--reveal-delay')) {
    element.style.setProperty('--reveal-delay', `${Math.min(index * 34, 180)}ms`);
  }
  revealObserver.observe(element);
});

function revealOnceWhenScrolledIntoView(target, reveal, options = {}) {
  if (!target || typeof reveal !== 'function') return;

  const triggerPoint = options.triggerPoint || 0.84;
  const scrollGate = options.scrollGate ?? 18;
  let hasRevealed = false;
  let frame = 0;

  const finish = () => {
    if (hasRevealed) return;
    hasRevealed = true;
    reveal();
    window.removeEventListener('scroll', requestCheck);
    window.removeEventListener('resize', requestCheck);
  };

  const check = () => {
    frame = 0;
    if (hasRevealed) return;

    const scrolled = (window.scrollY || document.documentElement.scrollTop || 0) >= scrollGate;
    if (!scrolled) return;

    const rect = target.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    const hasReachedTarget = rect.top < viewportHeight * triggerPoint;
    if (hasReachedTarget) finish();
  };

  function requestCheck() {
    if (!frame) frame = window.requestAnimationFrame(check);
  }

  if (prefersReducedMotion) {
    finish();
    return;
  }

  window.addEventListener('scroll', requestCheck, { passive: true });
  window.addEventListener('resize', requestCheck);
  requestCheck();
}

function fetchInlineSvg(img, className) {
  const src = img?.getAttribute('src');
  if (!img || !src || typeof fetch !== 'function') return Promise.resolve(null);

  const parent = img.parentElement;
  return fetch(src)
    .then((response) => (response.ok ? response.text() : Promise.reject(new Error('SVG not found'))))
    .then((svgText) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg) return null;

      svg.classList.add(...Array.from(img.classList), className);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', img.getAttribute('alt') || '');
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      const inlineSvg = document.importNode(svg, true);
      img.replaceWith(inlineSvg);
      return parent?.querySelector(`.${className}`) || null;
    })
    .catch(() => null);
}

// printenart: only the emblem changes. It starts as an outline and fills once
// the banner is reached while scrolling.
(function setupPrintenartLogoFill() {
  if (!document.body.classList.contains('case-page--printenart')) return;

  const banner = document.querySelector('.case-banner--printenart');
  const img = banner?.querySelector('.printenart-logo');
  if (!banner || !img) return;

  fetchInlineSvg(img, 'printenart-logo-svg').then((svg) => {
    if (!svg) return;

    const groups = Array.from(svg.children).filter((node) => node.tagName?.toLowerCase() === 'g');
    const emblemFill = groups[1];
    if (!emblemFill) return;

    const emblemOutline = emblemFill.cloneNode(true);
    emblemFill.classList.add('printenart-emblem-fill');
    emblemOutline.classList.add('printenart-emblem-outline');
    svg.insertBefore(emblemOutline, emblemFill);

    revealOnceWhenScrolledIntoView(banner, () => banner.classList.add('is-logo-filled'));
  });
})();

// Colin's corporate identity: the SVG already contains a flat brand-blue rect,
// a fabric image layer and the white identity artwork. We only reveal the
// fabric layer, leaving the logo visible the whole time.
(function setupColinsCorporateBannerTexture() {
  if (!document.body.classList.contains('case-page--colins-corporate-id')) return;

  const banner = document.querySelector('.case-banner--colins-corporate-id');
  const img = banner?.querySelector('.colins-banner-image');
  if (!banner || !img) return;

  fetchInlineSvg(img, 'colins-banner-svg').then((svg) => {
    if (!svg) return;

    const texture = svg.querySelector('image');
    if (!texture) return;
    texture.classList.add('colins-banner-texture');
    texture.setAttribute('aria-hidden', 'true');

    const svgNS = 'http://www.w3.org/2000/svg';
    const xlinkNS = 'http://www.w3.org/1999/xlink';
    const viewBox = (svg.getAttribute('viewBox') || '0 0 979 551')
      .split(/\s+/)
      .map((value) => Number.parseFloat(value));
    const [x = 0, y = 0, width = 979, height = 551] = viewBox;

    if (!svg.querySelector('.colins-fabric-overlay')) {
      const overlay = document.createElementNS(svgNS, 'image');
      overlay.classList.add('colins-fabric-overlay');
      overlay.setAttribute('x', x);
      overlay.setAttribute('y', y);
      overlay.setAttribute('width', width);
      overlay.setAttribute('height', height);
      overlay.setAttribute('preserveAspectRatio', 'none');
      overlay.setAttribute('href', 'assets/colins-banner-bg.png');
      overlay.setAttributeNS(xlinkNS, 'xlink:href', 'assets/colins-banner-bg.png');

      const firstLogoLayer = Array.from(svg.children).find((node) => node.tagName?.toLowerCase() === 'g');
      svg.insertBefore(overlay, firstLogoLayer || null);
    }

    revealOnceWhenScrolledIntoView(banner, () => banner.classList.add('is-textured'));
  });
})();

// miniapps: entry state shows only the centered emblem. On scroll, the lockup
// moves to its natural position and the wordmark is clipped in quickly.
(function setupMiniappsLogoBuild() {
  if (!document.body.classList.contains('case-page--miniapps')) return;

  const banner = document.querySelector('.case-banner--miniapps');
  const img = banner?.querySelector('.miniapps-logo-img');
  if (!banner || !img) return;

  fetchInlineSvg(img, 'miniapps-logo-svg').then((svg) => {
    if (!svg) return;

    const directChildren = Array.from(svg.children);
    const wordGroup = directChildren.find((node) => node.tagName?.toLowerCase() === 'g');
    const emblemPath = directChildren.find((node) => node.tagName?.toLowerCase() === 'path');

    wordGroup?.classList.add('miniapps-wordmark');
    emblemPath?.classList.add('miniapps-emblem');

    Array.from(wordGroup?.children || []).forEach((letter, index) => {
      letter.classList.add('miniapps-word-letter');
      letter.style.setProperty('--mini-letter-index', index);
    });

    revealOnceWhenScrolledIntoView(banner, () => banner.classList.add('is-logo-built'));
  });
})();

// BatchFlow mirrors the miniapps logo build: first only the mark sits centered,
// then the full wordmark resolves quickly once the banner is reached.
(function setupBatchflowLogoBuild() {
  if (!document.body.classList.contains('case-page--batchflow')) return;

  const banner = document.querySelector('.case-banner--batchflow');
  const img = banner?.querySelector('.batchflow-logo');
  if (!banner || !img) return;

  fetchInlineSvg(img, 'batchflow-logo-svg').then((svg) => {
    if (!svg) return;

    const logoParts = Array.from(svg.children).filter((node) => {
      const tag = node.tagName?.toLowerCase();
      return tag === 'path' || tag === 'polygon';
    });
    const mark = logoParts[logoParts.length - 1];
    const letters = logoParts.slice(0, -1);

    mark?.classList.add('batchflow-mark');
    letters.forEach((letter, index) => {
      letter.classList.add('batchflow-word-letter');
      letter.style.setProperty('--batch-letter-index', index);
      letter.style.setProperty('--batch-letter-order', index);
    });

    revealOnceWhenScrolledIntoView(banner, () => banner.classList.add('is-logo-built'));
  });
})();

(function setupBackToTopButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'back-to-top';
  button.setAttribute('aria-label', 'Back to top');
  button.innerHTML = '<span class="back-to-top__icon" aria-hidden="true"></span>';
  document.body.appendChild(button);

  let frame = 0;

  const update = () => {
    frame = 0;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const pageHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
    );
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    const maxScroll = Math.max(0, pageHeight - viewportHeight);
    const revealDistance = Math.min(520, viewportHeight * 0.58);
    button.classList.toggle('is-visible', maxScroll > 900 && scrollY >= maxScroll - revealDistance);
  };

  const requestUpdate = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };

  button.addEventListener('click', () => {
    window.yeaTrack?.('scroll_top_click', {
      page_path: window.location.pathname,
    });
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  });

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  update();
})();

// Colin's case page: scroll-driven SVG animations. Each "zone" element
// receives --zone-progress (0..1) based on its viewport position, which
// drives stroke-dashoffset for construction lines / circles / rectangles
// and clip-path for the color swatch fills. Reversible on scroll up
// because progress is recomputed each frame.
(function setupColinsAnimations() {
  if (!document.body.classList.contains('case-page--colins-corporate-id')) return;

  document.querySelectorAll('.colins-anim-stroke').forEach((el) => {
    if (typeof el.getTotalLength !== 'function') return;
    try {
      const len = el.getTotalLength();
      if (len > 0) el.style.setProperty('--len', len);
    } catch (e) { /* element not ready */ }
  });

  const zones = [
    ...document.querySelectorAll('.colins-anim-zone'),
    ...document.querySelectorAll('[data-anim-progress-source]'),
    ...document.querySelectorAll('.colins-color-block'),
  ].filter((z, i, arr) => arr.indexOf(z) === i);

  if (!zones.length) return;

  if (prefersReducedMotion) {
    zones.forEach((z) => z.style.setProperty('--zone-progress', '1'));
    return;
  }

  function progressFor(el) {
    const r = el.getBoundingClientRect();
    if (!r.height) return 0;
    const vh = window.innerHeight;
    const startTop = vh;
    const endTop = Math.max(0, (vh - r.height) / 2);
    const range = startTop - endTop;
    if (range <= 0) return 1;
    return Math.max(0, Math.min(1, (startTop - r.top) / range));
  }

  let scheduled = false;
  function update() {
    scheduled = false;
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      const p = progressFor(z);
      z.style.setProperty('--zone-progress', p.toFixed(4));
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
})();

// Back to School banner: the logo stays fixed while the small bars around it
// drift in the opposite direction of scroll, giving the static SVG a light
// parallax feel. If inline SVG loading fails, the original <img> remains.
(function setupBackToSchoolBannerParallax() {
  if (!document.body.classList.contains('case-page--colins-back-to-school')) return;
  const banner = document.querySelector('.case-banner--colins-back-to-school');
  const fallbackImg = banner?.querySelector('.colins-bts-banner-image');
  if (!banner || !fallbackImg || prefersReducedMotion || typeof fetch !== 'function') return;

  fetch(fallbackImg.getAttribute('src'))
    .then((response) => (response.ok ? response.text() : Promise.reject(new Error('SVG not found'))))
    .then((svgText) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg) return;

      svg.classList.add('colins-bts-banner-svg');
      svg.setAttribute('aria-hidden', 'true');
      Array.from(svg.children).filter((node) => node.tagName?.toLowerCase() === 'path').forEach((path, index) => {
        path.classList.add('colins-bts-parallax-bar');
        path.style.setProperty('--bar-depth', String(1 + index * 0.18));
      });
      fallbackImg.replaceWith(document.importNode(svg, true));

      const bars = Array.from(banner.querySelectorAll('.colins-bts-parallax-bar'));
      if (!bars.length) return;

      let frame = 0;
      const update = () => {
        frame = 0;
        const rect = banner.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const progress = (rect.top + rect.height / 2 - vh / 2) / vh;
        bars.forEach((bar, index) => {
          const depth = Number.parseFloat(bar.style.getPropertyValue('--bar-depth')) || 1;
          const x = progress * -18 * depth;
          const y = progress * 10 * depth * (index % 2 === 0 ? 1 : -1);
          bar.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
        });
      };
      const schedule = () => {
        if (!frame) frame = window.requestAnimationFrame(update);
      };
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
      update();
    })
    .catch(() => {});
})();

// Cat Calendar case page: image-based PDF viewer driven by left/right
// arrow buttons + keyboard. Inline view + fullscreen lightbox share the
// same page state. Pages live as cat-calendar-NN.webp/jpg.
(function setupCatCalendar() {
  if (!document.body.classList.contains('case-page--cat-calendar')) return;
  const firstImg = document.querySelector('[data-cat-calendar-image]');
  if (!firstImg) return;
  const total = parseInt(firstImg.getAttribute('data-total-pages'), 10) || 1;
  let page = 1;

  // All views (inline + lightbox) update together. Each view has a
  // <source>, <img>, current counter and optional prev/next buttons.
  const images = document.querySelectorAll('[data-cat-calendar-image]');
  const sources = document.querySelectorAll('[data-cat-calendar-source]');
  const counters = document.querySelectorAll('[data-cat-calendar-current]');
  const prevButtons = document.querySelectorAll('[data-cat-calendar-prev]');
  const nextButtons = document.querySelectorAll('[data-cat-calendar-next]');
  const openTriggers = document.querySelectorAll('[data-cat-calendar-open]');
  const closeButtons = document.querySelectorAll('[data-cat-calendar-close]');
  const lightbox = document.querySelector('[data-cat-calendar-lightbox]');

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  const CACHE_BUST = 'v=20260525-2';
  function setPage(n) {
    page = Math.max(1, Math.min(total, n));
    const slug = `assets/cat-calendar-${pad(page)}`;
    sources.forEach((s) => { s.srcset = `${slug}.webp?${CACHE_BUST}`; });
    images.forEach((img) => {
      img.src = `${slug}.jpg?${CACHE_BUST}`;
      img.alt = `4 Seasons Cat Calendar page ${page} of ${total}`;
    });
    counters.forEach((c) => { c.textContent = page; });
    prevButtons.forEach((b) => b.toggleAttribute('disabled', page === 1));
    nextButtons.forEach((b) => b.toggleAttribute('disabled', page === total));
    if (page < total) new Image().src = `assets/cat-calendar-${pad(page + 1)}.jpg?${CACHE_BUST}`;
    if (page > 1) new Image().src = `assets/cat-calendar-${pad(page - 1)}.jpg?${CACHE_BUST}`;
  }

  function openLightbox() {
    if (!lightbox) return;
    lightbox.hidden = false;
    document.body.classList.add('is-cat-calendar-lightbox-open');
    // Focus a close button so Esc / Tab order behaves.
    if (closeButtons[0]) closeButtons[0].focus();
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    document.body.classList.remove('is-cat-calendar-lightbox-open');
  }

  prevButtons.forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    setPage(page - 1);
  }));
  nextButtons.forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    setPage(page + 1);
  }));
  openTriggers.forEach((t) => t.addEventListener('click', openLightbox));
  closeButtons.forEach((b) => b.addEventListener('click', closeLightbox));

  // Click on lightbox backdrop (not on image / buttons) closes it.
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName)) return;
    const lightboxOpen = lightbox && !lightbox.hidden;
    if (e.key === 'Escape' && lightboxOpen) { closeLightbox(); e.preventDefault(); return; }
    if (e.key === 'ArrowLeft') { setPage(page - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { setPage(page + 1); e.preventDefault(); }
  });

  setPage(1);
})();

// Site sound. The page reloads on internal navigation, but we save the
// SoundCloud playback position to localStorage and seek back to it when the
// next page creates a fresh iframe. Result: brief silence, then music
// resumes from the same spot instead of restarting at zero.
const SOUND_STORAGE_KEY = 'yea.siteSound.v1';

// Library of selectable tracks. Adding entries unlocks the shuffle action
// in the header sound menu automatically. trackParam is the encoded URL
// fragment that goes into the SoundCloud widget src; artistUrl is the
// public SoundCloud page opened by the "artist" action.
const SOUND_TRACKS = [
  {
    id: 'nicolas-lutz-houghton-25',
    title: 'Nicolas Lutz, Houghton 25',
    trackParam: 'https%3A//soundcloud.com/resident-advisor/nicolaslutz-houghton-25',
    artistUrl: 'https://soundcloud.com/resident-advisor/nicolaslutz-houghton-25',
  },
  {
    id: 'unai-trotti-dimensions-23',
    title: 'Unai Trotti, Dimensions 23',
    trackParam: 'https%3A%2F%2Fsoundcloud.com%2Fdimensionsfestival%2Funai-trotti-live-from-dimensions-23%3Fin%3Duser-999871870%2Fsets%2Fset%26si%3D77069b7a4cd44d8ab5c8852bc9d856c1%26utm_source%3Dclipboard%26utm_medium%3Dtext%26utm_campaign%3Dsocial_sharing',
    artistUrl: 'https://soundcloud.com/dimensionsfestival/unai-trotti-live-from-dimensions-23?in=user-999871870/sets/set&si=77069b7a4cd44d8ab5c8852bc9d856c1&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
  },
  {
    id: 'unai-trotti-houghton-2024',
    title: 'Recorded at Houghton: Unai Trotti 2024',
    trackParam: 'https%3A%2F%2Fsoundcloud.com%2Fhoughton-festival%2Frecorded-at-houghton-unai-trotti-2024%3Fin%3Duser-999871870%2Fsets%2Fset%26si%3D2a56c931465248ddb52357a8a65a196e%26utm_source%3Dclipboard%26utm_medium%3Dtext%26utm_campaign%3Dsocial_sharing',
    artistUrl: 'https://soundcloud.com/houghton-festival/recorded-at-houghton-unai-trotti-2024?in=user-999871870/sets/set&si=2a56c931465248ddb52357a8a65a196e&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing',
  },
];

const BLOG_DEFAULT_READING_RADIO_URL =
  'https://soundcloud.com/communist-chimken/sets/focus-work-list?si=548bb370535c4c9a8718dbbc2e0072ba&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing';

let currentTrackIndex = 0;
const soundToggle = document.querySelector('[data-sound-toggle]');
const soundMenu = document.querySelector('[data-sound-menu]');
let soundCloudFrame = null;
let soundCloudWidget = null;
let soundCloudLastPositionMs = 0;
let soundCloudIsActuallyPlaying = false;
let siteSoundEnabled = false;
let siteSoundPausedForVideo = false;

function buildSoundCloudSrc(track) {
  return `https://w.soundcloud.com/player/?url=${track.trackParam}&color=%23e5e5e5&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`;
}

function buildSoundCloudSrcFromUrl(url) {
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23e5e5e5&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`;
}

function getCurrentTrack() {
  return SOUND_TRACKS[currentTrackIndex] ?? SOUND_TRACKS[0];
}

function readStoredSoundState() {
  try {
    const raw = localStorage.getItem(SOUND_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const positionMs = Number(parsed.positionMs);
    const trackIndex = Number(parsed.trackIndex);
    const savedAt = Number(parsed.savedAt);
    return {
      enabled: !!parsed.enabled,
      positionMs: Number.isFinite(positionMs) ? Math.max(0, positionMs) : 0,
      trackIndex: Number.isInteger(trackIndex) && trackIndex >= 0 && trackIndex < SOUND_TRACKS.length
        ? trackIndex
        : 0,
      savedAt: Number.isFinite(savedAt) ? savedAt : 0,
    };
  } catch (_err) {
    return null;
  }
}

function writeStoredSoundState() {
  try {
    localStorage.setItem(
      SOUND_STORAGE_KEY,
      JSON.stringify({
        enabled: siteSoundEnabled,
        positionMs: soundCloudLastPositionMs,
        trackIndex: currentTrackIndex,
        savedAt: Date.now(),
      }),
    );
  } catch (_err) {
    // storage unavailable (private mode, quota); not fatal
  }
}

function syncSoundUI() {
  if (soundToggle) {
    if (siteSoundEnabled) {
      soundToggle.classList.add('is-active');
      soundToggle.setAttribute('aria-pressed', 'true');
    } else {
      soundToggle.classList.remove('is-active');
      soundToggle.setAttribute('aria-pressed', 'false');
    }
  }
  // Menu play/pause label reflects what the next click will DO so users
  // don't have to interpret the current state. Artist href points at the
  // current track's public page so it's always live before being followed.
  const playItem = document.querySelector('[data-sound-action="play"]');
  if (playItem) {
    const playing = soundCloudIsActuallyPlaying;
    playItem.textContent = playing ? 'pause' : 'play';
    playItem.setAttribute('aria-label', playing ? 'Pause site sound' : 'Play site sound');
  }
  const artistItem = document.querySelector('[data-sound-action="artist"]');
  if (artistItem) {
    const url = getCurrentTrack()?.artistUrl;
    if (url) artistItem.setAttribute('href', url);
  }
  const shuffleItem = document.querySelector('[data-sound-action="shuffle"]');
  if (shuffleItem) {
    // Visually neutral when there's no alternative track, per the agreed
    // "silent no-op" behaviour. The click handler also bails early.
    if (SOUND_TRACKS.length <= 1) {
      shuffleItem.setAttribute('aria-disabled', 'true');
    } else {
      shuffleItem.removeAttribute('aria-disabled');
    }
  }
  syncBlogListeningLink();
}

function syncSoundButton() {
  // Back-compat alias retained for external callers; UI sync now covers the
  // toggle button and the menu items in a single call.
  syncSoundUI();
}

function setSoundMenuOpen(open) {
  if (!soundToggle) return;
  soundToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (soundMenu) {
    soundMenu.classList.toggle('is-open', open);
    soundMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
}

function bindSoundCloudWidget(iframeEl, initialSeekMs) {
  if (!iframeEl || !window.SC || typeof window.SC.Widget !== 'function') return null;
  try {
    const widget = window.SC.Widget(iframeEl);
    let didInitialSeek = false;
    widget.bind(window.SC.Widget.Events.READY, () => {
      // Apply saved position via the API. The url-level start_position param
      // is unreliable; seekTo after READY is the documented control surface.
      if (initialSeekMs > 0 && !didInitialSeek) {
        didInitialSeek = true;
        try { widget.seekTo(initialSeekMs); } catch (_err) { /* ignore */ }
      }
      // Mobile browsers ignore the iframe's url-level auto_play, so trigger an
      // explicit play() here (fires shortly after the tap, within the gesture
      // activation window) whenever the user intends sound to be on.
      if (siteSoundEnabled) {
        try { widget.play(); } catch (_err) { /* may be blocked by autoplay policy */ }
      }
    });
    widget.bind(window.SC.Widget.Events.PLAY, () => {
      // Belt-and-suspenders: if PLAY fires before READY (rare) and we still
      // need to seek to the saved position, do it now.
      if (initialSeekMs > 0 && !didInitialSeek) {
        didInitialSeek = true;
        try { widget.seekTo(initialSeekMs); } catch (_err) { /* ignore */ }
      }
      soundCloudIsActuallyPlaying = true;
      // SoundCloud's play/pause is async, so click handlers that call
      // syncSoundUI() immediately see stale state. Refresh again here when
      // the actual transition lands so the menu label flips properly.
      syncSoundUI();
    });
    widget.bind(window.SC.Widget.Events.PAUSE, () => {
      soundCloudIsActuallyPlaying = false;
      syncSoundUI();
    });
    widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (data) => {
      if (data && Number.isFinite(data.currentPosition)) {
        soundCloudLastPositionMs = data.currentPosition;
        writeStoredSoundState();
      }
    });
    widget.bind(window.SC.Widget.Events.FINISH, () => {
      soundCloudLastPositionMs = 0;
      if (siteSoundEnabled && SOUND_TRACKS.length > 1) {
        const previousTrack = getCurrentTrack();
        switchToTrack(currentTrackIndex + 1);
        window.yeaTrack?.('sound_auto_next', {
          label: `${previousTrack?.id || 'unknown'}_to_${getCurrentTrack()?.id || 'unknown'}`,
          page_path: window.location.pathname,
        });
        return;
      }
      soundCloudIsActuallyPlaying = false;
      writeStoredSoundState();
    });
    return widget;
  } catch (_err) {
    return null;
  }
}

function createSoundCloudIframe(startMs) {
  if (soundCloudFrame) return;
  const startPositionMs = Math.max(0, Math.floor(startMs || 0));
  const container = document.createElement('div');
  container.className = 'soundcloud-player';
  container.setAttribute('aria-hidden', 'true');
  const src = `${buildSoundCloudSrc(getCurrentTrack())}&auto_play=true`;
  container.innerHTML = `<iframe title="SoundCloud background audio" width="100%" height="20" scrolling="no" frameborder="no" allow="autoplay; encrypted-media" src="${src}"></iframe>`;
  document.body.appendChild(container);
  soundCloudFrame = container;
  soundCloudLastPositionMs = startPositionMs;
  soundCloudWidget = bindSoundCloudWidget(container.querySelector('iframe'), startPositionMs);
}

function destroySoundCloudIframe() {
  soundCloudWidget = null;
  soundCloudIsActuallyPlaying = false;
  soundCloudFrame?.remove();
  soundCloudFrame = null;
}

function startSiteSound() {
  stopBlogReadingRadio();
  siteSoundEnabled = true;
  syncSoundButton();
  if (!soundCloudFrame) {
    createSoundCloudIframe(soundCloudLastPositionMs);
  } else if (soundCloudWidget) {
    try { soundCloudWidget.play(); } catch (_err) { /* ignore */ }
  } else {
    // iframe present but Widget API unavailable; recreate with auto_play
    destroySoundCloudIframe();
    createSoundCloudIframe(soundCloudLastPositionMs);
  }
  writeStoredSoundState();
}

function stopSiteSound(options = {}) {
  const destroyFrame = options.destroyFrame === true;
  siteSoundEnabled = false;
  syncSoundButton();
  if (destroyFrame && soundCloudFrame) {
    destroySoundCloudIframe();
  } else if (soundCloudWidget) {
    try { soundCloudWidget.pause(); } catch (_err) { /* ignore */ }
  } else if (soundCloudFrame) {
    destroySoundCloudIframe();
  }
  writeStoredSoundState();
}

const blogRadio = document.querySelector('[data-blog-radio]');
const blogRadioToggle = document.querySelector('[data-blog-radio-toggle]');
const blogRadioLink = document.querySelector('[data-blog-radio-link]');
let blogRadioFrame = null;
let blogRadioWidget = null;
let blogRadioIsPlaying = false;

function getBlogReadingRadioTitle() {
  return blogRadio?.getAttribute('data-blog-radio-title')?.trim() || 'blog reading radio';
}

function syncBlogReadingRadioUI() {
  if (!blogRadioToggle) return;
  blogRadio?.classList.toggle('is-playing', blogRadioIsPlaying);
  blogRadioToggle.textContent = blogRadioIsPlaying ? 'pause reading radio' : 'play note soundtrack';
  blogRadioToggle.setAttribute('aria-pressed', String(blogRadioIsPlaying));
  syncBlogListeningLink();
}

function getBlogReadingRadioUrl() {
  const customUrl = blogRadio?.getAttribute('data-blog-radio-url')?.trim();
  return customUrl || BLOG_DEFAULT_READING_RADIO_URL;
}

function setBlogListeningLink(title, url, source) {
  if (!blogRadioLink) return;
  blogRadioLink.href = url;
  blogRadioLink.textContent = title;
  blogRadioLink.setAttribute('data-listening-source', source);
}

function syncBlogListeningLink() {
  if (!blogRadioLink) return;

  if (blogRadioIsPlaying) {
    setBlogListeningLink(getBlogReadingRadioTitle(), getBlogReadingRadioUrl(), 'blog-radio');
    return;
  }

  if (siteSoundEnabled || soundCloudIsActuallyPlaying || soundCloudFrame) {
    const track = getCurrentTrack();
    setBlogListeningLink(track.title || track.id, track.artistUrl, 'site-radio');
    return;
  }

  setBlogListeningLink(getBlogReadingRadioTitle(), getBlogReadingRadioUrl(), 'blog-radio');
}

function bindBlogReadingRadioWidget(iframeEl) {
  if (!iframeEl || !window.SC || typeof window.SC.Widget !== 'function') return null;
  try {
    const widget = window.SC.Widget(iframeEl);
    widget.bind(window.SC.Widget.Events.PLAY, () => {
      blogRadioIsPlaying = true;
      syncBlogReadingRadioUI();
    });
    widget.bind(window.SC.Widget.Events.PAUSE, () => {
      blogRadioIsPlaying = false;
      syncBlogReadingRadioUI();
    });
    widget.bind(window.SC.Widget.Events.FINISH, () => {
      blogRadioIsPlaying = false;
      syncBlogReadingRadioUI();
    });
    return widget;
  } catch (_err) {
    return null;
  }
}

function createBlogReadingRadioIframe() {
  if (blogRadioFrame) return;
  const radioUrl = getBlogReadingRadioUrl();
  const container = document.createElement('div');
  container.className = 'soundcloud-player soundcloud-player--blog';
  container.setAttribute('aria-hidden', 'true');
  const src = `${buildSoundCloudSrcFromUrl(radioUrl)}&auto_play=true`;
  container.innerHTML = `<iframe title="Blog reading radio" width="100%" height="20" scrolling="no" frameborder="no" allow="autoplay; encrypted-media" src="${src}"></iframe>`;
  document.body.appendChild(container);
  blogRadioFrame = container;
  blogRadioWidget = bindBlogReadingRadioWidget(container.querySelector('iframe'));
}

function stopBlogReadingRadio() {
  if (blogRadioWidget) {
    try { blogRadioWidget.pause(); } catch (_err) { /* ignore */ }
  }
  blogRadioFrame?.remove();
  blogRadioFrame = null;
  blogRadioWidget = null;
  blogRadioIsPlaying = false;
  syncBlogReadingRadioUI();
}

function startBlogReadingRadio() {
  if (!blogRadio || !blogRadioToggle) return;
  if (siteSoundEnabled || soundCloudIsActuallyPlaying || soundCloudFrame) {
    stopSiteSound({ destroyFrame: true });
  }

  if (!blogRadioFrame) {
    createBlogReadingRadioIframe();
  } else if (blogRadioWidget) {
    try { blogRadioWidget.play(); } catch (_err) { /* ignore */ }
  } else {
    stopBlogReadingRadio();
    createBlogReadingRadioIframe();
  }

  blogRadioIsPlaying = true;
  syncBlogReadingRadioUI();

  window.yeaTrack?.('blog_reading_radio_toggle', {
    label: 'reading_radio_on',
    page_path: window.location.pathname,
  });
}

blogRadioToggle?.addEventListener('click', () => {
  if (blogRadioIsPlaying) {
    stopBlogReadingRadio();
    window.yeaTrack?.('blog_reading_radio_toggle', {
      label: 'reading_radio_off',
      page_path: window.location.pathname,
    });
  } else {
    startBlogReadingRadio();
  }
});

syncBlogListeningLink();
syncBlogReadingRadioUI();

// Header icon now opens the inline menu (play / artist / shuffle). Clicking
// the icon again closes it. Click-outside and Escape are intentionally not
// wired up: per the agreed UX, only the icon itself toggles the menu.
soundToggle?.addEventListener('click', () => {
  // Mobile: no slide-out menu; tapping the icon plays a random track (or stops).
  if (window.matchMedia('(max-width: 760px)').matches) {
    if (soundCloudIsActuallyPlaying) {
      stopSiteSound();
      window.yeaTrack?.('sound_toggle', { label: 'sound_off', page_path: window.location.pathname });
    } else {
      if (SOUND_TRACKS.length > 1) switchToTrack(Math.floor(Math.random() * SOUND_TRACKS.length));
      startSiteSound();
      window.yeaTrack?.('sound_toggle', { label: 'sound_on_random', page_path: window.location.pathname });
    }
    syncSoundUI();
    return;
  }
  const isOpen = soundToggle.getAttribute('aria-expanded') === 'true';
  setSoundMenuOpen(!isOpen);
  if (!isOpen) syncSoundUI(); // refresh play label, artist href when opening
});

// Switch to a different track in SOUND_TRACKS, reset playback to start.
function switchToTrack(nextIndex) {
  if (!Number.isInteger(nextIndex)) return;
  const len = SOUND_TRACKS.length;
  if (len <= 1) return;
  const normalized = ((nextIndex % len) + len) % len;
  if (normalized === currentTrackIndex) return;

  currentTrackIndex = normalized;
  soundCloudLastPositionMs = 0;
  const wasEnabled = siteSoundEnabled;
  destroySoundCloudIframe();
  if (wasEnabled) {
    createSoundCloudIframe(0);
  }
  syncSoundUI();
  writeStoredSoundState();
}

// Delegated handler for the three menu items.
document.addEventListener('click', (event) => {
  const item = event.target instanceof Element ? event.target.closest('[data-sound-action]') : null;
  if (!item) return;
  const action = item.getAttribute('data-sound-action');

  if (action === 'play') {
    event.preventDefault();
    if (soundCloudIsActuallyPlaying) {
      stopSiteSound();
      window.yeaTrack?.('sound_toggle', { label: 'sound_off', page_path: window.location.pathname });
    } else {
      startSiteSound();
      window.yeaTrack?.('sound_toggle', { label: 'sound_on', page_path: window.location.pathname });
    }
    syncSoundUI();
    return;
  }

  if (action === 'shuffle') {
    event.preventDefault();
    if (SOUND_TRACKS.length <= 1) return; // silent no-op per spec
    switchToTrack(currentTrackIndex + 1);
    window.yeaTrack?.('sound_shuffle', {
      label: getCurrentTrack().id,
      page_path: window.location.pathname,
    });
    return;
  }

  if (action === 'artist') {
    // Default <a target="_blank"> navigation handles the actual open. We
    // refresh href here in case state changed and only emit a telemetry
    // event for parity with the other actions.
    const url = getCurrentTrack()?.artistUrl;
    if (url) item.setAttribute('href', url);
    window.yeaTrack?.('sound_artist_open', {
      label: getCurrentTrack().id,
      page_path: window.location.pathname,
    });
  }
});

function pauseSiteSoundForVideo() {
  if (!siteSoundEnabled) return;
  if (siteSoundPausedForVideo) return;
  siteSoundPausedForVideo = true;
  if (soundCloudWidget) {
    try { soundCloudWidget.pause(); } catch (_err) { /* ignore */ }
  } else if (soundCloudFrame) {
    destroySoundCloudIframe();
  }
  window.yeaTrack?.('sound_toggle', {
    label: 'sound_paused_for_video',
    page_path: window.location.pathname,
  });
}

function resumeSiteSoundAfterVideo() {
  if (!siteSoundPausedForVideo) return;
  siteSoundPausedForVideo = false;
  if (!siteSoundEnabled) return;
  if (soundCloudWidget) {
    try { soundCloudWidget.play(); } catch (_err) { /* ignore */ }
  } else if (!soundCloudFrame) {
    createSoundCloudIframe(soundCloudLastPositionMs);
  }
  window.yeaTrack?.('sound_toggle', {
    label: 'sound_resumed_after_video',
    page_path: window.location.pathname,
  });
}

window.addEventListener('pagehide', writeStoredSoundState);
window.addEventListener('beforeunload', writeStoredSoundState);

// Auto-resume the music only if the user is returning shortly after leaving.
// Past this window we keep the saved position so a manual play resumes from
// the same spot, but we do not surprise the user with sound on a fresh visit.
const AUTO_RESUME_MAX_AGE_MS = 60_000;

(() => {
  // Always sync the menu UI on load so play label / artist href / shuffle
  // disabled state reflect the current track even when sound is off.
  const stored = readStoredSoundState();
  if (stored) {
    soundCloudLastPositionMs = stored.positionMs;
    currentTrackIndex = stored.trackIndex;
    const age = Date.now() - stored.savedAt;
    const isFresh = stored.savedAt > 0 && age >= 0 && age < AUTO_RESUME_MAX_AGE_MS;
    if (stored.enabled && isFresh) {
      siteSoundEnabled = true;
      createSoundCloudIframe(stored.positionMs);
    }
  }
  syncSoundUI();
})();

function modalVideoHasSound() {
  return !!modalVideo && !modalVideo.muted && modalVideo.volume > 0;
}

const previewVideos = document.querySelectorAll('.preview-video');
const lazyPreviewVisibility = new Map();
let lazyPreviewFrame = null;
const hoverPreviewQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
const loadPreviewVideo = (video) => {
  if (!video || video.dataset.previewLoaded === 'true') {
    return;
  }

  const useMobileSrc = !hoverPreviewQuery.matches;
  video.querySelectorAll('source[data-src]').forEach((source) => {
    source.src = useMobileSrc && source.dataset.mobileSrc ? source.dataset.mobileSrc : source.dataset.src;
  });

  if (video.dataset.src) {
    video.src = video.dataset.src;
  }

  video.dataset.previewLoaded = 'true';
  video.load();
};
const playPreviewVideo = (video) => {
  if (!video || prefersReducedMotion) {
    return;
  }

  loadPreviewVideo(video);
  if (video.ended) {
    video.currentTime = 0;
  }
  video.play().catch(() => {});
};
const pausePreviewVideo = (video) => {
  if (video) {
    video.pause();
  }
};
const pauseAllPreviewVideos = () => {
  previewVideos.forEach((video) => pausePreviewVideo(video));
};
const playFocusedLazyPreview = () => {
  lazyPreviewFrame = null;

  if (hoverPreviewQuery.matches) {
    return;
  }

  let focusedVideo = null;
  let focusedRatio = 0;

  lazyPreviewVisibility.forEach((ratio, video) => {
    if (ratio > focusedRatio) {
      focusedRatio = ratio;
      focusedVideo = video;
    }
  });

  lazyPreviewVisibility.forEach((ratio, video) => {
    if (video === focusedVideo && focusedRatio >= 0.55) {
      playPreviewVideo(video);
    } else {
      pausePreviewVideo(video);
    }
  });
};
const scheduleFocusedLazyPreview = () => {
  if (!lazyPreviewFrame) {
    lazyPreviewFrame = window.requestAnimationFrame(playFocusedLazyPreview);
  }
};
const previewVideoObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (video.hasAttribute('data-lazy-video')) {
        const isMotionAutoPreview = document.body.classList.contains('case-page--motion') && !!video.closest('.motion-video-card');
        if (hoverPreviewQuery.matches) {
          if (isMotionAutoPreview && entry.isIntersecting) {
            playPreviewVideo(video);
          } else if (entry.isIntersecting) {
            loadPreviewVideo(video);
          }
          if (!isMotionAutoPreview || !entry.isIntersecting) {
            pausePreviewVideo(video);
          }
          return;
        }

        lazyPreviewVisibility.set(video, entry.isIntersecting ? entry.intersectionRatio : 0);
        scheduleFocusedLazyPreview();
        return;
      }

      if (entry.isIntersecting && !prefersReducedMotion) {
        playPreviewVideo(video);
      } else {
        pausePreviewVideo(video);
      }
    });
  },
  { threshold: [0, 0.25, 0.55, 0.75] },
);

previewVideos.forEach((video) => {
  video.muted = true;
  video.controls = false;
  if (video.hasAttribute('data-lazy-video')) {
    video.preload = 'none';
    const hoverTarget = video.closest('a, button') || video;
    hoverTarget.addEventListener('pointerenter', () => {
      if (hoverPreviewQuery.matches) {
        playPreviewVideo(video);
      }
    });
    hoverTarget.addEventListener('pointerleave', () => {
      if (hoverPreviewQuery.matches) {
        pausePreviewVideo(video);
      }
    });
    hoverTarget.addEventListener('focus', () => {
      if (hoverPreviewQuery.matches) {
        playPreviewVideo(video);
      }
    });
    hoverTarget.addEventListener('blur', () => {
      if (hoverPreviewQuery.matches) {
        pausePreviewVideo(video);
      }
    });
  }
  previewVideoObserver.observe(video);
});

const syncLazyPreviewMode = () => {
  lazyPreviewVisibility.forEach((ratio, video) => {
    pausePreviewVideo(video);
    if (!hoverPreviewQuery.matches && ratio >= 0.55) {
      scheduleFocusedLazyPreview();
    }
  });
};

if (hoverPreviewQuery.addEventListener) {
  hoverPreviewQuery.addEventListener('change', syncLazyPreviewMode);
} else if (hoverPreviewQuery.addListener) {
  hoverPreviewQuery.addListener(syncLazyPreviewMode);
}

const orbitLinks = {
  // Teaser build: orbit items are decorative, no project pages to open.
};

const orbitSystem = document.querySelector('[data-orbit-system]');
const orbitConfig = {
  personal: {
    initialAngle: -2.45,
    baseRadius: 325,
    radiusVariation: 2.5,
    angularSpeed: 0.0001,
    orbitRotation: -0.05,
    lineLength: 30,
    labelDistance: 82,
    arcSpan: 0.62,
    phase: 0.2,
  },
  visual: {
    initialAngle: -0.28,
    baseRadius: 238,
    radiusVariation: 2,
    angularSpeed: 0.00017,
    orbitRotation: 0.02,
    lineLength: 30,
    labelDistance: 80,
    arcSpan: 0.58,
    phase: 2.1,
  },
  art: {
    initialAngle: -3.55,
    baseRadius: 157,
    radiusVariation: 2,
    angularSpeed: 0.00026,
    orbitRotation: 0.04,
    lineLength: 28,
    labelDistance: 78,
    arcSpan: 0.54,
    phase: 4.3,
  },
};

const orbitItems = [...document.querySelectorAll('[data-orbit-item]')].map((element) => {
  const id = element.dataset.orbitItem;
  const body = element.querySelector('.orbit-body');
  const config = orbitConfig[id];

  return {
    id,
    element,
    body,
    line: element.querySelector('.orbit-line'),
    ring: document.querySelector(`[data-orbit-ring="${id}"]`),
    glowRing: document.querySelector(`[data-orbit-ring-glow="${id}"]`),
    label: element.querySelector('.orbit-label'),
    tspans: [...element.querySelectorAll('tspan')],
    bodyRadius: Number(body.getAttribute('r')),
    currentAngle: config.initialAngle,
    ...config,
  };
});

let previousFrame = performance.now();
let orbitTime = 0;
let orbitSpeed = 1;
let orbitTargetSpeed = 1;
// When cosmic idle mode is active this becomes a function that takes the
// frame delta in ms and steps the 3-body simulation in place of the normal
// renderOrbit() math.
let cosmicRender = null;
const canSlowOrbitOnHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const blackHoleTrigger = document.querySelector('[data-black-hole-trigger]');
let blackHoleOpenedAt = 0;

function getOrbitPoint(centerX, centerY, angle, radius, rotation) {
  const xLocal = Math.cos(angle) * radius;
  const yLocal = Math.sin(angle) * radius;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return {
    x: centerX + xLocal * cos - yLocal * sin,
    y: centerY + xLocal * sin + yLocal * cos,
  };
}

function getOrbitArcPath(centerX, centerY, angle, radius, rotation, span) {
  const start = getOrbitPoint(centerX, centerY, angle - span, radius, rotation);
  const end = getOrbitPoint(centerX, centerY, angle + span, radius, rotation);
  const sweep = 1;

  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} ${(rotation * 180) / Math.PI} 0 ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function renderOrbit(now) {
  const delta = Math.min(now - previousFrame, 48);
  previousFrame = now;

  if (cosmicRender) {
    cosmicRender(delta);
    return;
  }

  orbitSpeed += (orbitTargetSpeed - orbitSpeed) * 0.08;
  const animationDelta = document.body.classList.contains('is-black-hole-open') ? 0 : delta * orbitSpeed;
  orbitTime += animationDelta;

  const centerX = 450;
  const centerY = 390;

  orbitItems.forEach((item) => {
    item.currentAngle += animationDelta * item.angularSpeed;

    const radiusDrift = Math.sin(orbitTime * 0.00024 + item.phase) * item.radiusVariation;
    const orbitRotation = item.orbitRotation + Math.sin(orbitTime * 0.00008 + item.phase) * 0.01;
    const radius = item.baseRadius + radiusDrift;
    const position = getOrbitPoint(centerX, centerY, item.currentAngle, radius, orbitRotation);
    const x = position.x;
    const y = position.y;
    const fromCenterX = x - centerX;
    const fromCenterY = y - centerY;
    const distanceFromCenter = Math.hypot(fromCenterX, fromCenterY) || 1;
    const unitX = fromCenterX / distanceFromCenter;
    const unitY = fromCenterY / distanceFromCenter;
    const lineStartX = unitX * (item.bodyRadius + 13);
    const lineStartY = unitY * (item.bodyRadius + 13);
    const lineEndX = lineStartX + unitX * item.lineLength;
    const lineEndY = lineStartY + unitY * item.lineLength;
    const labelLocalX = unitX * (item.bodyRadius + 13 + item.labelDistance);
    const labelLocalY = unitY * (item.bodyRadius + 13 + item.labelDistance);
    const textX = labelLocalX;
    const textY = labelLocalY - 8;

    item.element.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    item.element.style.setProperty('--orbit-x', `${x.toFixed(2)}px`);
    item.element.style.setProperty('--orbit-y', `${y.toFixed(2)}px`);
    item.label.setAttribute('x', textX.toFixed(2));
    item.label.setAttribute('y', textY.toFixed(2));
    item.label.setAttribute('text-anchor', 'middle');
    item.tspans.forEach((tspan) => tspan.setAttribute('x', textX.toFixed(2)));
    item.line.setAttribute(
      'd',
      `M ${lineStartX.toFixed(2)} ${lineStartY.toFixed(2)} L ${lineEndX.toFixed(2)} ${lineEndY.toFixed(2)}`,
    );

    item.ring?.setAttribute('d', getOrbitArcPath(centerX, centerY, item.currentAngle, item.baseRadius, orbitRotation, item.arcSpan));
    item.glowRing?.setAttribute('d', getOrbitArcPath(centerX, centerY, item.currentAngle, item.baseRadius, orbitRotation, item.arcSpan * 0.28));
  });
}

function animateOrbit(now) {
  renderOrbit(now);
  // Orbit + cosmic idle are the page's signature motion; keep them running
  // even under prefers-reduced-motion (gentle continuous rotation).
  requestAnimationFrame(animateOrbit);
}

orbitItems.forEach((item) => {
  item.element.addEventListener('mouseenter', () => {
    if (canSlowOrbitOnHover) {
      orbitTargetSpeed = 0.16;
    }
  });

  item.element.addEventListener('mouseleave', () => {
    orbitTargetSpeed = 1;
  });

  item.element.addEventListener('focus', () => {
    if (canSlowOrbitOnHover) {
      orbitTargetSpeed = 0.16;
    }
  });

  item.element.addEventListener('blur', () => {
    orbitTargetSpeed = 1;
  });

  item.element.addEventListener('click', () => {
    if (orbitLinks[item.id]) window.location.href = orbitLinks[item.id];
  });

  item.element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (orbitLinks[item.id]) window.location.href = orbitLinks[item.id];
    }
  });
});

function startBlackHoleTransition() {
  if (videoOverlay?.classList.contains('is-open')) {
    return;
  }

  if (document.body.classList.contains('is-black-hole-open')) {
    return;
  }

  const core = document.querySelector('.black-hole__core');
  if (core) {
    const rect = core.getBoundingClientRect();
    document.documentElement.style.setProperty('--bh-top', `${rect.top + rect.height / 2}px`);
    document.documentElement.style.setProperty('--bh-left', `${rect.left + rect.width / 2}px`);
  }

  const destination = blackHoleTrigger?.getAttribute('data-black-hole-destination') || 'about.html';
  const entryKey = blackHoleTrigger?.getAttribute('data-black-hole-entry');

  document.body.classList.add('is-black-hole-open');
  blackHoleOpenedAt = Date.now();
  if (entryKey && entryKey.trim()) {
    sessionStorage.setItem('blackHoleEntry', entryKey.trim());
  } else if (!blackHoleTrigger?.hasAttribute('data-black-hole-destination') && destination === 'about.html') {
    sessionStorage.setItem('blackHoleEntry', 'about');
  }
  window.yeaTrack?.('black_hole_transition', {
    destination,
    page_path: window.location.pathname,
  });

  window.setTimeout(
    () => {
      window.location.href = destination;
    },
    prefersReducedMotion ? 80 : 1120,
  );
}

blackHoleTrigger?.addEventListener('click', startBlackHoleTransition);

blackHoleTrigger?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    startBlackHoleTransition();
  }
});

if (orbitSystem && orbitItems.length) {
  requestAnimationFrame(animateOrbit);
}

const CONTACT_ENDPOINT = 'https://yea-contact.highlevelsocial.workers.dev';

document.querySelectorAll('.contact-form').forEach((form) => {
  let status = form.querySelector('.contact-form__status');
  if (!status) {
    status = document.createElement('p');
    status.className = 'contact-form__status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    form.appendChild(status);
  }
  const setStatus = (text, state) => {
    status.textContent = text || '';
    status.classList.remove('is-success', 'is-error');
    if (state) status.classList.add(`is-${state}`);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const button = form.querySelector('button[type="submit"]');
    const originalText = button?.textContent || 'send message';
    setStatus('', null);

    if (button) {
      button.disabled = true;
      button.textContent = 'sending...';
    }
    window.yeaTrack?.('contact_form_attempt', {
      page_path: window.location.pathname,
    });

    try {
      const response = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        body: new FormData(form),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Message could not be sent.');
      }

      form.reset();
      window.turnstile?.reset();
      window.yeaTrack?.('contact_form_submit', {
        page_path: window.location.pathname,
      });
      setStatus('Thanks, your message has been sent. I will get back to you soon.', 'success');
    } catch (error) {
      window.turnstile?.reset();
      window.yeaTrack?.('contact_form_error', {
        label: error?.message || 'send_failed',
        page_path: window.location.pathname,
      });
      setStatus(error?.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  });
});

(function setupBlogLanguage() {
  const switches = Array.from(document.querySelectorAll('[data-lang-switch]'));
  if (!switches.length) return;

  const blogPage = document.querySelector('.blog-page');
  const searchInput = document.querySelector('[data-blog-search]');
  const storageKey = 'yeaBlogLanguage';

  const getStoredLanguage = () => {
    try {
      return window.localStorage?.getItem(storageKey);
    } catch (_error) {
      return null;
    }
  };

  const setStoredLanguage = (language) => {
    try {
      window.localStorage?.setItem(storageKey, language);
    } catch (_error) {
      // Language switching still works for the current page if storage is unavailable.
    }
  };

  const initialLanguage = getStoredLanguage() === 'en' ? 'en' : 'tr';

  const pageTitles = {
    tr: {
      '/blog-fate.html': 'Kader | yusuf emre atasayar',
      default: 'blog | yusuf emre atasayar',
    },
    en: {
      '/blog-fate.html': 'Fate | yusuf emre atasayar',
      default: 'blog | yusuf emre atasayar',
    },
  };

  const setLanguage = (language, options = {}) => {
    const nextLanguage = language === 'en' ? 'en' : 'tr';
    const previousLanguage = document.documentElement.lang === 'en' ? 'en' : 'tr';
    const shouldTrack = options.track === true;

    blogPage?.classList.toggle('is-lang-tr', nextLanguage === 'tr');
    blogPage?.classList.toggle('is-lang-en', nextLanguage === 'en');
    document.documentElement.lang = nextLanguage;
    setStoredLanguage(nextLanguage);

    switches.forEach((switchEl) => {
      switchEl.querySelectorAll('[data-lang-option]').forEach((button) => {
        const isActive = button.getAttribute('data-lang-option') === nextLanguage;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });
    });

    if (searchInput) {
      searchInput.placeholder =
        searchInput.getAttribute(`data-placeholder-${nextLanguage}`) || searchInput.placeholder;
    }

    const path = window.location.pathname.split('/').pop();
    document.title = pageTitles[nextLanguage][`/${path}`] || pageTitles[nextLanguage].default;
    window.dispatchEvent(new CustomEvent('yea:blog-language-change', { detail: { language: nextLanguage } }));

    if (shouldTrack && previousLanguage !== nextLanguage) {
      window.yeaTrack?.('blog_language_switch', {
        label: nextLanguage,
        page_path: window.location.pathname,
      });
    }
  };

  switches.forEach((switchEl) => {
    switchEl.addEventListener('click', (event) => {
      const button = event.target.closest('[data-lang-option]');
      if (!button) return;
      setLanguage(button.getAttribute('data-lang-option'), { track: true });
    });
  });

  setLanguage(initialLanguage);
})();

(function setupBlogExcerptClamp() {
  const cards = Array.from(document.querySelectorAll('[data-blog-card]'));

  if (!cards.length) return;

  const getLineHeight = (element) => {
    const style = window.getComputedStyle(element);
    const parsed = Number.parseFloat(style.lineHeight);
    if (Number.isFinite(parsed)) return parsed;
    return Number.parseFloat(style.fontSize || '16') * 1.45;
  };

  const updateCard = (card) => {
    if (card.hidden) return;

    const media = card.querySelector('.blog-card__media');
    const content = card.querySelector('.blog-card__content');
    const excerpt = card.querySelector('.blog-card__excerpt');

    if (!media || !content || !excerpt) return;

    const mediaHeight = media.getBoundingClientRect().height;
    const contentTop = content.getBoundingClientRect().top;
    const excerptTop = excerpt.getBoundingClientRect().top;
    const lineHeight = getLineHeight(excerpt);
    const reservedHeight = Math.max(0, excerptTop - contentTop);
    const isNarrow = window.matchMedia('(max-width: 760px)').matches;
    const maxLines = isNarrow ? 4 : 14;
    const availableLines = Math.floor((mediaHeight - reservedHeight) / lineHeight);
    const measuredLines = Number.isFinite(availableLines) ? availableLines : maxLines;
    const lineCount = Math.max(2, Math.min(maxLines, measuredLines));

    if (excerpt.style.getPropertyValue('--blog-excerpt-lines') !== String(lineCount)) {
      excerpt.style.setProperty('--blog-excerpt-lines', String(lineCount));
    }
  };

  const updateCards = () => {
    cards.forEach(updateCard);
  };

  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(updateCards) : null;

  cards.forEach((card) => {
    resizeObserver?.observe(card);
    const image = card.querySelector('.blog-card__media img, .blog-card__media video');
    image?.addEventListener('load', updateCards, { once: true });
    image?.addEventListener('loadedmetadata', updateCards, { once: true });
  });

  window.addEventListener('resize', updateCards, { passive: true });
  window.addEventListener('yea:blog-language-change', updateCards);
  window.addEventListener('yea:blog-filter-change', updateCards);
  document.fonts?.ready?.then(updateCards).catch(() => {});
  updateCards();
})();

(function setupBlogSearch() {
  const searchInput = document.querySelector('[data-blog-search]');
  const cards = Array.from(document.querySelectorAll('[data-blog-card]'));
  const emptyState = document.querySelector('[data-blog-empty]');

  if (!searchInput || !cards.length) return;

  const getCardText = (card) =>
    [card.textContent || '', card.getAttribute('data-blog-keywords') || ''].join(' ').toLowerCase();

  const searchableCards = cards.map((card) => ({
    card,
    text: getCardText(card),
  }));

  const filterCards = () => {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    searchableCards.forEach(({ card, text }) => {
      const isVisible = !query || text.includes(query);
      card.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });

    if (emptyState) {
      emptyState.hidden = visibleCount > 0;
    }

    window.dispatchEvent(new CustomEvent('yea:blog-filter-change'));
    return { query, visibleCount };
  };

  let searchTrackTimer = 0;

  searchInput.addEventListener('input', () => {
    const result = filterCards();
    window.clearTimeout(searchTrackTimer);
    if (!result.query) return;
    searchTrackTimer = window.setTimeout(() => {
      window.yeaTrack?.('blog_search', {
        query_length: result.query.length,
        results: result.visibleCount,
        page_path: window.location.pathname,
      });
    }, 700);
  });
})();

document.querySelectorAll('[data-entry-carousel]').forEach((carousel) => {
  const track = carousel.querySelector('[data-entry-track]');

  if (!track) {
    return;
  }

  const autoScrollEnabled = carousel.dataset.entryAutoscroll !== 'false';
  const autoScrollDirection = carousel.dataset.entryDirection === 'reverse' ? -1 : 1;
  const autoScrollSpeed = Number.parseFloat(carousel.dataset.entrySpeed || '0.008');
  const pauseOnHover = carousel.dataset.entryPauseOnHover !== 'false';
  const originalCards = [...track.children];

  if (!originalCards.length) {
    return;
  }

  function cloneCard(card) {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a, button').forEach((focusable) => {
      focusable.setAttribute('tabindex', '-1');
    });
    return clone;
  }

  const cloneSetsBefore = 2;
  const cloneSetsAfter = 2;

  for (let set = 0; set < cloneSetsBefore; set += 1) {
    [...originalCards].reverse().forEach((card) => {
      track.prepend(cloneCard(card));
    });
  }

  for (let set = 0; set < cloneSetsAfter; set += 1) {
    originalCards.forEach((card) => {
      track.appendChild(cloneCard(card));
    });
  }

  let setWidth = 0;
  let previousTime = performance.now();
  let isPaused = false;
  let isDragging = false;
  let suppressNextClick = false;
  let startX = 0;
  let startScrollLeft = 0;
  let autoScrollStartsAt = performance.now() + 900;
  let lastPointerX = 0;
  let lastPointerTime = performance.now();
  let momentumVelocity = 0;
  let setStart = 0;
  let nextSetStart = 0;
  let hasInteracted = false;
  let hasPointerCapture = false;

  function measureCarousel() {
    const firstOriginal = originalCards[0];
    const firstRepeatedCard = track.children[originalCards.length * (cloneSetsBefore + 1)];

    setStart = firstOriginal ? firstOriginal.offsetLeft : 0;
    nextSetStart = firstRepeatedCard ? firstRepeatedCard.offsetLeft : setStart;
    setWidth = nextSetStart - setStart;
  }

  function normalizeScroll() {
    if (!setWidth) {
      measureCarousel();
    }

    if (!setWidth) {
      return 0;
    }

    let shift = 0;

    if (carousel.scrollLeft >= nextSetStart) {
      carousel.scrollLeft -= setWidth;
      shift -= setWidth;
    } else if (carousel.scrollLeft < setStart) {
      carousel.scrollLeft += setWidth;
      shift += setWidth;
    }

    return shift;
  }

  function resetCarouselPosition() {
    measureCarousel();
    carousel.scrollLeft = setStart;
    autoScrollStartsAt = performance.now() + 900;
  }

  function initializeCarouselPosition() {
    if (!hasInteracted) {
      resetCarouselPosition();
    }
  }

  function animateCarousel(now) {
    const delta = Math.min(now - previousTime, 48);
    previousTime = now;

    if (!isDragging && momentumVelocity !== 0 && Math.abs(momentumVelocity) <= 0.02) {
      momentumVelocity = 0;
      isPaused = pauseOnHover && (carousel.matches(':hover') || carousel.contains(document.activeElement));
    }

    if (!prefersReducedMotion && !isDragging && Math.abs(momentumVelocity) > 0.02) {
      carousel.scrollLeft += momentumVelocity * delta;
      momentumVelocity *= 0.94;
      normalizeScroll();
    } else if (autoScrollEnabled && !prefersReducedMotion && !isPaused && !isDragging && now >= autoScrollStartsAt) {
      carousel.scrollLeft += delta * autoScrollSpeed * autoScrollDirection;
      normalizeScroll();
    }

    requestAnimationFrame(animateCarousel);
  }

  requestAnimationFrame(() => {
    initializeCarouselPosition();
    requestAnimationFrame(animateCarousel);
  });

  window.setTimeout(initializeCarouselPosition, 80);
  window.setTimeout(initializeCarouselPosition, 320);
  window.setTimeout(initializeCarouselPosition, 900);
  document.fonts?.ready?.then(initializeCarouselPosition);

  window.addEventListener('resize', resetCarouselPosition);

  carousel.addEventListener('mouseenter', () => {
    if (pauseOnHover) {
      isPaused = true;
    }
  });

  carousel.addEventListener('mouseleave', () => {
    if (pauseOnHover) {
      isPaused = false;
    }
  });

  carousel.addEventListener('focusin', () => {
    if (pauseOnHover) {
      isPaused = true;
    }
  });

  carousel.addEventListener('focusout', () => {
    if (pauseOnHover) {
      isPaused = false;
    }
  });

  carousel.addEventListener('pointerdown', (event) => {
    hasInteracted = true;
    isDragging = true;
    isPaused = true;
    suppressNextClick = false;
    startX = event.clientX;
    startScrollLeft = carousel.scrollLeft;
    lastPointerX = event.clientX;
    lastPointerTime = performance.now();
    momentumVelocity = 0;
  });

  carousel.addEventListener('pointermove', (event) => {
    if (!isDragging) {
      return;
    }

    const deltaX = event.clientX - startX;
    const now = performance.now();
    const frameDelta = Math.max(now - lastPointerTime, 16);
    const pointerDelta = event.clientX - lastPointerX;

    if (!suppressNextClick && Math.abs(deltaX) <= 8) {
      return;
    }

    if (!suppressNextClick) {
      suppressNextClick = true;
      carousel.classList.add('is-dragging');
      try {
        carousel.setPointerCapture?.(event.pointerId);
        hasPointerCapture = true;
      } catch {
        hasPointerCapture = false;
      }
    }

    carousel.scrollLeft = startScrollLeft - deltaX;
    momentumVelocity = -(pointerDelta / frameDelta);
    lastPointerX = event.clientX;
    lastPointerTime = now;
    startScrollLeft += normalizeScroll();
    event.preventDefault();
  });

  function stopDragging(event) {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    carousel.classList.remove('is-dragging');

    if (hasPointerCapture) {
      try {
        carousel.releasePointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      hasPointerCapture = false;
    }

    if (Math.abs(momentumVelocity) < 0.05 || prefersReducedMotion) {
      momentumVelocity = 0;
    } else {
      momentumVelocity = Math.max(Math.min(momentumVelocity, 2.4), -2.4);
    }

    window.setTimeout(() => {
      isPaused = (pauseOnHover && (carousel.matches(':hover') || carousel.contains(document.activeElement))) || Math.abs(momentumVelocity) > 0.02;
    }, 500);
  }

  carousel.addEventListener('pointerup', stopDragging);
  carousel.addEventListener('pointercancel', stopDragging);
  carousel.addEventListener('dragstart', (event) => event.preventDefault());

  carousel.addEventListener(
    'click',
    (event) => {
      if (!suppressNextClick) {
        const link = event.target.closest('a[href]');

        if (
          !link ||
          !carousel.contains(link) ||
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        const target = link.getAttribute('target');
        const href = link.getAttribute('href');

        if (!href || (target && target !== '_self')) {
          return;
        }

        window.location.href = link.href;
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      suppressNextClick = false;
    },
    true,
  );
});

const caseVideoCards = document.querySelectorAll('.case-video-card');

function anyAudibleCaseVideoPlaying() {
  return [...caseVideoCards].some((card) => {
    const video = card.querySelector('video');
    return video && !video.paused && !video.muted && video.volume > 0;
  });
}

caseVideoCards.forEach((card) => {
  const video = card.querySelector('video');
  const playButton = card.querySelector('.case-video-play');
  const fullscreenOnClick = card.hasAttribute('data-case-fullscreen-video');

  if (!video || !playButton) {
    return;
  }

  video.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  // Inject a fullscreen close (×) button that matches the site-wide
  // modal-video close (same character, hover rotate, tv-close animation).
  if (fullscreenOnClick && !card.querySelector('.video-close')) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'video-close';
    closeBtn.setAttribute('aria-label', 'Close fullscreen');
    closeBtn.textContent = '×';
    card.appendChild(closeBtn);
    closeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      card.classList.add('is-closing');
      setTimeout(() => {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }, 520);
    });
  }

  async function openCaseVideoFullscreen() {
    if (!fullscreenOnClick) return;
    video.controls = true;
    video.muted = false;
    video.loop = false;
    video.volume = Math.max(video.volume || 0, 0.75);
    pauseSiteSoundForVideo();

    try {
      if (card.requestFullscreen) {
        await card.requestFullscreen();
      } else if (card.webkitRequestFullscreen) {
        await card.webkitRequestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    } catch (_err) {
      // Fullscreen can be blocked by browser policy; still play with controls.
    }

    video.play().catch(() => {});
  }

  playButton.addEventListener('click', (event) => {
    if (fullscreenOnClick) {
      event.stopPropagation();
      openCaseVideoFullscreen();
      return;
    }
    video.play().catch(() => {});
  });

  if (fullscreenOnClick) {
    video.addEventListener('click', (event) => {
      if (document.fullscreenElement === card || document.webkitFullscreenElement === card) return;
      event.preventDefault();
      event.stopPropagation();
      openCaseVideoFullscreen();
    });

    card.addEventListener('click', (event) => {
      if (document.fullscreenElement === card || document.webkitFullscreenElement === card) return;
      event.preventDefault();
      openCaseVideoFullscreen();
    });
  }

  video.addEventListener('play', () => {
    card.classList.add('is-playing');

    if (!video.muted && video.volume > 0) {
      pauseSiteSoundForVideo();
    }
  });

  video.addEventListener('pause', () => {
    card.classList.remove('is-playing');

    if (!anyAudibleCaseVideoPlaying()) {
      resumeSiteSoundAfterVideo();
    }
  });

  video.addEventListener('ended', () => {
    card.classList.remove('is-playing');

    if (!anyAudibleCaseVideoPlaying()) {
      resumeSiteSoundAfterVideo();
    }
  });
});

function restoreCaseFullscreenVideos() {
  document.querySelectorAll('[data-case-fullscreen-video] video').forEach((video) => {
    const card = video.closest('[data-case-fullscreen-video]');
    if (document.fullscreenElement === card || document.webkitFullscreenElement === card) return;
    // Clean up the CRT close-effect class once the browser has actually
    // returned the card to its inline position.
    card.classList.remove('is-closing');
    video.controls = false;
    video.loop = true;
    video.muted = true;
    video.play().catch(() => {});
    if (!anyAudibleCaseVideoPlaying()) {
      resumeSiteSoundAfterVideo();
    }
  });
}

document.addEventListener('fullscreenchange', restoreCaseFullscreenVideos);
document.addEventListener('webkitfullscreenchange', restoreCaseFullscreenVideos);

document.querySelectorAll('[data-autoplay-video]').forEach((video) => {
  video.muted = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');

  const playSilently = () => {
    video.muted = true;
    video.play().catch(() => {});
  };

  if (typeof IntersectionObserver === 'undefined') {
    playSilently();
    return;
  }

  const autoplayObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          playSilently();
        } else {
          video.pause();
        }
      });
    },
    {
      threshold: 0.35,
    },
  );

  autoplayObserver.observe(video);
});

document.querySelectorAll('[data-flip-card]').forEach((card) => {
  card.addEventListener('click', () => {
    const isFlipped = card.classList.toggle('is-flipped');
    card.setAttribute('aria-pressed', String(isFlipped));
    window.yeaTrack?.('wedding_invitation_flip', {
      label: isFlipped ? 'back' : 'front',
      page_path: window.location.pathname,
    });
  });
});

document.querySelectorAll('[data-batchflow-demo]').forEach((demo) => {
  const demoPhotoBase = 'assets/batchflow-demo-photos/';
  const sampleRows = [
    {
      title: 'AI-Powered Brand Management',
      participant: 'Speaker: Ethan Brooks',
      date: 'March 12, 2026',
      image: 'photo-1.jpg',
    },
    {
      title: 'Easy Ways to Define a Digital Content Strategy',
      participant: 'Speaker: Maya Collins',
      date: 'April 7, 2026',
      image: 'photo-2.jpg',
    },
    {
      title: 'Getting Seen on Social Media',
      participant: 'Speaker: Owen Carter',
      date: 'May 21, 2026',
      image: 'photo-3.jpg',
    },
    {
      title: 'The Importance of Next-Gen Tools in Education',
      participant: 'Speaker: Lina Morgan',
      date: 'June 9, 2026',
      image: 'photo-4.jpg',
    },
    {
      title: 'Automation in Creative Workflows',
      participant: 'Speaker: Nora Hayes',
      date: 'September 18, 2026',
      image: 'photo-5.jpg',
    },
  ];

  const outputFormats = [
    { id: '1920x1080', path: 'assets/batchflow-demo-templates/template-1920x1080.svg', width: 1920, height: 1080 },
    { id: '1920x800', path: 'assets/batchflow-demo-templates/template-1920x800.svg', width: 1920, height: 800 },
    { id: '1080x800', path: 'assets/batchflow-demo-templates/template-1080x800.svg', width: 1080, height: 800 },
    { id: '1080x1350', path: 'assets/batchflow-demo-templates/template-1080x1350.svg', width: 1080, height: 1350 },
    { id: '1080x1920', path: 'assets/batchflow-demo-templates/template-1080x1920.svg', width: 1080, height: 1920 },
  ];

  const rows = [...demo.querySelectorAll('tbody tr')];
  const autofillButton = demo.querySelector('[data-demo-autofill]');
  const startButton = demo.querySelector('[data-demo-start]');
  const downloadButton = demo.querySelector('[data-demo-download]');
  const progress = demo.querySelector('[data-demo-progress]');
  const progressBar = demo.querySelector('[data-demo-progress-bar]');
  const progressValue = demo.querySelector('[data-demo-progress-value]');
  const templateCache = new Map();
  const imageCache = new Map();
  let generatedZip = null;
  let progressTimer = null;

  function field(row, name) {
    return row.querySelector(`[data-demo-field="${name}"]`);
  }

  function readRows() {
    return rows.map((row) => ({
      title: field(row, 'title')?.value.trim() || '',
      participant: field(row, 'participant')?.value.trim() || '',
      date: field(row, 'date')?.value.trim() || '',
      image: field(row, 'image')?.value || '',
      imageData: row.dataset.demoImageData || '',
    }));
  }

  function fillRows() {
    rows.forEach((row, index) => {
      const source = sampleRows[index] || sampleRows[0];
      Object.entries(source).forEach(([key, value]) => {
        const input = field(row, key);
        if (input) input.value = value;
      });
    });
    generatedZip = null;
    if (downloadButton) downloadButton.hidden = true;
    rows.forEach((row) => {
      delete row.dataset.demoImageData;
      row.querySelector('.batchflow-demo-image-cell')?.classList.remove('is-uploaded');
      field(row, 'image')?.querySelector('[data-upload-option]')?.remove();
    });
    window.yeaTrack?.('batchflow_demo_autofill', { page_path: window.location.pathname });
  }

  function setProgress(value) {
    const normalized = Math.max(0, Math.min(100, Math.round(value)));
    if (progressBar) progressBar.style.width = `${normalized}%`;
    if (progressValue) progressValue.textContent = String(normalized);
  }

  function parseSvgAttrs(tag) {
    const attrs = {};
    String(tag).replace(/([\w:-]+)=["']([^"']*)["']/g, (_match, key, value) => {
      attrs[key] = value;
      return '';
    });
    return attrs;
  }

  function parseSvgStyle(style) {
    const attrs = {};
    String(style || '').split(';').forEach((entry) => {
      const [key, ...value] = entry.split(':');
      const name = String(key || '').trim();
      const content = value.join(':').trim();
      if (name && content) attrs[name] = content;
    });
    return attrs;
  }

  function numberFromSvg(value) {
    const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  function svgSize(svg) {
    const openTag = String(svg || '').match(/<svg\b[^>]*>/i)?.[0] || '';
    const attrs = parseSvgAttrs(openTag);
    const viewBox = String(attrs.viewBox || '').trim().split(/[\s,]+/).map(Number);
    if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
      return { width: viewBox[2], height: viewBox[3] };
    }
    return {
      width: numberFromSvg(attrs.width) || 0,
      height: numberFromSvg(attrs.height) || 0,
    };
  }

  function svgTranslate(openTag) {
    const transform = parseSvgAttrs(openTag).transform || '';
    const match = transform.match(/translate\(\s*([-\d.]+)(?:[\s,]+([-\d.]+))?\s*\)/i);
    return {
      x: match ? numberFromSvg(match[1]) : 0,
      y: match ? numberFromSvg(match[2] ?? '0') : 0,
    };
  }

  function setSvgAttr(tag, name, value) {
    const escaped = String(value).replace(/"/g, '&quot;');
    const matcher = new RegExp(`\\s${name}=["'][^"']*["']`, 'i');
    if (matcher.test(tag)) {
      return tag.replace(matcher, ` ${name}="${escaped}"`);
    }
    return tag.replace(/>$/, ` ${name}="${escaped}">`);
  }

  function formatSvgNumber(value) {
    return Number(value.toFixed(2)).toString();
  }

  function escapeSvgText(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function demoTextNodes(svg, fieldName) {
    const textPattern = /<text\b[^>]*>[\s\S]*?<\/text>/gi;
    const placeholderPattern = new RegExp(`\\{\\{\\s*${fieldName}\\s*\\}\\}`, 'i');
    const nodes = [];
    for (const match of svg.matchAll(textPattern)) {
      const raw = match[0];
      if (!placeholderPattern.test(raw)) continue;
      const openTag = raw.match(/^<text\b[^>]*>/i)?.[0] || '<text>';
      const attrs = parseSvgAttrs(openTag);
      const styleAttrs = parseSvgStyle(attrs.style);
      nodes.push({
        raw,
        openTag,
        fontSize: numberFromSvg(attrs['font-size'] || styleAttrs['font-size']) || 48,
        fontFamily: attrs['font-family'] || styleAttrs['font-family'] || 'Arial',
        fontWeight: attrs['font-weight'] || styleAttrs['font-weight'] || '700',
        fontStyle: attrs['font-style'] || styleAttrs['font-style'] || 'normal',
        letterSpacingRaw: attrs['letter-spacing'] || styleAttrs['letter-spacing'] || '0',
        textAnchor: attrs['text-anchor'] || styleAttrs['text-anchor'] || '',
      });
    }
    return nodes;
  }

  function demoRects(svg, fieldName) {
    const key = `_x7B__x7B_${fieldName}_x7D__x7D_`;
    const rects = [];
    for (const match of svg.matchAll(/<rect\b[^>]*\/>/gi)) {
      const raw = match[0];
      const attrs = parseSvgAttrs(raw);
      if (!String(attrs.id || '').includes(key) && !String(attrs['data-name'] || '').includes(key)) {
        continue;
      }
      const x = numberFromSvg(attrs.x);
      const y = numberFromSvg(attrs.y);
      const width = numberFromSvg(attrs.width);
      const height = numberFromSvg(attrs.height);
      if ([x, y, width, height].every(Number.isFinite)) {
        rects.push({ x, y, width, height });
      }
    }
    return rects;
  }

  function resolvedTextAnchor(svg, fieldName, currentAnchor) {
    const anchor = String(currentAnchor || '').trim();
    if (['start', 'middle', 'end'].includes(anchor)) return anchor;
    if (fieldName === 'Tarih') return 'middle';
    const size = svgSize(svg);
    return Math.round(size.width) === 1080 && (Math.round(size.height) === 1350 || Math.round(size.height) === 1920)
      ? 'middle'
      : 'start';
  }

  function letterSpacingPx(raw, fontSize) {
    const parsed = numberFromSvg(raw);
    if (!Number.isFinite(parsed)) return 0;
    return /em$/i.test(String(raw).trim()) ? parsed * fontSize : parsed;
  }

  function measureDemoText(text, fontSize, node) {
    if (typeof document === 'undefined') return String(text || '').length * fontSize * 0.58;
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return String(text || '').length * fontSize * 0.58;
    const family = String(node?.fontFamily || 'Arial').split(',')[0].replace(/["']/g, '').trim() || 'Arial';
    context.font = `${node?.fontStyle || 'normal'} ${node?.fontWeight || '700'} ${fontSize}px ${family}`;
    const letterSpacing = letterSpacingPx(node?.letterSpacingRaw || '0', fontSize);
    return context.measureText(String(text || '')).width + Math.max(0, String(text || '').length - 1) * letterSpacing;
  }

  function lineCombinations(words, maxLines) {
    const combinations = [];
    const walk = (start, remaining, current) => {
      if (start >= words.length) {
        combinations.push(current);
        return;
      }
      if (remaining <= 0) return;
      for (let end = start + 1; end <= words.length; end += 1) {
        if (words.length - end < remaining - 1) continue;
        walk(end, remaining - 1, [...current, words.slice(start, end).join(' ')]);
      }
    };
    for (let lineCount = 1; lineCount <= maxLines; lineCount += 1) {
      walk(0, lineCount, []);
    }
    return combinations;
  }

  function idealLineCount(wordCount, maxLines, fieldName) {
    if (fieldName !== 'Başlık' || maxLines <= 1 || wordCount <= 2) return 1;
    if (wordCount <= 5) return Math.min(2, maxLines);
    return Math.min(3, maxLines);
  }

  function lineFontSize(lines, nodes, rects, fieldName) {
    let size = Infinity;
    for (let index = 0; index < Math.max(1, lines.length); index += 1) {
      const text = lines[index] || '';
      const node = nodes[index] || nodes[0];
      const rect = rects[index] || rects[0];
      const base = Math.max(1, Number(node?.fontSize) || 48);
      const heightLimit = rect ? rect.height * (fieldName === 'Tarih' ? 0.78 : 0.82) : base;
      const widthLimit = rect ? rect.width * 0.96 : Number.POSITIVE_INFINITY;
      const measured = measureDemoText(text, 1, node);
      const widthSize = measured > 0 ? widthLimit / measured : base;
      size = Math.min(size, Math.max(10, Math.min(base, heightLimit, widthSize)));
    }
    return Number.isFinite(size) ? size : 24;
  }

  function lineBalanceScore(lines, fontSize, nodes, idealCount) {
    const widths = lines.map((line, index) => measureDemoText(line, fontSize, nodes[index] || nodes[0]));
    const max = Math.max(...widths, 1);
    const min = Math.min(...widths, max);
    const average = widths.reduce((sum, width) => sum + width, 0) / Math.max(1, widths.length);
    const uneven = widths.reduce((sum, width) => sum + Math.abs(width - average), 0) / Math.max(1, widths.length) / max;
    const shortLast = widths.length > 1 && widths[widths.length - 1] < average * 0.58 ? 0.12 : 0;
    const spread = (max - min) / max;
    const countPenalty = Math.abs(lines.length - idealCount) * 0.18;
    const singleLinePenalty = idealCount > 1 && lines.length === 1 ? 0.2 : 0;
    const oneWordPenalty = lines.length >= 2 && lines.every((line) => !line.trim().includes(' ')) ? 0.15 : 0;
    const penalty = Math.min(0.55, uneven * 0.38 + spread * 0.18 + shortLast + countPenalty + singleLinePenalty + oneWordPenalty);
    return Math.pow(fontSize, 0.85) * (1 - penalty);
  }

  function chooseLines(value, maxLines, nodes, rects, fieldName) {
    const text = String(value || '').trim();
    if (!text || fieldName === 'Tarih' || maxLines <= 1) return [text];
    const words = text.split(/\s+/);
    const candidates = lineCombinations(words, maxLines);
    let best = candidates[0] || [text];
    let bestScore = -Infinity;
    const ideal = idealLineCount(words.length, maxLines, fieldName);
    candidates.forEach((candidate) => {
      const fontSize = lineFontSize(candidate, nodes, rects, fieldName);
      const score = lineBalanceScore(candidate, fontSize, nodes, ideal);
      if (score > bestScore + 0.01 || (Math.abs(score - bestScore) <= 0.01 && Math.abs(candidate.length - ideal) < Math.abs(best.length - ideal))) {
        best = candidate;
        bestScore = score;
      }
    });
    return best;
  }

  function compressedLinePositions(basePositions, fontSize, baseFontSize) {
    if (basePositions.length <= 1) return basePositions.slice();
    const ratio = Number(fontSize) / Number(baseFontSize || 1);
    const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 1;
    const exponent = 1.2 + (1 - safeRatio) * 0.35;
    const lowerBound = Math.max(0.42, Math.min(0.64, 0.64 - (1 - safeRatio) * 0.18));
    const compression = Math.max(lowerBound, Math.min(1, Math.pow(safeRatio, exponent)));
    const first = basePositions[0];
    const positions = basePositions.map((position, index) => (index === 0 ? position : first + (position - first) * compression));
    const minimumGap = Math.max(0, Number(fontSize)) * 1.22;
    for (let index = 1; index < positions.length; index += 1) {
      const minimum = positions[index - 1] + minimumGap;
      if (positions[index] < minimum) positions[index] = minimum;
    }
    return positions;
  }

  function textNodeMarkup(node, rect, text, fontSize, yPosition) {
    const anchor = node.textAnchor || 'start';
    const x = rect
      ? anchor === 'middle'
        ? rect.x + rect.width / 2
        : anchor === 'end'
          ? rect.x + rect.width
          : rect.x
      : svgTranslate(node.openTag).x;
    const y = Number.isFinite(yPosition) ? Number(yPosition) : (rect ? rect.y + rect.height * 0.78 : svgTranslate(node.openTag).y);
    let openTag = setSvgAttr(node.openTag, 'font-size', formatSvgNumber(fontSize));
    openTag = setSvgAttr(openTag, 'text-anchor', anchor);
    openTag = setSvgAttr(openTag, 'transform', `translate(${formatSvgNumber(x)} ${formatSvgNumber(y)})`);
    return `${openTag}<tspan x="0" y="0">${escapeSvgText(text)}</tspan></text>`;
  }

  function replaceDemoText(svg, fieldName, value) {
    const nodes = demoTextNodes(svg, fieldName).map((node) => ({
      ...node,
      textAnchor: resolvedTextAnchor(svg, fieldName, node.textAnchor),
    }));
    if (!nodes.length) {
      return svg.replace(new RegExp(`\\{\\{\\s*${fieldName}\\s*\\}\\}`, 'g'), escapeSvgText(value));
    }
    const rects = demoRects(svg, fieldName);
    const maxLines = Math.min(nodes.length, Math.max(1, rects.length || nodes.length));
    const lines = chooseLines(value, maxLines, nodes, rects, fieldName);
    const fontSize = lineFontSize(lines, nodes, rects, fieldName);
    const baseFontSize = Math.max(1, Number(nodes[0]?.fontSize) || 48);
    const baseY = nodes.map((node, index) => {
      const rect = rects[index] || rects[0] || null;
      return rect ? rect.y + rect.height * 0.78 : svgTranslate(node.openTag).y;
    });
    const yPositions = compressedLinePositions(baseY, fontSize, baseFontSize);
    let nextSvg = svg;
    nodes.forEach((node, index) => {
      const rect = rects[index] || rects[0] || null;
      nextSvg = nextSvg.replace(node.raw, textNodeMarkup(node, rect, lines[index] || '', fontSize, yPositions[index]));
    });
    return nextSvg;
  }

  function removeDemoTextRects(svg) {
    return svg.replace(/<rect\b(?=[^>]*(?:id|data-name)="_x7B__x7B_(?:Başlık|Katılımcı|Tarih)_x7D__x7D_[^"]*")[^>]*\/>/gi, '');
  }

  function insertDemoImage(svg, outputIndex, imageData) {
    return svg.replace(/<rect\b[^>]*id="_x7B__x7B_image_x7D__x7D_"[^>]*\/>/i, (raw) => {
      const attrs = parseSvgAttrs(raw);
      const x = attrs.x ?? '0';
      const y = attrs.y ?? '0';
      const width = attrs.width ?? '100';
      const height = attrs.height ?? '100';
      const rx = attrs.rx ?? '0';
      const ry = attrs.ry ?? rx;
      const clipId = `bf-demo-image-${outputIndex}`;
      return [
        `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" ry="${ry}"/></clipPath></defs>`,
        `<image x="${x}" y="${y}" width="${width}" height="${height}" href="${imageData}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`,
      ].join('');
    });
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function imageDataForRow(row, index) {
    if (row.imageData) return row.imageData;
    const imageName = row.image || sampleRows[index % sampleRows.length].image;
    if (imageCache.has(imageName)) return imageCache.get(imageName);
    const response = await fetch(`${demoPhotoBase}${encodeURIComponent(imageName)}`);
    if (!response.ok) throw new Error(`Demo image could not be loaded: ${imageName}`);
    const dataUrl = await fileToDataUrl(await response.blob());
    imageCache.set(imageName, dataUrl);
    return dataUrl;
  }

  async function templateSource(format) {
    if (templateCache.has(format.id)) return templateCache.get(format.id);
    const response = await fetch(format.path);
    if (!response.ok) throw new Error(`Demo template could not be loaded: ${format.id}`);
    const source = await response.text();
    templateCache.set(format.id, source);
    return source;
  }

  async function createDemoSvg(row, format, index) {
    const fallback = sampleRows[index % sampleRows.length];
    let svg = await templateSource(format);
    svg = replaceDemoText(svg, 'Başlık', row.title || fallback.title);
    svg = replaceDemoText(svg, 'Katılımcı', row.participant || fallback.participant);
    svg = replaceDemoText(svg, 'Tarih', row.date || fallback.date);
    svg = removeDemoTextRects(svg);
    svg = insertDemoImage(svg, `${index}-${format.id}`, await imageDataForRow(row, index));
    return {
      ...format,
      fileName: `batchflow-demo-${String(index + 1).padStart(2, '0')}-${format.id}.svg`,
      svg,
    };
  }

  function makeCrcTable() {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c >>> 0;
    }
    return table;
  }

  const crcTable = makeCrcTable();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function copyBuffer(bytes) {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
  }

  function createZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    files.forEach((file) => {
      const nameBytes = encoder.encode(file.name);
      const dataBytes = file.bytes || encoder.encode(file.content || '');
      const checksum = crc32(dataBytes);
      const local = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(10, dosTime, true);
      localView.setUint16(12, dosDate, true);
      localView.setUint32(14, checksum, true);
      localView.setUint32(18, dataBytes.length, true);
      localView.setUint32(22, dataBytes.length, true);
      localView.setUint16(26, nameBytes.length, true);
      local.set(nameBytes, 30);
      localParts.push(local, dataBytes);

      const central = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(12, dosTime, true);
      centralView.setUint16(14, dosDate, true);
      centralView.setUint32(16, checksum, true);
      centralView.setUint32(20, dataBytes.length, true);
      centralView.setUint32(24, dataBytes.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centralParts.push(central);
      offset += local.length + dataBytes.length;
    });

    const centralOffset = offset;
    let centralSize = 0;
    centralParts.forEach((part) => {
      centralSize += part.length;
      localParts.push(part);
    });

    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, files.length, true);
    endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, centralOffset, true);
    localParts.push(end);

    return new Blob(localParts.map(copyBuffer), { type: 'application/zip' });
  }

  function imageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  function canvasToBlob(canvas, type) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('PNG export failed.'));
        }
      }, type);
    });
  }

  async function svgOutputToPng(output) {
    const blob = new Blob([output.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const image = await imageFromUrl(url);
      const canvas = document.createElement('canvas');
      canvas.width = output.width;
      canvas.height = output.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas context could not be created.');
      context.drawImage(image, 0, 0, output.width, output.height);
      const pngBlob = await canvasToBlob(canvas, 'image/png');
      return {
        name: output.fileName.replace(/\.svg$/i, '.png'),
        bytes: new Uint8Array(await pngBlob.arrayBuffer()),
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function buildOutputs() {
    const rowsToRender = readRows();
    const outputs = [];
    for (let rowIndex = 0; rowIndex < rowsToRender.length; rowIndex += 1) {
      const row = rowsToRender[rowIndex];
      for (const format of outputFormats) {
        const output = await createDemoSvg(row, format, rowIndex);
        outputs.push(output);
      }
    }
    return outputs;
  }

  async function startProduction() {
    if (!startButton || !progress || !downloadButton) return;
    window.clearInterval(progressTimer);
    generatedZip = null;
    downloadButton.hidden = true;
    progress.hidden = false;
    startButton.disabled = true;
    if (autofillButton) autofillButton.disabled = true;
    startButton.textContent = 'Generating...';
    setProgress(0);

    let value = 0;
    progressTimer = window.setInterval(() => {
      value = Math.min(92, value + (value < 70 ? 8 : 4));
      setProgress(value);
    }, 85);

    try {
      generatedZip = await buildOutputs();
      window.clearInterval(progressTimer);
      setProgress(100);
      downloadButton.hidden = false;
      window.yeaTrack?.('batchflow_demo_render_success', {
        output_count: rows.length * outputFormats.length,
        page_path: window.location.pathname,
      });
    } catch (_err) {
      window.clearInterval(progressTimer);
      setProgress(0);
    } finally {
      startButton.disabled = false;
      if (autofillButton) autofillButton.disabled = false;
      startButton.textContent = 'Start Production';
    }
  }

  async function downloadOutputs() {
    if (!generatedZip) {
      generatedZip = await buildOutputs();
    }
    const pngFiles = await Promise.all(generatedZip.map(svgOutputToPng));
    const url = URL.createObjectURL(createZip(pngFiles));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'batchflow-demo-outputs.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    window.yeaTrack?.('batchflow_demo_download', { page_path: window.location.pathname });
  }

  autofillButton?.addEventListener('click', fillRows);
  startButton?.addEventListener('click', startProduction);
  downloadButton?.addEventListener('click', downloadOutputs);
  rows.forEach((row) => {
    const imageCell = row.querySelector('.batchflow-demo-image-cell');
    const select = field(row, 'image');
    const fileInput = row.querySelector('[data-demo-file]');
    const uploadButton = row.querySelector('[data-demo-upload]');

    uploadButton?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      row.dataset.demoImageData = await fileToDataUrl(file);
      if (select) {
        select.querySelector('[data-upload-option]')?.remove();
        const uploadOption = document.createElement('option');
        uploadOption.value = file.name;
        uploadOption.textContent = file.name;
        uploadOption.dataset.uploadOption = 'true';
        select.appendChild(uploadOption);
        select.value = file.name;
      }
      imageCell?.classList.add('is-uploaded');
      uploadButton?.setAttribute('title', file.name);
      generatedZip = null;
      if (downloadButton) downloadButton.hidden = true;
    });

    select?.addEventListener('change', () => {
      delete row.dataset.demoImageData;
      select.querySelector('[data-upload-option]')?.remove();
      imageCell?.classList.remove('is-uploaded');
      uploadButton?.removeAttribute('title');
      generatedZip = null;
      if (downloadButton) downloadButton.hidden = true;
    });
  });
});

document.querySelectorAll('.skills-list li').forEach((item, index) => {
  const trigger = item.querySelector('.skill-trigger');
  const description = item.querySelector('.skill-description');

  if (!trigger || !description) {
    return;
  }

  const panelId = `skill-description-${index + 1}`;
  description.id = panelId;
  trigger.setAttribute('aria-controls', panelId);
  trigger.setAttribute('aria-expanded', 'false');

  trigger.addEventListener('click', () => {
    const isOpen = item.classList.toggle('is-open');
    trigger.setAttribute('aria-expanded', String(isOpen));
  });
});

const videoOverlay = document.querySelector('.video-overlay');
const modalVideo = document.querySelector('.modal-video');
const modalVideoSource = modalVideo?.querySelector('source');
const videoCloseButton = document.querySelector('.video-close');
const videoTriggers = document.querySelectorAll('[data-video-trigger]');
const videoPlayToggle = document.querySelector('.video-play-toggle');
const videoScrubber = document.querySelector('.video-scrubber');
const videoMuteButton = document.querySelector('.video-mute');
const videoFullscreenBtn = document.querySelector('.video-fullscreen');
const videoFrame = document.querySelector('.video-frame');
let videoIsClosing = false;
let videoIsScrubbing = false;
let modalVideoCompletedTracked = false;
let modalVideoCloseInProgress = false;
let activeModalVideoLabel = 'colins_valentines_day';
const defaultModalVideoSrc = modalVideoSource?.getAttribute('src') || modalVideo?.getAttribute('src') || '';
const defaultModalVideoType = modalVideoSource?.getAttribute('type') || '';

function updatePlayButton() {
  if (!videoPlayToggle || !modalVideo) {
    return;
  }

  videoPlayToggle.textContent = modalVideo.paused ? 'play' : 'pause';
  videoPlayToggle.setAttribute('aria-label', modalVideo.paused ? 'Play video' : 'Pause video');
}

function updateMuteButton() {
  if (!videoMuteButton || !modalVideo) {
    return;
  }

  videoMuteButton.textContent = modalVideo.muted || modalVideo.volume === 0 ? 'muted' : 'sound';
  videoMuteButton.setAttribute('aria-label', modalVideo.muted || modalVideo.volume === 0 ? 'Unmute video' : 'Mute video');
}

function updateVideoScrubber() {
  if (!videoScrubber || !modalVideo || !Number.isFinite(modalVideo.duration)) {
    return;
  }

  videoScrubber.max = String(modalVideo.duration);

  if (!videoIsScrubbing) {
    videoScrubber.value = String(modalVideo.currentTime);
  }
}

function openVideoOverlay(event) {
  event.preventDefault();

  if (!videoOverlay || !modalVideo || videoIsClosing) {
    return;
  }

  const trigger = event.currentTarget;
  const nextVideoSrc = trigger?.dataset.videoSrc;
  const nextVideoType = trigger?.dataset.videoType || '';
  const targetVideoSrc = nextVideoSrc || defaultModalVideoSrc;
  const targetVideoType = nextVideoType || defaultModalVideoType;
  activeModalVideoLabel = trigger?.dataset.videoLabel || trigger?.dataset.trackLabel || 'colins_valentines_day';
  pauseAllPreviewVideos();

  if (targetVideoSrc) {
    if (modalVideoSource) {
      if (targetVideoType) {
        modalVideoSource.type = targetVideoType;
      }
      modalVideoSource.removeAttribute('src');
    }
    modalVideo.src = targetVideoSrc;
    modalVideo.preload = 'auto';
    modalVideo.load();
  } else if (modalVideoSource?.src && !modalVideo.currentSrc) {
    modalVideo.load();
  }

  document.body.classList.add('is-video-open');
  videoOverlay.classList.remove('is-closing', 'is-leaving');
  videoOverlay.classList.add('is-open');
  videoOverlay.setAttribute('aria-hidden', 'false');
  modalVideo.controls = false;
  modalVideo.setAttribute('controlsList', 'nodownload noplaybackrate');
  modalVideo.setAttribute('disablePictureInPicture', '');
  modalVideo.currentTime = 0;
  modalVideoCompletedTracked = false;
  modalVideoCloseInProgress = false;
  modalVideo.muted = false;
  modalVideo.volume = 0.75;
  pauseSiteSoundForVideo();
  updateMuteButton();
  updateVideoScrubber();
  modalVideo.play().catch(() => {
    modalVideo.muted = true;
    resumeSiteSoundAfterVideo();
    updateMuteButton();
    modalVideo.play().catch(() => {});
  });
  updatePlayButton();
  videoCloseButton?.focus({ preventScroll: true });
}

function closeVideoOverlay() {
  if (!videoOverlay || !modalVideo || videoIsClosing || !videoOverlay.classList.contains('is-open')) {
    return;
  }

  videoIsClosing = true;
  modalVideoCloseInProgress = true;
  videoOverlay.classList.add('is-closing');

  window.setTimeout(() => {
    modalVideo.pause();
    videoOverlay.classList.add('is-leaving');
  }, 520);

  window.setTimeout(() => {
    videoOverlay.style.transition = 'none';
    videoOverlay.classList.remove('is-open', 'is-closing', 'is-leaving');
    videoOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-video-open');
    modalVideo.removeAttribute('src');
    if (modalVideoSource) {
      modalVideoSource.removeAttribute('src');
    }
    modalVideo.load();
    videoIsClosing = false;
    resumeSiteSoundAfterVideo();
    videoOverlay.offsetHeight;
    videoOverlay.style.transition = '';
  }, 1040);
}

videoTriggers.forEach((trigger) => {
  trigger.addEventListener('click', openVideoOverlay);
});

videoCloseButton?.addEventListener('click', closeVideoOverlay);

modalVideo?.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

modalVideo?.addEventListener('timeupdate', () => {
  updateVideoScrubber();

  if (
    !modalVideoCompletedTracked &&
    Number.isFinite(modalVideo.duration) &&
    modalVideo.duration > 0 &&
    modalVideo.currentTime / modalVideo.duration >= 0.95
  ) {
    modalVideoCompletedTracked = true;
    window.yeaTrack?.('video_complete', {
      label: activeModalVideoLabel,
      page_path: window.location.pathname,
    });
  }
});

modalVideo?.addEventListener('loadedmetadata', updateVideoScrubber);
modalVideo?.addEventListener('durationchange', updateVideoScrubber);
modalVideo?.addEventListener('ended', resumeSiteSoundAfterVideo);

modalVideo?.addEventListener('play', () => {
  if (modalVideoHasSound()) {
    pauseSiteSoundForVideo();
  }

  updatePlayButton();
  window.yeaTrack?.('video_play', {
    label: activeModalVideoLabel,
    page_path: window.location.pathname,
  });
});

modalVideo?.addEventListener('pause', () => {
  updatePlayButton();

  if (!modalVideoCloseInProgress) {
    window.yeaTrack?.('video_pause', {
      label: activeModalVideoLabel,
      current_time: Number(modalVideo.currentTime.toFixed(2)),
      page_path: window.location.pathname,
    });
  }
});

videoScrubber?.addEventListener('pointerdown', () => {
  if (!modalVideo || !Number.isFinite(modalVideo.duration)) return;
  videoScrubber.max = String(modalVideo.duration);
  videoIsScrubbing = true;
});

videoScrubber?.addEventListener('input', () => {
  if (!modalVideo || !Number.isFinite(modalVideo.duration)) return;
  videoIsScrubbing = true;
  modalVideo.currentTime = Number(videoScrubber.value);
});

videoScrubber?.addEventListener('pointerup', () => {
  videoIsScrubbing = false;
  updateVideoScrubber();
});

videoPlayToggle?.addEventListener('click', () => {
  if (!modalVideo) {
    return;
  }

  if (modalVideo.paused) {
    modalVideo.play().catch(() => {});
  } else {
    modalVideo.pause();
  }

  updatePlayButton();
});

videoMuteButton?.addEventListener('click', () => {
  if (!modalVideo) {
    return;
  }

  modalVideo.muted = !modalVideo.muted;
  updateMuteButton();

  if (modalVideoHasSound() && !modalVideo.paused) {
    pauseSiteSoundForVideo();
  } else {
    resumeSiteSoundAfterVideo();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      closeVideoOverlay();
    }
  }
});

function updateFullscreenButton() {
  if (!videoFullscreenBtn) return;
  const isFs = !!document.fullscreenElement;
  videoFullscreenBtn.textContent = isFs ? 'exit' : 'full';
  videoFullscreenBtn.setAttribute('aria-label', isFs ? 'Exit full screen' : 'Enter full screen');
}

videoFullscreenBtn?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    videoFrame?.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);

document.querySelectorAll('[data-wallpaper-carousel]').forEach((carousel) => {
  const track = carousel.querySelector('[data-wallpaper-track]');
  const slides = Array.from(track?.querySelectorAll('.printenart-wallpaper-slide') || []);
  const layout = carousel.closest('.printenart-wallpaper-layout');
  const downloadButton = layout?.querySelector('.printenart-download[data-wallpaper-download]');
  const prevButton = carousel.querySelector('[data-wallpaper-prev]');
  const nextButton = carousel.querySelector('[data-wallpaper-next]');
  let activeIndex = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerLastX = 0;
  let pointerLastY = 0;
  let pointerIsDown = false;

  if (!slides.length) {
    return;
  }

  function updateWallpaperState() {
    // Offset-based positioning: each slide knows its signed distance from
    // the active slide (with shortest-path wrap so a "next" press from the
    // last slide pulls the first slide in from the right rather than from
    // far across the carousel). is-prev / is-next mark the immediate
    // neighbours so they stay opaque while peeking in during a drag.
    const len = slides.length;
    const half = len / 2;
    slides.forEach((slide, index) => {
      let offset = index - activeIndex;
      if (offset > half) offset -= len;
      if (offset < -half) offset += len;
      slide.style.setProperty('--wallpaper-slide-offset', String(offset));
      slide.classList.toggle('is-active', offset === 0);
      slide.classList.toggle('is-prev', offset === -1);
      slide.classList.toggle('is-next', offset === 1);
    });

    const activeSlide = slides[activeIndex];
    const wallpaperSrc = activeSlide?.dataset.wallpaperSrc || activeSlide?.querySelector('img')?.getAttribute('src') || '';
    const wallpaperName = activeSlide?.dataset.wallpaperDownload || wallpaperSrc.split('/').pop() || '';

    if (downloadButton) {
      downloadButton.dataset.wallpaperSrc = wallpaperSrc;
      downloadButton.dataset.wallpaperDownload = wallpaperName;

      if (wallpaperSrc) {
        downloadButton.setAttribute('href', wallpaperSrc);
        downloadButton.setAttribute('download', wallpaperName);
        downloadButton.setAttribute('aria-disabled', 'false');
        downloadButton.removeAttribute('disabled');
      } else {
        downloadButton.removeAttribute('href');
        downloadButton.removeAttribute('download');
        downloadButton.setAttribute('aria-disabled', 'true');
        downloadButton.setAttribute('disabled', '');
      }
    }
  }

  function goToWallpaper(nextIndex) {
    activeIndex = (nextIndex + slides.length) % slides.length;
    updateWallpaperState();
  }

  prevButton?.addEventListener('click', () => goToWallpaper(activeIndex - 1));
  nextButton?.addEventListener('click', () => goToWallpaper(activeIndex + 1));

  function startWallpaperDrag(clientX, clientY) {
    pointerIsDown = true;
    pointerStartX = clientX;
    pointerStartY = clientY;
    pointerLastX = clientX;
    pointerLastY = clientY;
    carousel.style.setProperty('--wallpaper-drag-x', '0px');
    carousel.classList.add('is-dragging');
  }
  
  // Hair-trigger thresholds: a clearly-horizontal drag of ~28px commits
  // immediately while the user is still pressing, so the carousel feels
  // responsive instead of waiting for release. On release we accept much
  // smaller gestures (5px) so a quick flick or a slow short drag both
  // advance reliably.
  const DRAG_COMMIT_THRESHOLD = 28;
  const RELEASE_THRESHOLD = 5;

  function moveWallpaperDrag(clientX, clientY) {
    if (!pointerIsDown) {
      return;
    }

    pointerLastX = clientX;
    pointerLastY = clientY;
    const deltaX = clientX - pointerStartX;
    const deltaY = clientY - pointerStartY;

    // Trigger during the drag itself so the user does not have to release
    // before seeing the change. Vertical drags (deltaY larger than deltaX)
    // are ignored so page scrolling still flows through.
    if (Math.abs(deltaX) >= DRAG_COMMIT_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 0.9) {
      const direction = deltaX < 0 ? 1 : -1;
      goToWallpaper(activeIndex + direction);
      pointerIsDown = false;
      carousel.classList.remove('is-dragging');
      carousel.style.removeProperty('--wallpaper-drag-x');
      return;
    }

    const dragX = Math.max(-86, Math.min(86, deltaX));
    carousel.style.setProperty('--wallpaper-drag-x', `${dragX}px`);
  }

  function finishWallpaperDrag() {
    if (!pointerIsDown) {
      return;
    }

    pointerIsDown = false;
    carousel.classList.remove('is-dragging');
    carousel.style.removeProperty('--wallpaper-drag-x');

    const deltaX = pointerLastX - pointerStartX;
    const deltaY = pointerLastY - pointerStartY;

    if (Math.abs(deltaX) > RELEASE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 0.55) {
      goToWallpaper(activeIndex + (deltaX < 0 ? 1 : -1));
    }
  }

  if (window.PointerEvent) {
    carousel.addEventListener('pointerdown', (event) => {
      if (event.button && event.button !== 0) {
        return;
      }

      startWallpaperDrag(event.clientX, event.clientY);
      carousel.setPointerCapture?.(event.pointerId);
    });

    carousel.addEventListener('pointermove', (event) => {
      if (pointerIsDown && Math.abs(event.clientX - pointerStartX) > 4) {
        event.preventDefault();
      }

      moveWallpaperDrag(event.clientX, event.clientY);
    });

    carousel.addEventListener('pointerup', (event) => {
      finishWallpaperDrag();
      carousel.releasePointerCapture?.(event.pointerId);
    });

    carousel.addEventListener('pointercancel', (event) => {
      finishWallpaperDrag();
      carousel.releasePointerCapture?.(event.pointerId);
    });

    carousel.addEventListener('lostpointercapture', () => {
      if (!pointerIsDown) {
        carousel.classList.remove('is-dragging');
        carousel.style.removeProperty('--wallpaper-drag-x');
      }
    });
  } else {
    carousel.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      startWallpaperDrag(event.clientX, event.clientY);
    });

    window.addEventListener('mousemove', (event) => {
      if (pointerIsDown && Math.abs(event.clientX - pointerStartX) > 4) {
        event.preventDefault();
      }

      moveWallpaperDrag(event.clientX, event.clientY);
    });

    window.addEventListener('mouseup', finishWallpaperDrag);

    carousel.addEventListener('touchstart', (event) => {
      const touch = event.touches[0];
      startWallpaperDrag(touch.clientX, touch.clientY);
    }, { passive: true });

    carousel.addEventListener('touchmove', (event) => {
      const touch = event.touches[0];
      if (touch && Math.abs(touch.clientX - pointerStartX) > 4) {
        event.preventDefault();
      }

      moveWallpaperDrag(touch.clientX, touch.clientY);
    }, { passive: false });

    carousel.addEventListener('touchend', finishWallpaperDrag);
    carousel.addEventListener('touchcancel', finishWallpaperDrag);
  }

  carousel.addEventListener('dragstart', (event) => {
    event.preventDefault();
  });

  // Initial render: place every slide at its computed offset (the markup
  // marks one slide as is-active, but the offsets need to be applied so the
  // others animate from the right side instead of all stacking at 0).
  updateWallpaperState();

  downloadButton?.addEventListener('click', (event) => {
    const wallpaperSrc = downloadButton.dataset.wallpaperSrc;

    if (!wallpaperSrc) {
      event.preventDefault();
      return;
    }

    window.yeaTrack?.('printenart_wallpaper_download', {
      label: downloadButton.dataset.wallpaperDownload || wallpaperSrc.split('/').pop() || 'printenart-wallpaper',
      page_path: window.location.pathname,
    });
  });

  updateWallpaperState();
});

// Mock browser window controls on the miniapps case page. The three dots in
// the .miniapps-browser-top act like macOS traffic-light buttons (red close,
// yellow minimize, green fullscreen). Desktop only: below 1101px the dots
// stay decorative via the pointer-events rule in CSS.
(() => {
  const browser = document.querySelector('.miniapps-browser');
  if (!browser) return;

  const desktopMQ = window.matchMedia('(min-width: 1101px)');

  function applyAction(action) {
    if (browser.classList.contains('is-closed')) return;
    switch (action) {
      case 'close':
        browser.classList.remove('is-minimized', 'is-fullscreen');
        browser.classList.add('is-closed');
        break;
      case 'minimize':
        if (browser.classList.contains('is-minimized')) {
          browser.classList.remove('is-minimized');
        } else {
          browser.classList.remove('is-fullscreen');
          browser.classList.add('is-minimized');
        }
        break;
      case 'fullscreen':
        if (browser.classList.contains('is-fullscreen')) {
          browser.classList.remove('is-fullscreen');
        } else {
          browser.classList.remove('is-minimized');
          browser.classList.add('is-fullscreen');
        }
        break;
    }
    document.body.classList.toggle(
      'miniapps-fullscreen-active',
      browser.classList.contains('is-fullscreen'),
    );
  }

  browser.addEventListener('click', (event) => {
    if (!desktopMQ.matches) return;
    const target = event.target.closest('[data-window-action]');
    if (!target) return;
    applyAction(target.dataset.windowAction);
  });

  desktopMQ.addEventListener('change', (event) => {
    if (!event.matches) {
      // Resized down to tablet/mobile: drop interactive states so the layout
      // returns to its responsive defaults. is-closed stays put on purpose,
      // a refresh is the only way to bring back a closed window.
      browser.classList.remove('is-minimized', 'is-fullscreen');
      document.body.classList.remove('miniapps-fullscreen-active');
    }
  });
})();

// Cosmic idle mode. After 2 minutes of no user input on the home page the
// entire UI fades, the orbit stage centers in the viewport, the accretion
// disk lights up, and the three orbit bodies float on a tuned 3-body
// simulation. Any input restores everything. Desktop only, and a no-op for
// reduced-motion users.
(() => {
  if (!orbitSystem || orbitItems.length === 0) return;
  if (prefersReducedMotion) return;

  const desktopMQ = window.matchMedia('(min-width: 1101px)');
  if (!desktopMQ.matches) return;

  // Debug helpers for testing without waiting two minutes.
  //   ?cosmic       -> trigger cosmic mode almost instantly (200ms)
  //   ?idle=<sec>   -> set the threshold to N seconds for this load only
  //   ?lock         -> stay locked in cosmic mode regardless of input
  //                    (press Escape to exit). Useful when grabbing a stable
  //                    screenshot of the settled cosmic state.
  const debugParams = new URLSearchParams(window.location.search);
  const debugIdleSec = Number(debugParams.get('idle'));
  const debugInstant = debugParams.has('cosmic');
  const debugLock = debugParams.has('lock');
  const IDLE_THRESHOLD_MS = debugInstant
    ? 200
    : Number.isFinite(debugIdleSec) && debugIdleSec > 0
      ? debugIdleSec * 1000
      : 120000;
  const orbitStage = document.querySelector('.orbit-stage');
  if (!orbitStage) return;

  // Tuned for visual chaos that stays bounded. BH gravity dominates so stars
  // can't escape; soft boundary nudges keep them inside an annulus; mutual
  // forces between stars are the source of three-body perturbation.
  // The current tuning emphasizes Kepler-like speed variation: stars
  // swinging close to the BH visibly accelerate, then decelerate as they
  // arc back out. starGM is kept modest so mutual perturbation flavours
  // the chaos without drowning out the central-gravity speed signature.
  const PHYSICS = {
    centerX: 450,
    centerY: 390,
    GM: 14500,             // black hole gravitational parameter (stronger pull)
    starGM: 75,            // mutual gravity between stars (lighter mutual)
    softening: 24,         // softening epsilon for BH potential (sharper close approach)
    starSoftening: 28,
    minRadius: 75,         // soft inner boundary (allow closer slingshot dives)
    maxRadius: 395,        // soft outer boundary
    boundaryStrength: 0.85,
    maxStepSec: 1 / 45,
    subSteps: 2,
  };

  let cosmicActive = false;
  let physicsBodies = null;
  let idleTimer = null;

  function seedPhysics() {
    physicsBodies = orbitItems.map((item) => {
      const angle = item.currentAngle;
      const radius = item.baseRadius;
      const x = PHYSICS.centerX + Math.cos(angle) * radius;
      const y = PHYSICS.centerY + Math.sin(angle) * radius;
      // Tangential speed for a near-circular orbit. Direction follows the
      // existing angularSpeed sign so the visual hand-off has no reversal.
      const speed = Math.sqrt(PHYSICS.GM / radius);
      const tangentDir = item.angularSpeed >= 0 ? 1 : -1;
      const vx = -Math.sin(angle) * speed * tangentDir;
      const vy = Math.cos(angle) * speed * tangentDir;
      return { x, y, vx, vy, mass: radius < 200 ? 1.3 : 1 };
    });
  }

  function stepPhysics(deltaMs) {
    if (!physicsBodies) return;
    const totalDt = Math.min(deltaMs / 1000, PHYSICS.maxStepSec * PHYSICS.subSteps);
    const dt = totalDt / PHYSICS.subSteps;

    for (let s = 0; s < PHYSICS.subSteps; s++) {
      const accels = physicsBodies.map(() => ({ ax: 0, ay: 0 }));

      for (let i = 0; i < physicsBodies.length; i++) {
        const body = physicsBodies[i];

        // Central gravity from the black hole, softened so close approaches
        // don't produce infinite acceleration.
        const dxC = PHYSICS.centerX - body.x;
        const dyC = PHYSICS.centerY - body.y;
        const r2C = dxC * dxC + dyC * dyC + PHYSICS.softening * PHYSICS.softening;
        const rC = Math.sqrt(r2C);
        accels[i].ax += PHYSICS.GM * dxC / (r2C * rC);
        accels[i].ay += PHYSICS.GM * dyC / (r2C * rC);

        // Annular soft boundary so a chaotic 3-body never sends a star out
        // of view or directly into the singularity.
        const radial = Math.hypot(body.x - PHYSICS.centerX, body.y - PHYSICS.centerY) || 1;
        const ux = (body.x - PHYSICS.centerX) / radial;
        const uy = (body.y - PHYSICS.centerY) / radial;
        if (radial < PHYSICS.minRadius) {
          const push = (PHYSICS.minRadius - radial) * PHYSICS.boundaryStrength;
          accels[i].ax += ux * push;
          accels[i].ay += uy * push;
        } else if (radial > PHYSICS.maxRadius) {
          const pull = (radial - PHYSICS.maxRadius) * PHYSICS.boundaryStrength;
          accels[i].ax -= ux * pull;
          accels[i].ay -= uy * pull;
        }

        // Mutual gravity between stars: the source of the chaotic look.
        for (let j = 0; j < physicsBodies.length; j++) {
          if (i === j) continue;
          const other = physicsBodies[j];
          const dxs = other.x - body.x;
          const dys = other.y - body.y;
          const r2s = dxs * dxs + dys * dys + PHYSICS.starSoftening * PHYSICS.starSoftening;
          const rs = Math.sqrt(r2s);
          accels[i].ax += PHYSICS.starGM * other.mass * dxs / (r2s * rs);
          accels[i].ay += PHYSICS.starGM * other.mass * dys / (r2s * rs);
        }
      }

      // Semi-implicit Euler: update v then x. Simple, energy-stable enough
      // for this scale and bounded by the soft annulus.
      for (let i = 0; i < physicsBodies.length; i++) {
        const body = physicsBodies[i];
        body.vx += accels[i].ax * dt;
        body.vy += accels[i].ay * dt;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
      }
    }

    for (let i = 0; i < orbitItems.length; i++) {
      const item = orbitItems[i];
      const p = physicsBodies[i];
      item.element.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
      item.element.style.setProperty('--orbit-x', `${p.x.toFixed(2)}px`);
      item.element.style.setProperty('--orbit-y', `${p.y.toFixed(2)}px`);
    }
  }

  function computeViewportOffset() {
    const rect = orbitStage.getBoundingClientRect();
    const targetX = window.innerWidth / 2;
    const targetY = window.innerHeight / 2;
    const currentX = rect.left + rect.width / 2;
    const currentY = rect.top + rect.height / 2;

    // Scale the stage so its diameter occupies most of the shorter viewport
    // axis, then apply a camera-zoom multiplier so cosmic mode feels like the
    // viewer is pushing in closer to the BH (~40% closer than the natural fit).
    const fitScale = Math.max(1, (Math.min(window.innerWidth, window.innerHeight) * 0.86) / rect.width);
    const zoomFactor = 1.4;
    const finalScale = Math.min(2.1, fitScale * zoomFactor);

    // The BH sits at (450, 390) of the orbit-svg's 900×900 viewBox, slightly
    // above the orbit-stage's geometric center. Shift the offset down by
    // that vertical bias × on-screen height so the BH itself lands at the
    // viewport center instead of the stage center (otherwise the bottom of
    // the viewport feels empty and the top feels cramped).
    const bhVerticalBiasFrac = 0.5 - 390 / 900;
    const bhVerticalBiasPx = bhVerticalBiasFrac * rect.height * finalScale;

    orbitStage.style.setProperty('--cosmic-offset-x', `${(targetX - currentX).toFixed(2)}px`);
    orbitStage.style.setProperty('--cosmic-offset-y', `${(targetY - currentY + bhVerticalBiasPx).toFixed(2)}px`);
    orbitStage.style.setProperty('--cosmic-scale', finalScale.toFixed(3));
  }

  function startCosmicMode() {
    if (cosmicActive) return;
    // Suppress cosmic mode while the home page's video overlay is open.
    // Watching a video without other input would otherwise let the idle
    // timer fire and hide the video under the cosmic stage.
    if (document.body.classList.contains('is-video-open')) return;
    // Skip the takeover if the user has scrolled the orbit stage out of
    // view (e.g. reading Selected Works). Re-arm the timer so the next
    // idle window still counts, but only fires if the BH is on screen.
    const stageRect = orbitStage.getBoundingClientRect();
    const stageOnScreen = stageRect.bottom > 0 && stageRect.top < window.innerHeight;
    if (!stageOnScreen) {
      scheduleIdle();
      return;
    }
    cosmicActive = true;
    // If a previous exit transition is still in flight, cancel it cleanly so
    // the new entry does not race with the partial exit.
    if (exitTimer) {
      clearTimeout(exitTimer);
      exitTimer = null;
    }
    document.body.classList.remove('is-cosmic-exiting');
    seedPhysics();
    computeViewportOffset();
    cosmicRender = stepPhysics;
    document.body.classList.add('is-cosmic-idle');
  }

  let exitTimer = null;

  function stopCosmicMode() {
    if (!cosmicActive) return;
    cosmicActive = false;
    // Hand the visual position back to the scripted orbit so there is no jump
    // when the transitions reverse: recompute each item's currentAngle from
    // its physics-derived position.
    if (physicsBodies) {
      for (let i = 0; i < orbitItems.length; i++) {
        const p = physicsBodies[i];
        orbitItems[i].currentAngle = Math.atan2(p.y - PHYSICS.centerY, p.x - PHYSICS.centerX);
      }
    }
    physicsBodies = null;
    cosmicRender = null;
    previousFrame = performance.now();

    // Two-phase exit so transitions feel sequenced rather than overlapping:
    //  - Phase A (~1.3s): orbit-stage zooms back to its resting size and the
    //    cosmic black-hole image fades out. UI elements stay hidden because
    //    `is-cosmic-exiting` keeps the same opacity rules as `is-cosmic-idle`.
    //  - Phase B: the exiting class is removed, default styles take over,
    //    and the header / hero / sections fade back in from their natural
    //    base transitions.
    document.body.classList.add('is-cosmic-exiting');
    document.body.classList.remove('is-cosmic-idle');
    if (exitTimer) clearTimeout(exitTimer);
    exitTimer = window.setTimeout(() => {
      document.body.classList.remove('is-cosmic-exiting');
      exitTimer = null;
    }, 1300);
  }

  function scheduleIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = window.setTimeout(startCosmicMode, IDLE_THRESHOLD_MS);
  }

  // Cosmic mode exits only on these explicit gestures so background mouse
  // movement, scrolling, touch and unrelated keys never disturb the
  // animation once it starts.
  function isCosmicExitTrigger(event) {
    if (event.type === 'keydown') {
      return event.key === 'Enter' || event.key === ' ' || event.key === 'Escape';
    }
    if (event.type === 'pointerdown') {
      // Both left and right mouse buttons count. pointerType filters out
      // touch and stylus so a stray surface contact on a touch-laptop does
      // not exit.
      return event.pointerType === 'mouse';
    }
    // The click event is included as a belt-and-suspenders catch: even
    // though pointerdown.preventDefault() is supposed to cancel the
    // synthetic click, some browser+element combinations still fire it,
    // and the BH trigger listens on `click`. Swallowing here guarantees
    // a click inside cosmic mode never navigates anywhere.
    if (event.type === 'click') return true;
    return false;
  }

  function handleActivity(event) {
    if (debugLock) {
      // Locked debug mode: only Escape can exit, everything else is ignored.
      if (cosmicActive && event.type === 'keydown' && event.key === 'Escape') {
        stopCosmicMode();
      }
      return;
    }

    const exiting = document.body.classList.contains('is-cosmic-exiting');

    if (cosmicActive || exiting) {
      // Inside cosmic (or its exit transition), only the explicit triggers
      // can fall through. Mouse movement, wheel, touch and unrelated keys
      // are no-ops so the animation stays undisturbed.
      if (isCosmicExitTrigger(event)) {
        event.preventDefault();
        event.stopPropagation();
        if (cosmicActive) stopCosmicMode();
        scheduleIdle();
      } else if (event.type === 'contextmenu') {
        // Right-click pointerdown already triggered the exit; suppress the
        // browser context menu that would otherwise pop up right after.
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    // Outside cosmic, any activity counts as user presence and resets the
    // idle countdown that schedules the next cosmic entry.
    scheduleIdle();
  }

  const activityEvents = ['mousemove', 'pointerdown', 'click', 'keydown', 'wheel', 'touchstart', 'touchmove', 'contextmenu'];
  for (const evt of activityEvents) {
    const needsPreventDefault = evt === 'pointerdown' || evt === 'click' || evt === 'keydown' || evt === 'contextmenu';
    document.addEventListener(evt, handleActivity, {
      capture: true,
      passive: !needsPreventDefault,
    });
  }

  // Recompute centering offset if the user resizes while idle (rare but real).
  window.addEventListener('resize', () => {
    if (cosmicActive) computeViewportOffset();
  });

  // First page load also counts as activity, so start the timer.
  scheduleIdle();
})();

// Poster gallery (printenart page only). The "view" link in each story
// opens this lightbox. Flip cards still flip on direct click; view is a
// separate action via the small text link. Navigation: prev/next buttons,
// arrow keys, horizontal swipe on touch, backdrop / Escape / close button
// to dismiss.
(() => {
  const lightbox = document.getElementById('poster-lightbox');
  if (!lightbox) return;

  const imageEl = lightbox.querySelector('[data-lightbox-image]');
  const stageEl = lightbox.querySelector('[data-lightbox-stage]');
  const prevBtn = lightbox.querySelector('[data-lightbox-prev]');
  const nextBtn = lightbox.querySelector('[data-lightbox-next]');
  const closeBtn = lightbox.querySelector('[data-lightbox-close]');

  // Collect every story article on the page that opted in via data-poster-id.
  // For flip cards we keep references to both faces so the lightbox can show
  // whichever side is currently visible on the page.
  const articles = Array.from(document.querySelectorAll('.printenart-story[data-poster-id]'));
  const POSTERS = articles.map((article) => {
    const flipBtn = article.querySelector('[data-flip-card]');
    const faceImgs = flipBtn ? Array.from(flipBtn.querySelectorAll('.printenart-flip-card__face img')) : [];
    const figureImg = article.querySelector('figure.printenart-poster img');
    const titleEl = article.querySelector('.printenart-story-copy h3');
    return {
      id: article.dataset.posterId,
      title: titleEl?.textContent?.trim() || '',
      flipBtn,
      frontSrc: faceImgs[0]?.getAttribute('src') || figureImg?.getAttribute('src') || '',
      backSrc: faceImgs[1]?.getAttribute('src') || '',
    };
  });

  if (POSTERS.length === 0) return;

  let activeIndex = 0;

  function currentFaceSrc(poster) {
    if (poster.flipBtn && poster.backSrc) {
      const showingBack = poster.flipBtn.getAttribute('aria-pressed') === 'true';
      return showingBack ? poster.backSrc : poster.frontSrc;
    }
    return poster.frontSrc;
  }

  function renderActive() {
    const poster = POSTERS[activeIndex];
    if (!poster || !imageEl) return;
    imageEl.setAttribute('src', currentFaceSrc(poster));
    imageEl.setAttribute('alt', poster.title);
    // Reset zoom state and origin whenever the displayed poster changes so
    // the next view starts unzoomed and panned from the centre.
    stageEl?.classList.remove('is-zoomed');
    imageEl.style.setProperty('--zoom-x', '50%');
    imageEl.style.setProperty('--zoom-y', '50%');
  }

  function openLightbox(posterId) {
    const idx = POSTERS.findIndex((p) => p.id === posterId);
    if (idx < 0) return;
    activeIndex = idx;
    renderActive();
    lightbox.hidden = false;
    // Force reflow so the opacity transition runs from 0 to 1.
    void lightbox.offsetWidth;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-poster-lightbox-open');
    closeBtn?.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-poster-lightbox-open');
    // Hide after the fade so screen readers don't see the offscreen content.
    window.setTimeout(() => {
      if (!lightbox.classList.contains('is-open')) lightbox.hidden = true;
    }, 320);
  }

  function navigate(direction) {
    const len = POSTERS.length;
    activeIndex = (((activeIndex + direction) % len) + len) % len;
    renderActive();
  }

  document.querySelectorAll('[data-view-trigger]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openLightbox(link.dataset.viewTrigger);
      window.yeaTrack?.('printenart_poster_view', {
        label: link.dataset.viewTrigger,
        page_path: window.location.pathname,
      });
    });
  });

  closeBtn?.addEventListener('click', closeLightbox);
  prevBtn?.addEventListener('click', () => navigate(-1));
  nextBtn?.addEventListener('click', () => navigate(1));

  // Backdrop click closes only when the click target is the overlay
  // itself, not the image or its controls.
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (event) => {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLightbox();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      navigate(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      navigate(1);
    }
  });

  // Click toggles zoom. Cursor turns to the OS magnifier glyph via CSS
  // (zoom-in default, zoom-out when active). While zoomed, mousemove drives
  // transform-origin from the cursor position so the user can pan over the
  // poster by sliding the mouse around.
  stageEl?.addEventListener('click', () => {
    stageEl.classList.toggle('is-zoomed');
  });

  stageEl?.addEventListener('mousemove', (event) => {
    if (!stageEl.classList.contains('is-zoomed')) return;
    const rect = stageEl.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    imageEl.style.setProperty('--zoom-x', `${x.toFixed(2)}%`);
    imageEl.style.setProperty('--zoom-y', `${y.toFixed(2)}%`);
  });

  // Block the right-click "Save image as" / "Open image in new tab" menu.
  // Combined with draggable="false" on the image element this keeps casual
  // downloading off the UI surface. A determined user can still grab the
  // file from DevTools but that's not the audience this guards against.
  imageEl?.addEventListener('contextmenu', (event) => event.preventDefault());
  imageEl?.addEventListener('dragstart', (event) => event.preventDefault());
  stageEl?.addEventListener('contextmenu', (event) => event.preventDefault());

  // Mobile swipe: any horizontal drag past the threshold navigates.
  let touchStartX = 0;
  let touchStartY = 0;
  lightbox.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });
  lightbox.addEventListener('touchend', (event) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      navigate(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
})();

// Jeans Fest event day gallery. The carousel keeps moving on the page; each
// image opens a fullscreen viewer with arrows, keyboard navigation and drag
// gestures for moving between event photos.
(() => {
  const lightbox = document.getElementById('jeans-fest-gallery');
  if (!lightbox) return;

  const imageEl = lightbox.querySelector('[data-jeans-fest-gallery-image]');
  const stageEl = lightbox.querySelector('[data-jeans-fest-gallery-stage]');
  const prevBtn = lightbox.querySelector('[data-jeans-fest-gallery-prev]');
  const nextBtn = lightbox.querySelector('[data-jeans-fest-gallery-next]');
  const closeBtn = lightbox.querySelector('[data-jeans-fest-gallery-close]');
  const triggers = Array.from(document.querySelectorAll('[data-jeans-fest-gallery-trigger]'));

  if (!imageEl || !stageEl || triggers.length === 0) return;

  const itemMap = new Map();
  triggers.forEach((trigger) => {
    const index = Number.parseInt(trigger.dataset.jeansFestIndex || '0', 10);
    const img = trigger.querySelector('img');
    const src = img?.getAttribute('src') || '';
    if (!src || itemMap.has(index)) return;
    itemMap.set(index, {
      src,
      alt: img?.getAttribute('alt') || `Jeans Fest event day photo ${index + 1}`,
    });
  });

  const galleryItems = Array.from(itemMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, item]) => item);

  if (galleryItems.length === 0) return;

  let activeIndex = 0;
  let lastFocusedElement = null;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerActive = false;
  let pointerMoved = false;

  function renderActive() {
    const activeItem = galleryItems[activeIndex];
    if (!activeItem) return;
    imageEl.src = activeItem.src;
    imageEl.alt = activeItem.alt;
  }

  function openGallery(index) {
    activeIndex = ((index % galleryItems.length) + galleryItems.length) % galleryItems.length;
    lastFocusedElement = document.activeElement;
    renderActive();
    lightbox.hidden = false;
    void lightbox.offsetWidth;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-jeans-fest-lightbox-open');
    closeBtn?.focus();
  }

  function closeGallery() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-jeans-fest-lightbox-open');
    window.setTimeout(() => {
      if (!lightbox.classList.contains('is-open')) {
        lightbox.hidden = true;
        imageEl.removeAttribute('src');
      }
    }, 320);
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus({ preventScroll: true });
    }
  }

  function navigateGallery(direction) {
    activeIndex = (((activeIndex + direction) % galleryItems.length) + galleryItems.length) % galleryItems.length;
    renderActive();
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      const index = Number.parseInt(trigger.dataset.jeansFestIndex || '0', 10);
      openGallery(index);
    });
  });

  closeBtn?.addEventListener('click', closeGallery);
  prevBtn?.addEventListener('click', () => navigateGallery(-1));
  nextBtn?.addEventListener('click', () => navigateGallery(1));

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeGallery();
  });

  document.addEventListener('keydown', (event) => {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeGallery();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      navigateGallery(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      navigateGallery(1);
    }
  });

  stageEl.addEventListener('pointerdown', (event) => {
    pointerActive = true;
    pointerMoved = false;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    stageEl.classList.add('is-dragging');
    try {
      stageEl.setPointerCapture?.(event.pointerId);
    } catch {
      // Some browsers do not allow capture for synthetic pointer sequences.
    }
  });

  stageEl.addEventListener('pointermove', (event) => {
    if (!pointerActive) return;
    const dx = event.clientX - pointerStartX;
    const dy = event.clientY - pointerStartY;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      pointerMoved = true;
      event.preventDefault();
    }
  });

  function stopPointer(event) {
    if (!pointerActive) return;
    const dx = event.clientX - pointerStartX;
    const dy = event.clientY - pointerStartY;
    pointerActive = false;
    stageEl.classList.remove('is-dragging');
    try {
      stageEl.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }
    if (pointerMoved && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      navigateGallery(dx < 0 ? 1 : -1);
    }
  }

  stageEl.addEventListener('pointerup', stopPointer);
  stageEl.addEventListener('pointercancel', stopPointer);
  stageEl.addEventListener('dragstart', (event) => event.preventDefault());
  stageEl.addEventListener('contextmenu', (event) => event.preventDefault());
  imageEl.addEventListener('contextmenu', (event) => event.preventDefault());
  imageEl.addEventListener('dragstart', (event) => event.preventDefault());
})();

// Denimtopia: about-photos drag scroller + protected PDF catalogue.
(function setupDenimtopia() {
  if (!document.body.classList.contains('case-page--denimtopia')) return;

  // About-denim photos: click cycles manually; otherwise the set advances
  // every 3 seconds while motion is allowed.
  document.querySelectorAll('[data-denim-photos]').forEach((strip) => {
    const photos = Array.from(strip.querySelectorAll('.denim-photos-image'));
    if (!photos.length) return;
    let index = 0;
    let timer = null;

    const showPhoto = (nextIndex) => {
      photos[index].classList.remove('is-active');
      index = ((nextIndex % photos.length) + photos.length) % photos.length;
      photos[index].classList.add('is-active');
    };

    const nextPhoto = () => showPhoto(index + 1);
    const startAuto = () => {
      if (prefersReducedMotion || timer || photos.length < 2) return;
      timer = window.setInterval(nextPhoto, 3000);
    };
    const stopAuto = () => {
      if (!timer) return;
      window.clearInterval(timer);
      timer = null;
    };
    const restartAuto = () => {
      stopAuto();
      startAuto();
    };

    photos[0].classList.add('is-active');
    strip.addEventListener('click', () => {
      nextPhoto();
      restartAuto();
    });
    strip.addEventListener('mouseenter', stopAuto);
    strip.addEventListener('mouseleave', startAuto);
    strip.addEventListener('focusin', stopAuto);
    strip.addEventListener('focusout', startAuto);
    strip.addEventListener('dragstart', (event) => event.preventDefault());
    startAuto();
  });

  // Catalogue: render PDF pages into a canvas via PDF.js. The PDF URL stays
  // out of the HTML source. Right-click, drag, key-save and similar casual
  // exits are blocked. DevTools-savvy users can still extract a copy from
  // the Network panel, this guards against drive-by downloads only.
  const cat = document.querySelector('[data-denim-catalogue]');
  if (!cat) return;

  const canvas = cat.querySelector('[data-denim-catalogue-canvas]');
  const stage = cat.querySelector('[data-denim-catalogue-stage]');
  const status = cat.querySelector('[data-denim-catalogue-status]');
  const prevBtn = cat.querySelector('[data-denim-catalogue-prev]');
  const nextBtn = cat.querySelector('[data-denim-catalogue-next]');
  if (!canvas || !stage || !prevBtn || !nextBtn) return;

  const ctx = canvas.getContext('2d');
  // Obfuscated so the path isn't visible in the static HTML. Final value:
  // "assets/denimtopia-catalogue.pdf".
  const url = atob('YXNzZXRzL2RlbmltdG9waWEtY2F0YWxvZ3VlLnBkZg==');

  let pdf = null;
  let page = 1;
  let total = 0;
  let renderTask = null;
  let renderToken = 0;

  const setStatus = (msg) => {
    if (!status) return;
    if (msg) {
      status.textContent = msg;
      status.classList.remove('is-hidden');
    } else {
      status.classList.add('is-hidden');
    }
  };

  const updateCounter = () => {
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= total;
  };

  // Stage aspect ratio is locked once from a representative inner page (page
  // 2 if available, else page 1). Without this lock, a cover page with
  // different intrinsic dimensions would resize the stage and render larger
  // than the inner pages.
  const lockStageAspect = async () => {
    if (!pdf) return;
    const refPage = await pdf.getPage(total > 1 ? 2 : 1);
    const v = refPage.getViewport({ scale: 1 });
    stage.style.aspectRatio = `${v.width} / ${v.height}`;
  };

  const renderPage = async (n) => {
    if (!pdf) return;
    const token = ++renderToken;
    try {
      if (renderTask) { try { renderTask.cancel(); } catch (_) {} }
      const pdfPage = await pdf.getPage(n);
      if (token !== renderToken) return;
      const stageRect = stage.getBoundingClientRect();
      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min(stageRect.width / baseViewport.width, stageRect.height / baseViewport.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = pdfPage.getViewport({ scale: scale * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
      renderTask = pdfPage.render({ canvasContext: ctx, viewport });
      await renderTask.promise;
      if (token !== renderToken) return;
      setStatus('');
      updateCounter();
    } catch (err) {
      if (err && err.name === 'RenderingCancelledException') return;
      setStatus('catalogue unavailable');
    }
  };

  const goTo = (n) => {
    if (!pdf || n < 1 || n > total || n === page) return;
    page = n;
    renderPage(page);
  };

  const waitForPdfJs = () => new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    let waited = 0;
    const iv = setInterval(() => {
      if (window.pdfjsLib) {
        clearInterval(iv);
        resolve(window.pdfjsLib);
      } else if ((waited += 100) > 8000) {
        clearInterval(iv);
        reject(new Error('pdfjs load timeout'));
      }
    }, 100);
  });

  const init = async () => {
    setStatus('loading catalogue');
    try {
      const pdfjsLib = await waitForPdfJs();
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdf = await pdfjsLib.getDocument({ url, disableRange: false, disableStream: false }).promise;
      total = pdf.numPages;
      updateCounter();
      await lockStageAspect();
      await renderPage(page);
    } catch (_) {
      setStatus('catalogue unavailable');
    }
  };

  prevBtn.addEventListener('click', () => goTo(page - 1));
  nextBtn.addEventListener('click', () => goTo(page + 1));

  // Drag the canvas left/right to flip pages.
  let dragStartX = null;
  let dragDelta = 0;
  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragStartX = event.clientX;
    dragDelta = 0;
    stage.classList.add('is-dragging');
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (dragStartX == null) return;
    dragDelta = event.clientX - dragStartX;
  });
  const endDrag = () => {
    if (dragStartX == null) return;
    stage.classList.remove('is-dragging');
    if (dragDelta < -50) goTo(page + 1);
    else if (dragDelta > 50) goTo(page - 1);
    dragStartX = null;
    dragDelta = 0;
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('pointerleave', endDrag);

  // Horizontal wheel / shift+wheel cycles pages without scrolling the page.
  let wheelCooldown = 0;
  cat.addEventListener('wheel', (event) => {
    const dx = event.deltaX || (event.shiftKey ? event.deltaY : 0);
    if (Math.abs(dx) < 6) return;
    event.preventDefault();
    const now = performance.now();
    if (now < wheelCooldown) return;
    wheelCooldown = now + 220;
    goTo(page + (dx > 0 ? 1 : -1));
  }, { passive: false });

  // Arrow keys when the viewer (or its buttons) has focus.
  cat.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(page - 1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); goTo(page + 1); }
  });

  // Casual-save blockers scoped to the catalogue area.
  cat.addEventListener('contextmenu', (event) => event.preventDefault());
  cat.addEventListener('dragstart', (event) => event.preventDefault());
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  const isCatalogueActive = () => {
    const rect = cat.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  };
  window.addEventListener('keydown', (event) => {
    if (!isCatalogueActive()) return;
    if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S' || event.key === 'p' || event.key === 'P')) {
      event.preventDefault();
    }
  });

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    if (!pdf) return;
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => renderPage(page));
  });

  init();
})();

(() => {
  const banner = document.querySelector('[data-motion-scroll-banner]');
  if (!banner || prefersReducedMotion) {
    return;
  }

  const circle = banner.querySelector('.motion-scroll-banner__shape--circle');
  const square = banner.querySelector('.motion-scroll-banner__shape--square');
  const triangle = banner.querySelector('.motion-scroll-banner__shape--triangle');
  const scrubDot = banner.querySelector('.motion-scroll-banner__scrub-dot');
  const animatedParts = [circle, square, triangle, scrubDot].filter(Boolean);

  if (animatedParts.length < 4) {
    return;
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  let frame = 0;

  const setProgress = (progress) => {
    const p = clamp(progress, 0, 1);
    circle.style.transform = `translate(${p * 210}px, ${p * 35}px) rotate(${p * 18}deg)`;
    square.style.transform = `translate(${p * 130}px, ${p * -65}px) rotate(${p * 24}deg)`;
    triangle.style.transform = `translate(${p * -170}px, ${p * 45}px) rotate(${p * -18}deg)`;
    scrubDot.style.transform = `translateX(${p * 525}px)`;
  };

  const update = () => {
    frame = 0;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const distance = Math.max(420, banner.offsetHeight * 1.25);
    const progress = scrollY / distance;
    setProgress(progress);
  };

  const requestUpdate = () => {
    if (!frame) {
      frame = window.requestAnimationFrame(update);
    }
  };

  setProgress(0);
  update();
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
})();

(() => {
  const banner = document.querySelector('[data-jeans-fest-banner]');
  if (!banner) {
    return;
  }

  const reveal = () => {
    banner.classList.add('is-revealed');
  };

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    reveal();
    return;
  }

  let hasRevealed = false;
  let frame = 0;

  const maybeReveal = () => {
    frame = 0;

    if (hasRevealed || (window.scrollY || document.documentElement.scrollTop || 0) < 18) {
      return;
    }

    const rect = banner.getBoundingClientRect();
    const isInView = rect.top < window.innerHeight * 0.86 && rect.bottom > window.innerHeight * 0.14;

    if (!isInView) {
      return;
    }

    hasRevealed = true;
    reveal();
    window.removeEventListener('scroll', requestMaybeReveal);
    window.removeEventListener('resize', requestMaybeReveal);
  };

  function requestMaybeReveal() {
    if (!frame) {
      frame = window.requestAnimationFrame(maybeReveal);
    }
  }

  window.addEventListener('scroll', requestMaybeReveal, { passive: true });
  window.addEventListener('resize', requestMaybeReveal);
  requestMaybeReveal();
})();
