# Singapore Trip Planner — installable PWA

A standalone version of the trip planner — no Claude needed to run it, works as a
real home-screen app on your Android phone. Same itinerary/places/AI features as
before, plus a **Map** tab and place **photos**.

## 1. Host it (pick one, both are free and take a few minutes)

**GitHub Pages**
1. Create a new GitHub repo, upload every file in this folder (`index.html`,
   `app.jsx`, `manifest.json`, `service-worker.js`, `icons/`) keeping the same
   folder structure.
2. Repo → Settings → Pages → Deploy from branch → `main` / root.
3. Your app is live at `https://<username>.github.io/<repo>/`.

**Netlify (drag-and-drop, no account setup needed for a quick test)**
1. Go to app.netlify.com/drop.
2. Drag this whole folder in.
3. You get a live `https://<random-name>.netlify.app` URL immediately.

Either way, it must be served over **https** — opening `index.html` directly from
your files won't let Chrome offer the install prompt.

## 2. Install it on your Android phone

1. Open the hosted URL in Chrome.
2. Tap the ⋮ menu → **Install app** (or **Add to Home screen**).
3. It opens full-screen from your home screen, no browser bar, its own icon.

## 3. Add your Anthropic API key (for Ask AI / Auto-plan)

The AI features call Claude directly from your phone's browser, so they need
your own key (there's no server in the middle anymore).

1. Get a key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).
2. In the app, tap the key icon (top right) → paste it → Save.
3. It's stored only in your phone's browser storage — never sent anywhere but
   Anthropic's API. Don't share your installed app/URL with anyone you don't
   want using that key's usage quota.

Itinerary, Places and Map all work without a key — only Ask AI and auto-plan need one.

## 4. What's new: Map + photos

- **Map tab**: an in-app map (OpenStreetMap, no key needed) with a colored,
  numbered dot per stop, grouped and connected day-by-day so you can see the
  actual shape of each day at a glance. Day chips let you isolate one day or
  view all of them together. Tapping a dot opens a popup with a photo and a
  "open in Google Maps" link for real turn-by-turn directions.
- **Photos**: pulled live from Wikipedia (free, no key) for well-known spots,
  cached on your phone after the first load. Custom spots you add yourself
  won't have a photo unless they happen to have a Wikipedia page — they'll
  show a placeholder instead, which is expected.
- The route lines on the map are **straight lines between stops**, not actual
  road/rail paths — they're there to show shape and grouping, not turn-by-turn.
  For real directions, use the Google Maps links (in Itinerary and in map popups).
- Curated places use approximate hand-set coordinates (good enough at city
  scale). For pinpoint accuracy on any spot, paste its expanded Google Maps
  link (containing `@lat,lng`) when adding it — that's used for both routing
  links and map placement.

## 6. Important — one-time step after this update

The service worker used to cache the app "cache-first," which could silently
keep showing you an old version after re-uploading new files. It's now
"network-first" (always fetches the latest when online, only falls back to
cache if you're offline), so future updates will show up on the very next
open. But your phone may still have the *old* service worker controlling it
right now. Once, after re-uploading these files:
1. Fully close the app (swipe it away from recent apps, don't just background it).
2. Reopen it. It should now register the new service worker and stay current
   from here on.

Two new CDN scripts were added to `index.html` (`marked` for Markdown
rendering, `dompurify` for sanitizing it) — same free-CDN pattern as
React/Leaflet, no new hosting or key needed.

## 7. Notes / limits

- Data lives in this browser's local storage only — if the three of you each
  install the app on your own phones, you each get an independent copy (no
  live sync between phones).
- If you ever want a real installable `.apk` file instead of a home-screen web
  app, run this same hosted URL through [pwabuilder.com](https://www.pwabuilder.com) —
  it packages an already-hosted PWA into a signed Android package for you.
- Re-verify Universal Studios pricing/hours and the Garden Rhapsody showtimes
  closer to December — those are baked in from research done earlier and can drift.
