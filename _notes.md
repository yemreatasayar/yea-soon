# yea-soon — teaser notes

> `_` prefix => GitHub Pages (Jekyll) ignores this file, so it is NOT served publicly.

Coming-soon teaser for the full yemre-website. Live at **https://yemreatasayar.com**
(GitHub Pages from `main`/root, custom domain via CNAME, HTTPS enforced).
Pages: `index.html` (home), `about.html`, custom `404.html`. Pages are `noindex`.

## Contact form (Cloudflare Worker + Turnstile + Resend)
- Form POSTs to the Worker `CONTACT_ENDPOINT` = `https://yea-contact.highlevelsocial.workers.dev`
  (defined in `script.js`). Worker verifies the Turnstile token server-side, then
  emails via Resend. The Web3Forms key is NOT used (Web3Forms blocks Worker/server
  requests with 403 / error 1106).
- Worker source (kept outside this repo): `~/yea-cloudflare-worker/contact-worker.js`.
- Worker secrets/vars (Cloudflare > Worker `yea-contact` > Settings > Variables):
  `TURNSTILE_SECRET`, `RESEND_API_KEY`, `TO_EMAIL` (Resend account email; Resend test
  mode only delivers to that address until a domain is verified), optional `ALLOWED_ORIGIN`.
- Turnstile site key (public, in the HTML widget): `0x4AAAAAADdmrfBKUS21sUba`. Widget
  hostnames must include `yemreatasayar.com`.

## Behaviour notes
- Orbit dots are decorative here: `orbitLinks` is empty + `.orbit-line { display:none }`
  (the full site keeps labels/links). `#home .contact-section` has extra top padding
  because there is no works section before contact. These 3 are teaser-only.
- Mobile (<=760px): sound menu hidden, tap icon = random track; scroll-reveal off
  (instant, but `.is-visible` still applied so toolbox rating dots fill white); about
  portrait above "Who is".
- Orbit + 2-min cosmic idle animate even under reduce-motion; cosmic idle is desktop-only
  (`min-width:1101px`).
- iOS: SoundCloud iframe pre-warmed on first gesture + reused; no cross-page auto-resume
  (one tap resumes). Android plays continuously.

## Deploy
- `git push origin main` (token cached in macOS Keychain). GitHub Pages auto-builds.
- Local preview: `python3 serve.py` (http://127.0.0.1:4827).

## Latest cache versions
- styles.css?v=20260602-7
- script.js?v=20260602-6
