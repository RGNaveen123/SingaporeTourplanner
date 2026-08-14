/* Singapore Trip Planner — standalone PWA build (no bundler; Babel-in-browser) */
const { useState, useEffect, useMemo, useCallback, useRef } = React;

/* =========================================================================
   STORAGE (localStorage shim matching the window.storage shape)
   ========================================================================= */
const STORAGE_KEY = "sg-trip-planner-v2";
const API_KEY_STORAGE = "sgtp-api-key";
const PHOTO_CACHE_KEY = "sgtp-photo-cache";

async function storageGet(key) {
  const raw = localStorage.getItem(key);
  if (raw === null) throw new Error("not found");
  return { key, value: raw };
}
async function storageSet(key, value) {
  localStorage.setItem(key, value);
  return { key, value };
}

/* =========================================================================
   CONSTANTS
   ========================================================================= */
const ZONES = ["Central", "Orchard", "Sentosa", "Mandai", "Changi", "Other"];
const ZONE_CODE = { Central: "CEN", Orchard: "ORC", Sentosa: "SEN", Mandai: "MAN", Changi: "CHG", Other: "OTH" };
// Friendly area names for the Places tab's grouping headings (item #4) —
// same underlying zones, just named the way you'd actually refer to them.
const AREA_LABEL = { Central: "Downtown & Marina Bay", Orchard: "Orchard Road", Sentosa: "Sentosa Island", Mandai: "Mandai Wildlife Reserve", Changi: "Changi", Other: "Elsewhere in Singapore" };
const TAG_ORDER = ["Budget Food", "Restaurant", "Sight", "Viewpoint", "Nature", "Culture", "Family", "Shopping", "Food", "Custom"];
const ZONE_COLOR = { Central: "#E3B15C", Orchard: "#D98B96", Sentosa: "#4FB08C", Mandai: "#8FAE5C", Changi: "#6FA8D0", Other: "#B99A72" };
const DAY_COLORS = ["#E3B15C", "#4FB08C", "#D98B96", "#6FA8D0", "#C1495A", "#8FAE5C", "#B99A72"];

const TRAVEL_MATRIX = {
  Central: { Central: 15, Orchard: 20, Sentosa: 35, Mandai: 45, Changi: 40, Other: 30 },
  Orchard: { Central: 20, Orchard: 10, Sentosa: 40, Mandai: 50, Changi: 45, Other: 25 },
  Sentosa: { Central: 35, Orchard: 40, Sentosa: 15, Mandai: 60, Changi: 55, Other: 45 },
  Mandai: { Central: 45, Orchard: 50, Sentosa: 60, Mandai: 15, Changi: 55, Other: 40 },
  Changi: { Central: 40, Orchard: 45, Sentosa: 55, Mandai: 55, Changi: 10, Other: 45 },
  Other: { Central: 30, Orchard: 25, Sentosa: 45, Mandai: 40, Changi: 45, Other: 20 },
};

const MIN_RECOMMENDED = {
  "Universal Studios Singapore": 480, "S.E.A. Aquarium": 150, "Singapore Zoo": 180,
  "Night Safari": 120, "River Wonders": 90, "Bird Paradise": 150, "Skyline Luge Sentosa": 90,
};

const CONCERT_MMDD = "12-20";
const USS_MMDD = "12-18";

const CHANGI_COORDS = { lat: 1.3644, lng: 103.9915 };
const STADIUM_COORDS = { lat: 1.3033, lng: 103.8749 };

// curated places, with approximate coordinates (public landmarks; refine with a
// pasted Google Maps link on custom spots if you need pinpoint precision)
const CURATED_PLACES = [
  { id: "p-merlion", name: "Merlion Park", zone: "Central", durationMin: 30, tag: "Sight", icon: "camera", coords: { lat: 1.2868, lng: 103.8545 } },
  { id: "p-gbtb", name: "Gardens by the Bay", zone: "Central", durationMin: 240, tag: "Nature", icon: "tree", mustVisit: true, coords: { lat: 1.2816, lng: 103.8636 }, note: "Linger into the evening — free Garden Rhapsody light show at Supertree Grove, 7:45pm & 8:45pm (~15 min each). Christmas Wonderland likely running in December too." },
  { id: "p-mbssp", name: "Marina Bay Sands SkyPark", zone: "Central", durationMin: 60, tag: "Viewpoint", icon: "camera", coords: { lat: 1.2834, lng: 103.8607 } },
  { id: "p-chinatown", name: "Chinatown", zone: "Central", durationMin: 90, tag: "Culture", icon: "landmark", coords: { lat: 1.2812, lng: 103.8443 } },
  { id: "p-clarkequay", name: "Clarke Quay", zone: "Central", durationMin: 90, tag: "Food", icon: "utensils", coords: { lat: 1.2884, lng: 103.8465 } },
  { id: "p-arabst", name: "Arab Street / Haji Lane", zone: "Central", durationMin: 60, tag: "Sight", icon: "camera", coords: { lat: 1.3025, lng: 103.8590 } },
  { id: "p-natgallery", name: "National Gallery Singapore", zone: "Central", durationMin: 120, tag: "Culture", icon: "landmark", coords: { lat: 1.2903, lng: 103.8517 } },
  { id: "p-marinabarrage", name: "Marina Barrage", zone: "Central", durationMin: 60, tag: "Sight", icon: "camera", coords: { lat: 1.2807, lng: 103.8707 } },
  { id: "p-orchard", name: "Orchard Road", zone: "Orchard", durationMin: 120, tag: "Shopping", icon: "shop", coords: { lat: 1.3048, lng: 103.8318 } },
  { id: "p-ionorchard", name: "ION Orchard", zone: "Orchard", durationMin: 90, tag: "Shopping", icon: "shop", coords: { lat: 1.3039, lng: 103.8318 } },
  { id: "p-uss", name: "Universal Studios Singapore", zone: "Sentosa", durationMin: 570, tag: "Family", icon: "ticket", fixedOnly: true, coords: { lat: 1.2540, lng: 103.8238 } },
  { id: "p-aquarium", name: "S.E.A. Aquarium", zone: "Sentosa", durationMin: 150, tag: "Family", icon: "ticket", coords: { lat: 1.2586, lng: 103.8206 } },
  { id: "p-sentosabeach", name: "Siloso / Palawan Beach", zone: "Sentosa", durationMin: 120, tag: "Nature", icon: "tree", coords: { lat: 1.2494, lng: 103.8145 } },
  { id: "p-luge", name: "Skyline Luge Sentosa", zone: "Sentosa", durationMin: 90, tag: "Family", icon: "ticket", coords: { lat: 1.2578, lng: 103.8226 } },
  { id: "p-zoo", name: "Singapore Zoo", zone: "Mandai", durationMin: 180, tag: "Nature", icon: "tree", coords: { lat: 1.4043, lng: 103.7930 } },
  { id: "p-nightsafari", name: "Night Safari", zone: "Mandai", durationMin: 150, tag: "Nature", icon: "moon", mustVisit: true, coords: { lat: 1.4021, lng: 103.7899 }, note: "Best after dark — opens ~6pm. Slot into day 1 evening or day 3." },
  { id: "p-riverwonders", name: "River Wonders", zone: "Mandai", durationMin: 90, tag: "Nature", icon: "tree", coords: { lat: 1.4028, lng: 103.7889 } },
  { id: "p-birdparadise", name: "Bird Paradise", zone: "Mandai", durationMin: 150, tag: "Nature", icon: "tree", coords: { lat: 1.4127, lng: 103.7736 } },
  { id: "p-jewel", name: "Jewel Changi Airport", zone: "Changi", durationMin: 90, tag: "Sight", icon: "camera", coords: { lat: 1.3603, lng: 103.9895 } },
  { id: "p-tiongbahru", name: "Tiong Bahru Market", zone: "Other", durationMin: 60, tag: "Budget Food", icon: "utensils", coords: { lat: 1.2847, lng: 103.8267 }, note: "Wet market downstairs, hawker centre upstairs — go before 10am for the good stalls." },
  { id: "p-eastcoast", name: "East Coast Park", zone: "Other", durationMin: 90, tag: "Nature", icon: "tree", coords: { lat: 1.3010, lng: 103.9120 } },
  { id: "p-botanic", name: "Botanic Gardens", zone: "Other", durationMin: 90, tag: "Nature", icon: "tree", coords: { lat: 1.3138, lng: 103.8159 } },
  // Budget hawker centres / food courts — real, well-known, no admission fee.
  // Hand-curated rather than pulled live from Overpass API: keeps this list
  // reliable and offline-friendly instead of depending on another live call.
  { id: "p-maxwell", name: "Maxwell Food Centre", zone: "Central", durationMin: 60, tag: "Budget Food", icon: "utensils", coords: { lat: 1.2802, lng: 103.8448 }, note: "Tian Tian Chicken Rice's original stall is here — expect a queue." },
  { id: "p-lonpasat", name: "Lau Pa Sat", zone: "Central", durationMin: 60, tag: "Budget Food", icon: "utensils", coords: { lat: 1.2805, lng: 103.8503 }, note: "Historic Victorian cast-iron market; satay street closes off in the evening." },
  { id: "p-amoy", name: "Amoy Street Food Centre", zone: "Central", durationMin: 60, tag: "Budget Food", icon: "utensils", coords: { lat: 1.2793, lng: 103.8477 }, note: "Busiest at lunch on weekdays — quieter and more relaxed on weekends." },
  { id: "p-chinatowncomplex", name: "Chinatown Complex Food Centre", zone: "Central", durationMin: 60, tag: "Budget Food", icon: "utensils", coords: { lat: 1.2827, lng: 103.8437 }, note: "Singapore's largest hawker centre — Liao Fan Hawker Chan (Michelin) is here." },
  { id: "p-newton", name: "Newton Food Centre", zone: "Orchard", durationMin: 60, tag: "Budget Food", icon: "utensils", coords: { lat: 1.3127, lng: 103.8382 }, note: "Touristy but convenient from Orchard — confirm prices before ordering seafood." },
  { id: "p-oldairport", name: "Old Airport Road Food Centre", zone: "Other", durationMin: 60, tag: "Budget Food", icon: "utensils", coords: { lat: 1.3080, lng: 103.8865 }, note: "Local favourite, a bit out of the way — worth the trip for the food alone." },
  { id: "p-ecplagoon", name: "East Coast Lagoon Food Village", zone: "Other", durationMin: 60, tag: "Budget Food", icon: "utensils", coords: { lat: 1.3011, lng: 103.9257 }, note: "Right on the beach — good pairing with an East Coast Park evening." },
  // Proper sit-down restaurants — a step up from hawker centres for when you
  // want table service or a specific dish, spread across zones/price points.
  { id: "p-jumbo", name: "Jumbo Seafood (Riverside Point)", zone: "Central", durationMin: 90, tag: "Restaurant", icon: "utensils", coords: { lat: 1.2879, lng: 103.8467 }, note: "The chili crab place — iconic but pricier, worth it once. Book ahead on weekends." },
  { id: "p-dintaifung", name: "Din Tai Fung (ION Orchard)", zone: "Orchard", durationMin: 60, tag: "Restaurant", icon: "utensils", coords: { lat: 1.3039, lng: 103.8318 }, note: "Reliable xiaolongbao chain, moderate prices — good if you want a sure thing." },
  { id: "p-killiney", name: "Killiney Kopitiam", zone: "Orchard", durationMin: 45, tag: "Restaurant", icon: "utensils", coords: { lat: 1.2989, lng: 103.8339 }, note: "Old-school kaya toast + kopi breakfast, cheap and local, not a hawker centre." },
  { id: "p-pscafe", name: "PS.Café (Dempsey Hill)", zone: "Other", durationMin: 90, tag: "Restaurant", icon: "utensils", coords: { lat: 1.3048, lng: 103.8098 }, note: "Leafy, relaxed brunch/dinner spot — a nicer sit-down option, moderate-to-higher price." },
];

const DEFAULT_DATA = {
  tripSetup: null,
  homeBase: { name: "", zone: "Other", mapsUrl: "", coords: null },
  customPlaces: [
    { id: "custom-apple", name: "Apple Marina Bay Sands", zone: "Central", tag: "Custom", durationMin: 30, mapsUrl: "", coords: { lat: 1.2836, lng: 103.8607 }, defaultNotes: "2 Bayfront Avenue — Apple Store" },
    { id: "custom-mcd", name: "McDonald's Ridout Tea Garden (Queensway)", zone: "Other", tag: "Custom", durationMin: 20, mapsUrl: "", coords: { lat: 1.2853, lng: 103.8058 }, defaultNotes: "580 Queensway — Japanese-garden themed McDonald's (turtle pond, wooden bridges). Quick photo stop." },
  ],
  itinerary: [],
  dayTags: {},
};

/* =========================================================================
   HELPERS
   ========================================================================= */
const uid = () => Math.random().toString(36).slice(2, 10);
function parseDate(d) { return new Date(d + "T00:00:00"); }
function fmtDateLabel(d) { return parseDate(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); }
function dayNumberFor(dateStr, arrivalDateStr) { return Math.round((parseDate(dateStr) - parseDate(arrivalDateStr)) / 86400000) + 1; }
function dateForDay(dayNum, arrivalDateStr) { const d = parseDate(arrivalDateStr); d.setDate(d.getDate() + dayNum - 1); return d.toISOString().slice(0, 10); }
function addMinutes(time, mins) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor((((total % 1440) + 1440) % 1440) / 60);
  const nm = ((total % 60) + 60) % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}
function minutesBetween(t1, t2) {
  const [h1, m1] = t1.split(":").map(Number);
  const [h2, m2] = t2.split(":").map(Number);
  return h2 * 60 + m2 - (h1 * 60 + m1);
}
function fmt12(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${period}`;
}
function mapsLink(originStr, destStr, mode) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&travelmode=${mode}`;
}
function extractCoordsFromUrl(url) {
  if (!url) return null;
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = url.match(/[?&]query=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = url.match(/[?&]destination=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}
// Free, no-key geocoding via OpenStreetMap's Nominatim, for when a plain
// name/address is typed rather than a Maps link with embedded coordinates.
// Biased to Singapore results. Client-side, low-volume personal use only —
// don't call this in a loop or on every keystroke.
async function geocodeAddress(query) {
  if (!query || !query.trim()) return null;
  try {
    const q = encodeURIComponent(query.trim() + ", Singapore");
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=sg&q=${q}`);
    const json = await res.json();
    if (Array.isArray(json) && json.length > 0) return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
  } catch (e) {}
  return null;
}
function locString(nameOrCoords) {
  if (nameOrCoords && nameOrCoords.coords) return `${nameOrCoords.coords.lat},${nameOrCoords.coords.lng}`;
  return `${nameOrCoords.name}, Singapore`;
}
function travelEstimate(zoneA, zoneB) { if (!zoneA || !zoneB) return 30; return TRAVEL_MATRIX[zoneA]?.[zoneB] ?? 30; }
// Grab doesn't offer a public "prefill this route" link without their
// partner Deeplink API (a separate integration — not a free static link,
// and not something to build without asking first, same as any paid API).
// This is their real, stable entry point instead: opens the installed app
// if present, otherwise the official download/store page.
const GRAB_LINK = "https://www.grab.com/sg/download/";
// Only surface taxi-app suggestions once the trip has actually started —
// no point offering a Singapore ride-hailing link before you've landed.
function hasReachedSingapore(tripSetup) {
  if (!tripSetup) return false;
  return new Date().toISOString().slice(0, 10) >= tripSetup.arrivalDate;
}
// Rough at-city-scale zone lookup: find the nearest curated place by
// straight-line distance and borrow its zone. Good enough to route the
// home base into the same 6-zone travel matrix already used everywhere
// else — no geocoding API needed.
function nearestZoneForCoords(coords) {
  if (!coords) return null;
  let best = null, bestDist = Infinity;
  for (const p of CURATED_PLACES) {
    if (!p.coords) continue;
    const d = (p.coords.lat - coords.lat) ** 2 + (p.coords.lng - coords.lng) ** 2;
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best ? best.zone : null;
}
function minRecFor(name) { return MIN_RECOMMENDED[name]; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function coordsForName(name) {
  const all = [...CURATED_PLACES, ...(window.__sgtpCustomPlaces || [])];
  const hit = all.find((p) => p.name === name);
  return hit ? hit.coords : null;
}

/* =========================================================================
   API KEY + CLAUDE CALLS (bring-your-own-key, direct-from-browser)
   ========================================================================= */
function getApiKey() { return localStorage.getItem(API_KEY_STORAGE) || ""; }
function setApiKeyStorage(key) { localStorage.setItem(API_KEY_STORAGE, key); }

// Purely local usage counter — no extra API cost of its own, just visibility
// into how many Haiku calls you've actually made, since that's the whole
// point of switching to Haiku and capping history in the first place.
const CALL_COUNT_KEY = "sgtp-api-call-count";
function bumpCallCount() {
  try { const n = (Number(localStorage.getItem(CALL_COUNT_KEY)) || 0) + 1; localStorage.setItem(CALL_COUNT_KEY, String(n)); return n; } catch (e) { return null; }
}
function getCallCount() { try { return Number(localStorage.getItem(CALL_COUNT_KEY)) || 0; } catch (e) { return 0; } }

// A soft spending checkpoint, not a hard cap. When your call count reaches
// this number, you get ONE confirm dialog before the next call goes out;
// saying yes raises the checkpoint so you're not asked again every single
// call, just each time you cross a new chunk. Edit the number in Settings.
const CALL_BUDGET_KEY = "sgtp-call-budget";
const DEFAULT_CALL_BUDGET = 60;
const CALL_BUDGET_STEP = 30;
function getCallBudget() { try { const n = Number(localStorage.getItem(CALL_BUDGET_KEY)); return n > 0 ? n : DEFAULT_CALL_BUDGET; } catch (e) { return DEFAULT_CALL_BUDGET; } }
function setCallBudget(n) { try { localStorage.setItem(CALL_BUDGET_KEY, String(n)); } catch (e) {} }

async function askClaude(promptOrMessages, systemPrompt, maxTokens = 1000) {
  const key = getApiKey();
  if (!key) { const e = new Error("no-api-key"); e.code = "no-api-key"; throw e; }
  const count = getCallCount(), budget = getCallBudget();
  if (count >= budget) {
    const ok = window.confirm(`You've made ${count} AI calls on this device — your check-in point is ${budget}. Make another? (Raise or lower this anytime in Settings.)`);
    if (!ok) { const e = new Error("budget-declined"); e.code = "budget-declined"; throw e; }
    setCallBudget(budget + CALL_BUDGET_STEP);
  }
  const messages = Array.isArray(promptOrMessages) ? promptOrMessages : [{ role: "user", content: promptOrMessages }];
  bumpCallCount();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, system: systemPrompt, messages }),
  });
  const json = await res.json();
  if (json.error) { const e = new Error(json.error.message || "API error"); e.code = "api-error"; throw e; }
  const text = (json.content || []).map((b) => b.text || "").join("\n");
  return text;
}
function stripFences(text) { return text.replace(/```json/gi, "").replace(/```/g, "").trim(); }
// Keep only the most recent N exchanges when sending chat history back to
// the API — multi-turn memory shouldn't mean unbounded token growth (and
// unbounded cost) as a conversation gets long.
const MAX_HISTORY_TURNS = 8;
function trimHistory(msgs) {
  const maxMsgs = MAX_HISTORY_TURNS * 2;
  return msgs.length > maxMsgs ? msgs.slice(msgs.length - maxMsgs) : msgs;
}

/* =========================================================================
   PHOTOS (Wikipedia, no key required)
   ========================================================================= */
let photoCache = {};
try { photoCache = JSON.parse(localStorage.getItem(PHOTO_CACHE_KEY) || "{}"); } catch (e) { photoCache = {}; }
function savePhotoCache() { try { localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(photoCache)); } catch (e) {} }

async function fetchPlacePhoto(name) {
  if (photoCache[name] !== undefined) return photoCache[name];
  try {
    const q = encodeURIComponent(name + " Singapore");
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=360&format=json&origin=*`;
    const res = await fetch(url);
    const json = await res.json();
    let thumb = null;
    const pages = json && json.query && json.query.pages;
    if (pages) { const first = Object.values(pages)[0]; thumb = (first && first.thumbnail && first.thumbnail.source) || null; }
    photoCache[name] = thumb;
    savePhotoCache();
    return thumb;
  } catch (e) {
    photoCache[name] = null;
    savePhotoCache();
    return null;
  }
}

// "What's here" info — same free Wikipedia API used for photos, just the
// plain-text intro extract instead of the thumbnail. No key, no new cost.
const EXTRACT_CACHE_KEY = "sgtp-extract-cache";
let extractCache = {};
try { extractCache = JSON.parse(localStorage.getItem(EXTRACT_CACHE_KEY) || "{}"); } catch (e) { extractCache = {}; }
function saveExtractCache() { try { localStorage.setItem(EXTRACT_CACHE_KEY, JSON.stringify(extractCache)); } catch (e) {} }
async function fetchPlaceExtract(name) {
  if (extractCache[name] !== undefined) return extractCache[name];
  try {
    const q = encodeURIComponent(name + " Singapore");
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${q}&gsrlimit=1&prop=extracts&exintro=1&explaintext=1&exchars=700&format=json&origin=*`;
    const res = await fetch(url);
    const json = await res.json();
    let extract = null;
    const pages = json && json.query && json.query.pages;
    if (pages) { const first = Object.values(pages)[0]; extract = (first && first.extract) || null; }
    extractCache[name] = extract;
    saveExtractCache();
    return extract;
  } catch (e) {
    extractCache[name] = null;
    saveExtractCache();
    return null;
  }
}

/* =========================================================================
   STYLE
   ========================================================================= */
const C = {
  ink: "#0A2320", panel: "#12332F", panelRaised: "#17403A", line: "rgba(227,196,140,0.14)",
  gold: "#E3B15C", goldDim: "#B98A3E", cream: "#F3ECDD", muted: "#93B0AA",
  transit: "#4FB08C", taxi: "#CC7A4B", concert: "#C1495A", danger: "#D9666F",
};

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
      html, body, #root { height: 100%; margin: 0; background: ${C.ink}; }
      .sgtp-root * { box-sizing: border-box; }
      .sgtp-root { font-family: 'Inter', system-ui, sans-serif; -webkit-tap-highlight-color: transparent; --sgtp-nav-h: 64px; }
      .sgtp-root ::-webkit-scrollbar { display: none; }
      .sgtp-root { scrollbar-width: none; }
      .sgtp-display { font-family: 'Big Shoulders Display', 'Inter', sans-serif; font-weight: 700; letter-spacing: 0.01em; }
      .sgtp-mono { font-family: 'IBM Plex Mono', monospace; }

      @keyframes sgtp-fade-in { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
      @keyframes sgtp-sheet-up { from { transform: translateY(100%);} to { transform: translateY(0);} }
      @keyframes sgtp-sheet-down { from { transform: translateY(0); opacity: 1;} to { transform: translateY(100%); opacity: 0.4;} }
      @keyframes sgtp-scrim-in { from { opacity: 0;} to { opacity: 1;} }
      @keyframes sgtp-pop { 0% { transform: scale(0.9); opacity: 0;} 60% { transform: scale(1.02); opacity: 1;} 100% { transform: scale(1);} }
      @keyframes sgtp-glow { 0% { box-shadow: 0 0 0 0 rgba(227,177,92,0.55);} 60% { box-shadow: 0 0 0 8px rgba(227,177,92,0);} 100% { box-shadow: 0 0 0 0 rgba(227,177,92,0);} }
      @keyframes sgtp-collapse { to { max-height: 0; opacity: 0; margin: 0; padding-top: 0; padding-bottom: 0; } }
      @keyframes sgtp-dash { to { stroke-dashoffset: -24; } }
      @keyframes sgtp-spin { to { transform: rotate(360deg); } }
      @keyframes sgtp-shimmer { 0% { background-position: -120% 0; } 100% { background-position: 120% 0; } }

      .sgtp-enter { animation: sgtp-fade-in 0.35s cubic-bezier(.2,.8,.2,1) both; }
      .sgtp-sheet-enter { animation: sgtp-sheet-up 0.32s cubic-bezier(.16,.9,.28,1) both; }
      .sgtp-sheet-exit { animation: sgtp-sheet-down 0.24s cubic-bezier(.4,0,1,1) both; }
      .sgtp-scrim-enter { animation: sgtp-scrim-in 0.24s ease both; }
      .sgtp-pop { animation: sgtp-pop 0.4s cubic-bezier(.2,.8,.2,1) both; }
      .sgtp-glow { animation: sgtp-glow 1.1s ease-out 1; }
      .sgtp-removing { animation: sgtp-collapse 0.28s ease forwards; overflow: hidden; }
      .sgtp-spin { animation: sgtp-spin 0.9s linear infinite; }
      .sgtp-skeleton { background: linear-gradient(90deg, #12332F 25%, #1B4A43 50%, #12332F 75%); background-size: 250% 100%; animation: sgtp-shimmer 1.4s ease-in-out infinite; }
      /* Small tactile press feedback on every button/link in the app — cheap,
         makes taps feel acknowledged instead of instant/flat. */
      .sgtp-btn { transition: transform 0.12s ease; }
      .sgtp-btn:active { transform: scale(0.93); }
      /* Staggered card entrance: apply .sgtp-stagger to a list wrapper and
         each direct child fades/slides in a beat after the previous one,
         instead of the whole list popping in at once. */
      .sgtp-stagger > * { animation: sgtp-fade-in 0.4s cubic-bezier(.2,.8,.2,1) both; }
      .sgtp-stagger > *:nth-child(1) { animation-delay: 0.02s; }
      .sgtp-stagger > *:nth-child(2) { animation-delay: 0.07s; }
      .sgtp-stagger > *:nth-child(3) { animation-delay: 0.12s; }
      .sgtp-stagger > *:nth-child(4) { animation-delay: 0.17s; }
      .sgtp-stagger > *:nth-child(5) { animation-delay: 0.22s; }
      .sgtp-stagger > *:nth-child(n+6) { animation-delay: 0.26s; }

      .sgtp-btn { transition: transform 0.12s ease, filter 0.12s ease, background 0.15s ease, box-shadow 0.15s ease; }
      .sgtp-btn:active { transform: scale(0.96); filter: brightness(0.92); }
      .sgtp-tab { transition: color 0.2s ease; }
      .sgtp-tab-icon { transition: transform 0.25s cubic-bezier(.3,1.5,.5,1); }
      .sgtp-tab.active .sgtp-tab-icon { transform: translateY(-2px); }
      .sgtp-card { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
      .sgtp-card:active { transform: scale(0.985); }

      .sgtp-input, .sgtp-select {
        font-family: 'IBM Plex Mono', monospace; background: #0E2C29; border: 1px solid rgba(227,196,140,0.22);
        color: #F3ECDD; border-radius: 10px; padding: 12px 14px; font-size: 15px; width: 100%; outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease; color-scheme: dark;
      }
      .sgtp-input:focus, .sgtp-select:focus { border-color: #E3B15C; box-shadow: 0 0 0 3px rgba(227,177,92,0.18); }
      .sgtp-input::-webkit-calendar-picker-indicator { filter: invert(78%) sepia(28%) saturate(482%) hue-rotate(358deg) brightness(96%) contrast(92%); cursor: pointer; }
      .sgtp-route-line { stroke: #4FB08C; stroke-width: 2; stroke-dasharray: 4 6; fill: none; animation: sgtp-dash 1.4s linear infinite; }

      .leaflet-popup-content-wrapper { background:#12332F; color:#F3ECDD; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.4); }
      .leaflet-popup-tip { background:#12332F; }
      .leaflet-popup-content { margin:12px 14px; }
      .leaflet-popup-close-button { color:#93B0AA !important; }
      .leaflet-container { background:#0A2320; font-family:Inter, sans-serif; }
      .leaflet-control-attribution { background:rgba(10,35,32,0.7) !important; color:#93B0AA !important; font-size:9px !important; }
      .leaflet-control-attribution a { color:#93B0AA !important; }
      .leaflet-control-zoom a { background:#12332F !important; color:#F3ECDD !important; border-color:rgba(227,196,140,0.14) !important; }

      .sgtp-md { font-size: 14px; line-height: 1.55; }
      .sgtp-md > *:first-child { margin-top: 0; }
      .sgtp-md > *:last-child { margin-bottom: 0; }
      .sgtp-md p { margin: 0 0 8px; }
      .sgtp-md strong { color: #E3B15C; font-weight: 700; }
      .sgtp-md ul, .sgtp-md ol { margin: 4px 0 8px; padding-left: 20px; }
      .sgtp-md li { margin-bottom: 3px; }
      .sgtp-md code { font-family: 'IBM Plex Mono', monospace; background: rgba(227,196,140,0.12); border-radius: 4px; padding: 1px 5px; font-size: 12.5px; }
      .sgtp-md a { color: #E3B15C; }
      .sgtp-md table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 12.5px; }
      .sgtp-md th, .sgtp-md td { border: 1px solid rgba(227,196,140,0.22); padding: 6px 9px; text-align: left; }
      .sgtp-md th { font-family: 'IBM Plex Mono', monospace; background: rgba(227,177,92,0.12); color: #E3B15C; font-weight: 600; letter-spacing: 0.02em; }
      .sgtp-md tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
    `}</style>
  );
}

/* =========================================================================
   ICONS (hand-rolled, zero dependency)
   ========================================================================= */
const ICON_PATHS = {
  plane: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />,
  train: <><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 12h14M8 17l-2 4M16 17l2 4" /><circle cx="8.5" cy="8.5" r="0.5" /><circle cx="15.5" cy="8.5" r="0.5" /></>,
  car: <><path d="M4 16V9l2-4h12l2 4v7" /><path d="M2 16h20v3H2z" /><circle cx="7" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>,
  pin: <><path d="M12 22s7-6.2 7-12A7 7 0 0 0 5 10c0 5.8 7 12 7 12Z" /><circle cx="12" cy="10" r="2.3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M4 12l6 6L20 6" />,
  sparkles: <path d="M12 3l1.8 4.6L18 9l-4.2 1.6L12 15l-1.8-4.4L6 9l4.2-1.4L12 3ZM19 14l.9 2.3L22 17l-2.1.8L19 20l-.9-2.2L16 17l2.1-.7Z" />,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
  star: <path d="M12 2l2.9 6.5 7.1.8-5.3 4.9 1.5 7-6.2-3.6L5.8 21l1.5-7-5.3-4.9 7.1-.8Z" />,
  alert: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.5v.1" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  spinner: <><path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  pencil: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="M13.5 6.5l4 4" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
  utensils: <><path d="M6 2v8M4 2v5a2 2 0 0 0 4 0V2M8 2v20M6 10v12" /><path d="M18 2v9a3 3 0 0 1-3 3v8" /><path d="M18 2v9" /></>,
  shop: <><path d="M4 8l1-5h14l1 5" /><path d="M4 8h16v12H4z" /><path d="M9 12a3 3 0 0 0 6 0" /></>,
  tree: <><path d="M12 2 6 11h4l-4 6h5v5h2v-5h5l-4-6h4L12 2Z" /></>,
  landmark: <><path d="M4 21h16M5 21V9M9 21V9M15 21V9M19 21V9M2 9l10-6 10 6" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  ticket: <><path d="M3 8a2 2 0 1 0 0 8M21 8a2 2 0 1 1 0 8" /><path d="M3 8v8h18V8z" /><path d="M9 6v3M9 15v3" /></>,
  map: <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2Z" /><path d="M9 4v14M15 6v14" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M14 9l2 2" /></>,
  imageOff: <><path d="M3 3l18 18" /><path d="M4 8h1.5l2-3h5l1 1.5M20 8v11H8" /><path d="M4 8v11h9" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4.5M12 8h.01" /></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" /><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4" /><path d="M17 12h3v4h-3a2 2 0 0 1 0-4Z" /></>,
  bus: <><rect x="4" y="5" width="16" height="13" rx="2" /><path d="M4 12h16M8 18v2M16 18v2" /><circle cx="8" cy="15" r="0.6" /><circle cx="16" cy="15" r="0.6" /></>,
  location: <><path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.4" /></>,
};
function Icon({ name, size = 16, color = "currentColor", strokeWidth = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name] || null}
    </svg>
  );
}

/* =========================================================================
   PRIMITIVES
   ========================================================================= */
function ZoneDot({ zone, size = 8 }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: ZONE_COLOR[zone] || C.muted, flexShrink: 0 }} />;
}
function ZoneChip({ zone }) {
  return (
    <span className="sgtp-mono" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 999, padding: "3px 8px", letterSpacing: "0.04em" }}>
      <ZoneDot zone={zone} size={6} />{ZONE_CODE[zone] || "OTH"}
    </span>
  );
}
function Thumb({ name, size = 48, radius = 10 }) {
  const [src, setSrc] = useState(photoCache[name] !== undefined ? photoCache[name] : undefined);
  useEffect(() => {
    let alive = true;
    if (src === undefined) fetchPlacePhoto(name).then((url) => { if (alive) setSrc(url); });
    return () => { alive = false; };
  }, [name]);
  if (src) return <img src={src} alt="" loading="lazy" style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", flexShrink: 0, background: "#0E2C29" }} />;
  if (src === undefined) return <div className="sgtp-skeleton" style={{ width: size, height: size, borderRadius: radius, flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: C.panelRaised, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon name="camera" size={Math.round(size * 0.4)} color={C.muted} />
    </div>
  );
}

function Sheet({ open, onClose, title, children, dismissable = true }) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) { setRendered(true); setClosing(false); }
    else if (rendered) { setClosing(true); const t = setTimeout(() => setRendered(false), 240); return () => clearTimeout(t); }
  }, [open]); // eslint-disable-line
  if (!rendered) return null;
  return (
    <div className="sgtp-scrim-enter" style={{ position: "absolute", inset: 0, background: "rgba(5,15,14,0.65)", backdropFilter: "blur(2px)", zIndex: 10000, display: "flex", alignItems: "flex-end" }} onClick={() => dismissable && onClose && onClose()}>
      <div className={closing ? "sgtp-sheet-exit" : "sgtp-sheet-enter"} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxHeight: "86%", overflowY: "auto", background: "linear-gradient(180deg, #14403A 0%, #0F332F 100%)", borderTop: `1px solid ${C.line}`, borderRadius: "20px 20px 0 0", padding: "10px 20px 28px", boxShadow: "0 -20px 50px rgba(0,0,0,0.45)" }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: C.line, margin: "6px auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 className="sgtp-display" style={{ fontSize: 22, color: C.cream, margin: 0 }}>{title}</h2>
          {dismissable && <button className="sgtp-btn" onClick={onClose} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 6 }}><Icon name="x" size={20} /></button>}
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label className="sgtp-mono" style={{ display: "block", fontSize: 11, color: C.muted, marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}
function PrimaryButton({ children, onClick, disabled, style, icon }) {
  return (
    <button className="sgtp-btn" onClick={onClick} disabled={disabled} style={{ width: "100%", background: disabled ? "#3A4A46" : `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`, color: disabled ? C.muted : "#12211E", border: "none", borderRadius: 12, padding: "14px 16px", fontWeight: 700, fontSize: 15, cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: disabled ? "none" : "0 6px 18px rgba(227,177,92,0.25)", ...style }}>
      {icon}{children}
    </button>
  );
}

/* =========================================================================
   SETTINGS SHEET (API key)
   ========================================================================= */
function SettingsSheet({ open, onClose }) {
  const [key, setKey] = useState(getApiKey());
  const [callCount, setCallCount] = useState(0);
  const [budget, setBudget] = useState(DEFAULT_CALL_BUDGET);
  useEffect(() => { if (open) { setKey(getApiKey()); setCallCount(getCallCount()); setBudget(getCallBudget()); } }, [open]);
  const save = () => { setApiKeyStorage(key.trim()); const b = Number(budget); if (b > 0) setCallBudget(b); onClose(); };
  return (
    <Sheet open={open} onClose={onClose} title="AI settings">
      <p style={{ color: C.muted, fontSize: 13, marginTop: -6, marginBottom: 16, lineHeight: 1.55 }}>
        Ask AI and auto-plan call Claude directly from your phone's browser, so they need your own Anthropic API key. Get one at{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: C.gold }}>console.anthropic.com</a>.
        The key stays only on this device (browser local storage) — it's never sent anywhere except Anthropic's API.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(227,177,92,0.1)", border: "1px solid rgba(227,177,92,0.28)", borderRadius: 10, padding: "10px 12px", marginBottom: 18 }}>
        <Icon name="sparkles" size={15} color={C.gold} />
        <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}><b>{callCount}</b> AI call{callCount === 1 ? "" : "s"} made on this device — all on Haiku (the cheapest Claude model), never Sonnet or Opus. This counter is just local bookkeeping; check console.anthropic.com for actual billing.</span>
      </div>
      <Field label="Anthropic API key">
        <input className="sgtp-input" type="password" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
      </Field>
      <Field label="Ask me again after this many calls">
        <input className="sgtp-input" type="number" min="1" step="10" value={budget} onChange={(e) => setBudget(e.target.value)} />
        <p style={{ color: C.muted, fontSize: 11.5, marginTop: 6, lineHeight: 1.5 }}>You'll get one confirmation popup the moment the count above reaches this — saying yes bumps the check-in point up by {CALL_BUDGET_STEP} so you're not asked again right away.</p>
      </Field>
      <PrimaryButton onClick={save} icon={<Icon name="check" size={16} />}>Save</PrimaryButton>
    </Sheet>
  );
}

/* =========================================================================
   EXPENSES SHEET (manual entry — MRT/bus fares + bills/receipts, no AI cost)
   Covers both the day-to-day MRT/bus ledger and general spend logging. Bill
   photos are NOT auto-read here (that needs a paid vision call) — this is
   the free manual path; typing a S$ amount takes a few seconds either way.
   ========================================================================= */
const EXPENSES_KEY = "sgtp-expenses";
const EXPENSE_TYPES = [
  { id: "transport", label: "Transport", icon: "train", color: "#4FB08C" },
  { id: "food", label: "Food", icon: "utensils", color: "#E3B15C" },
  { id: "shopping", label: "Shopping", icon: "shop", color: "#D98B96" },
  { id: "attractions", label: "Attractions", icon: "ticket", color: "#6FA8D0" },
  { id: "misc", label: "Misc", icon: "wallet", color: "#B99A72" },
];
// Old entries used mrt/bus/other before categories were broadened — fold
// them into the new set on read so nothing from before this update is lost.
function migrateExpenseType(t) {
  if (t === "mrt" || t === "bus" || t === "transport") return "transport";
  if (t === "shopping") return "shopping";
  if (t === "attractions") return "attractions";
  if (t === "food") return "food";
  return "misc";
}
function loadExpenses() {
  try {
    return JSON.parse(localStorage.getItem(EXPENSES_KEY) || "[]").map((e) => ({
      ...e,
      type: migrateExpenseType(e.type),
      // Entries logged before dates were tracked fall back to their save timestamp.
      dateStr: e.dateStr || new Date(e.ts || Date.now()).toISOString().slice(0, 10),
    }));
  } catch (e) { return []; }
}
function saveExpenses(list) { try { localStorage.setItem(EXPENSES_KEY, JSON.stringify(list)); } catch (e) {} }
const SPLIT_TYPES = [
  { id: "personal", label: "Personal" },
  { id: "split", label: "Group split" },
  { id: "for-others", label: "Paid for others" },
];
// Free, no-key, no-billing exchange rate endpoint — updated daily, so cache
// for 24h locally rather than re-fetching every time the sheet opens.
const FX_CACHE_KEY = "sgtp-fx-sgd-inr";
const FX_TTL_MS = 24 * 60 * 60 * 1000;
async function getSgdToInrRate() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(FX_CACHE_KEY) || "null"); } catch (e) {}
  if (cached && cached.rate && Date.now() - cached.ts < FX_TTL_MS) return cached.rate;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/SGD");
    const json = await res.json();
    const rate = json && json.rates && json.rates.INR;
    if (rate) { try { localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rate, ts: Date.now() })); } catch (e) {} return rate; }
  } catch (e) {}
  return cached ? cached.rate : null; // serve stale cache rather than nothing if the fetch fails
}
const emptyExpenseForm = () => ({ type: "transport", amount: "", label: "", splitType: "personal", splitMode: "equal", splitCount: 3, splitShares: ["", "", ""], dateStr: new Date().toISOString().slice(0, 10) });
function ExpensesSheet({ open, onClose }) {
  const [view, setView] = useState("add");
  const [entries, setEntries] = useState(loadExpenses);
  const [form, setForm] = useState(emptyExpenseForm);
  const [editingId, setEditingId] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);
  const [fxRate, setFxRate] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState("");
  const [scanNote, setScanNote] = useState(false);
  const fileInputRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    setEntries(loadExpenses()); setView("add"); setEditingId(null); setForm(emptyExpenseForm()); setFilterCategory(null);
    getSgdToInrRate().then(setFxRate);
  }, [open]);
  const totals = useMemo(() => {
    const t = { all: 0, personal: 0, split: 0, "for-others": 0 };
    for (const e of entries) { t.all += e.amount; t[e.splitType] = (t[e.splitType] || 0) + e.amount; }
    return t;
  }, [entries]);
  const byCategory = useMemo(() => {
    const m = {}; for (const t of EXPENSE_TYPES) m[t.id] = 0;
    for (const e of entries) m[e.type] = (m[e.type] || 0) + e.amount;
    return m;
  }, [entries]);
  const maxCat = Math.max(1, ...EXPENSE_TYPES.map((t) => byCategory[t.id] || 0));
  const shownEntries = filterCategory ? entries.filter((e) => e.type === filterCategory) : entries;
  const fmtMoney = (n) => `S$${n.toFixed(2)}`;
  const fmtInr = (sgd) => (fxRate ? `≈ ₹${Math.round(sgd * fxRate).toLocaleString("en-IN")}` : null);
  const fmtShortDate = (d) => { try { return parseDate(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); } catch (e) { return d; } };

  const saveEntry = () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    const payload = {
      type: form.type, amount: amt, label: form.label.trim(), splitType: form.splitType,
      splitCount: form.splitType === "split" ? Math.max(2, Number(form.splitCount) || 2) : null,
      splitMode: form.splitType === "split" ? form.splitMode : null,
      splitShares: form.splitType === "split" && form.splitMode === "custom" ? form.splitShares.map((v) => parseFloat(v) || 0) : null,
      dateStr: form.dateStr || new Date().toISOString().slice(0, 10),
    };
    let next;
    if (editingId) {
      next = entries.map((e) => (e.id === editingId ? { ...e, ...payload } : e));
    } else {
      next = [{ id: uid(), ts: Date.now(), ...payload }, ...entries];
    }
    setEntries(next); saveExpenses(next);
    setForm(emptyExpenseForm()); setEditingId(null); setScanNote(false);
  };
  const startEdit = (entry) => {
    const count = entry.splitCount || 3;
    setForm({
      type: entry.type, amount: String(entry.amount), label: entry.label || "", splitType: entry.splitType,
      splitMode: entry.splitMode || "equal", splitCount: count,
      splitShares: entry.splitShares && entry.splitShares.length ? entry.splitShares.map(String) : Array.from({ length: count }, () => ""),
      dateStr: entry.dateStr,
    });
    setEditingId(entry.id); setView("add"); setScanNote(false);
  };
  const cancelEdit = () => { setEditingId(null); setForm(emptyExpenseForm()); };
  const remove = (id) => {
    const next = entries.filter((e) => e.id !== id); setEntries(next); saveExpenses(next);
    if (editingId === id) cancelEdit();
  };
  // Reads a bill photo via Claude's vision — an explicit, opt-in action (you
  // tap "Scan a bill" each time), so the cost only happens when you actually
  // choose it. Only ever PRE-FILLS the form below; nothing saves until you
  // review it and tap "Add expense" yourself.
  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setScanErr(""); setScanNote(false); setScanning(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const mediaType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
      const system = `You read a photo of a bill/receipt from a Singapore trip. Reply with ONLY raw JSON, no prose, no markdown fences: {"vendor": string or null, "amount": number or null, "category": "transport"|"food"|"shopping"|"attractions"|"misc"}. "amount" is the TOTAL paid (not a subtotal), a plain number with no currency symbol. If you can't read it confidently, use null for vendor/amount and "misc" for category.`;
      const messages = [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }, { type: "text", text: "Read this bill." }] }];
      const raw = await askClaude(messages, system, 300);
      const parsed = JSON.parse(stripFences(raw));
      setForm((f) => ({
        ...f,
        type: parsed.category && EXPENSE_TYPES.some((t) => t.id === parsed.category) ? parsed.category : f.type,
        amount: parsed.amount ? String(parsed.amount) : f.amount,
        label: parsed.vendor || f.label,
      }));
      setScanNote(true);
    } catch (err) {
      setScanErr(err.code === "no-api-key" ? "Add your Anthropic API key in Settings (key icon) first." : err.code === "budget-declined" ? "No problem — enter it manually below instead." : "Couldn't read that photo — enter it manually below.");
    } finally { setScanning(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Expenses">
      <p style={{ color: C.muted, fontSize: 13, marginTop: -6, marginBottom: 14, lineHeight: 1.5 }}>
        Quick-log spend as you go — typing it in is free, purely local bookkeeping. Use this alongside whatever app your group already uses to actually settle up.
      </p>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button onClick={() => setView("add")} className="sgtp-btn sgtp-mono" style={{ flex: 1, fontSize: 12.5, padding: "9px 4px", borderRadius: 10, cursor: "pointer", border: `1px solid ${view === "add" ? C.gold : C.line}`, background: view === "add" ? "rgba(227,177,92,0.14)" : "transparent", color: view === "add" ? C.gold : C.muted }}>{editingId ? "Editing…" : "+ Add expense"}</button>
        <button onClick={() => setView("overview")} className="sgtp-btn sgtp-mono" style={{ flex: 1, fontSize: 12.5, padding: "9px 4px", borderRadius: 10, cursor: "pointer", border: `1px solid ${view === "overview" ? C.gold : C.line}`, background: view === "overview" ? "rgba(227,177,92,0.14)" : "transparent", color: view === "overview" ? C.gold : C.muted }}>Overview</button>
      </div>

      {view === "add" && (
        <>
          {editingId && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(227,177,92,0.1)", border: "1px solid rgba(227,177,92,0.28)", borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: C.gold }}>Editing an existing entry</span>
              <button onClick={cancelEdit} className="sgtp-btn sgtp-mono" style={{ fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFileChange} />
          <button onClick={() => fileInputRef.current && fileInputRef.current.click()} disabled={scanning} className="sgtp-btn" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg, rgba(227,177,92,0.16), rgba(227,177,92,0.04))", border: `1px solid ${C.gold}`, color: C.gold, borderRadius: 12, padding: "11px 14px", fontWeight: 600, fontSize: 13.5, cursor: scanning ? "default" : "pointer", marginBottom: 8 }}>
            {scanning ? <Icon name="spinner" size={15} /> : <Icon name="camera" size={15} />}
            {scanning ? "Reading bill…" : "Scan a bill (uses AI, one call)"}
          </button>
          {scanErr && <div style={{ fontSize: 12, color: C.danger, marginBottom: 10 }}>{scanErr}</div>}
          {scanNote && <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12, color: C.transit, marginBottom: 10 }}><Icon name="check" size={12} /><span>Pre-filled from your photo — check the amount and vendor below before adding.</span></div>}
          <Field label="Category">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {EXPENSE_TYPES.map((t) => (
                <button key={t.id} onClick={() => setForm((f) => ({ ...f, type: t.id }))} className="sgtp-btn" style={{ flex: "1 1 18%", minWidth: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "9px 4px", borderRadius: 10, cursor: "pointer", border: `1px solid ${form.type === t.id ? t.color : C.line}`, background: form.type === t.id ? t.color + "26" : "transparent", color: form.type === t.id ? t.color : C.muted }}>
                  <Icon name={t.icon} size={16} /><span className="sgtp-mono" style={{ fontSize: 9.5 }}>{t.label}</span>
                </button>
              ))}
            </div>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12 }}>
            <Field label="Amount (S$)"><input className="sgtp-input" type="number" min="0" step="0.1" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
            <Field label="Label (optional)"><input className="sgtp-input" style={{ fontFamily: "Inter" }} placeholder="e.g. Chinatown MRT → Sentosa" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} /></Field>
          </div>
          <Field label="Date"><input className="sgtp-input" type="date" value={form.dateStr} onChange={(e) => setForm((f) => ({ ...f, dateStr: e.target.value }))} /></Field>
          <Field label="Who's this for">
            <div style={{ display: "flex", gap: 6 }}>
              {SPLIT_TYPES.map((s) => (
                <button key={s.id} onClick={() => setForm((f) => ({ ...f, splitType: s.id }))} className="sgtp-btn sgtp-mono" style={{ flex: 1, fontSize: 11, padding: "9px 4px", borderRadius: 10, cursor: "pointer", border: `1px solid ${form.splitType === s.id ? C.gold : C.line}`, background: form.splitType === s.id ? "rgba(227,177,92,0.14)" : "transparent", color: form.splitType === s.id ? C.gold : C.muted }}>{s.label}</button>
              ))}
            </div>
          </Field>
          {form.splitType === "split" && (
            <>
              <Field label="Split method">
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ id: "equal", label: "Equal" }, { id: "custom", label: "Custom" }].map((m) => (
                    <button key={m.id} onClick={() => setForm((f) => ({ ...f, splitMode: m.id, splitShares: m.id === "custom" ? Array.from({ length: Number(f.splitCount) || 3 }, (_, i) => f.splitShares[i] || "") : f.splitShares }))} className="sgtp-btn sgtp-mono" style={{ flex: 1, fontSize: 11, padding: "8px 4px", borderRadius: 10, cursor: "pointer", border: `1px solid ${form.splitMode === m.id ? C.gold : C.line}`, background: form.splitMode === m.id ? "rgba(227,177,92,0.14)" : "transparent", color: form.splitMode === m.id ? C.gold : C.muted }}>{m.label}</button>
                  ))}
                </div>
              </Field>
              <Field label="Between how many people">
                <input className="sgtp-input" type="number" min="2" step="1" value={form.splitCount} onChange={(e) => {
                  const n = Math.max(2, Number(e.target.value) || 2);
                  setForm((f) => ({ ...f, splitCount: e.target.value, splitShares: Array.from({ length: n }, (_, i) => f.splitShares[i] || "") }));
                }} />
              </Field>
              {form.splitMode === "equal" ? (
                parseFloat(form.amount) > 0 && Number(form.splitCount) > 0 && (
                  <p style={{ color: C.transit, fontSize: 12, marginTop: -8, marginBottom: 14 }}>{fmtMoney(parseFloat(form.amount) / Number(form.splitCount))} per person</p>
                )
              ) : (
                <Field label="Each person's share (S$)">
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {Array.from({ length: Number(form.splitCount) || 0 }).map((_, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="sgtp-mono" style={{ fontSize: 11, color: C.muted, width: 60, flexShrink: 0 }}>Person {i + 1}</span>
                        <input className="sgtp-input" type="number" min="0" step="0.1" placeholder="0.00" value={form.splitShares[i] || ""} onChange={(e) => {
                          const shares = [...form.splitShares]; shares[i] = e.target.value;
                          setForm((f) => ({ ...f, splitShares: shares }));
                        }} />
                      </div>
                    ))}
                  </div>
                  {parseFloat(form.amount) > 0 && (() => {
                    const sum = form.splitShares.reduce((s, v) => s + (parseFloat(v) || 0), 0);
                    const total = parseFloat(form.amount) || 0;
                    const match = Math.abs(sum - total) < 0.01;
                    return <p style={{ color: match ? C.transit : C.taxi, fontSize: 12, marginTop: 8 }}>Sum: {fmtMoney(sum)} of {fmtMoney(total)} total{match ? " ✓" : ""}</p>;
                  })()}
                </Field>
              )}
            </>
          )}
          <PrimaryButton onClick={saveEntry} disabled={!form.amount || parseFloat(form.amount) <= 0} icon={<Icon name={editingId ? "check" : "plus"} size={16} />}>{editingId ? "Save changes" : "Add expense"}</PrimaryButton>
        </>
      )}

      {view === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 6 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 10px" }}>
              <div className="sgtp-mono" style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase" }}>Total</div>
              <div className="sgtp-display" style={{ fontSize: 16, color: C.cream }}>{fmtMoney(totals.all)}</div>
              {fxRate && <div className="sgtp-mono" style={{ fontSize: 9.5, color: C.muted }}>{fmtInr(totals.all)}</div>}
            </div>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 10px" }}>
              <div className="sgtp-mono" style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase" }}>Split</div>
              <div className="sgtp-display" style={{ fontSize: 16, color: C.cream }}>{fmtMoney(totals.split)}</div>
            </div>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 10px" }}>
              <div className="sgtp-mono" style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase" }}>For others</div>
              <div className="sgtp-display" style={{ fontSize: 16, color: C.cream }}>{fmtMoney(totals["for-others"])}</div>
            </div>
          </div>
          <div className="sgtp-mono" style={{ fontSize: 9.5, color: C.muted, marginBottom: 16 }}>{fxRate ? "INR is an approximate same-day rate, via open.er-api.com" : ""}</div>
          {totals.all === 0 ? (
            <div style={{ color: C.muted, fontSize: 13, fontStyle: "italic", marginBottom: 8 }}>Nothing logged yet — add an expense to see the breakdown here.</div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <div className="sgtp-mono" style={{ fontSize: 11, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10 }}>By category — tap to filter below</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {EXPENSE_TYPES.map((t) => {
                  const val = byCategory[t.id] || 0;
                  const pct = totals.all > 0 ? Math.round((val / totals.all) * 100) : 0;
                  const widthPct = maxCat > 0 ? (val / maxCat) * 100 : 0;
                  const active = filterCategory === t.id;
                  return (
                    <button key={t.id} onClick={() => setFilterCategory(active ? null : t.id)} className="sgtp-btn" style={{ background: active ? t.color + "14" : "none", border: `1px solid ${active ? t.color : "transparent"}`, borderRadius: 8, padding: "6px 6px", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, marginBottom: 4 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, color: C.cream }}><Icon name={t.icon} size={13} color={t.color} />{t.label}</span>
                        <span className="sgtp-mono" style={{ color: C.muted }}>{fmtMoney(val)}{totals.all > 0 && val > 0 ? ` · ${pct}%` : ""}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: C.panelRaised, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${widthPct}%`, background: t.color, borderRadius: 999, transition: "width 0.4s ease" }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {entries.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div className="sgtp-mono" style={{ fontSize: 11, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase" }}>{filterCategory ? `${EXPENSE_TYPES.find((t) => t.id === filterCategory)?.label} entries` : "All entries"}</div>
                {filterCategory && <button onClick={() => setFilterCategory(null)} className="sgtp-btn sgtp-mono" style={{ fontSize: 10.5, color: C.muted, background: "none", border: `1px solid ${C.line}`, borderRadius: 999, padding: "3px 9px", cursor: "pointer" }}>Clear filter ×</button>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {shownEntries.map((e) => {
                  const t = EXPENSE_TYPES.find((x) => x.id === e.type) || EXPENSE_TYPES[4];
                  const perPerson = e.splitType === "split" && e.splitMode !== "custom" && e.splitCount ? e.amount / e.splitCount : null;
                  const splitDetail = e.splitType !== "split" ? "" : e.splitMode === "custom" ? ` · custom (${e.splitCount} ways)` : perPerson ? ` · ${fmtMoney(perPerson)}/person (${e.splitCount})` : "";
                  return (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px" }}>
                      <Icon name={t.icon} size={15} color={t.color} />
                      <button onClick={() => startEdit(e)} className="sgtp-btn" style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                        <div style={{ fontSize: 13, color: C.cream }}>{e.label || t.label}</div>
                        <div className="sgtp-mono" style={{ fontSize: 10.5, color: C.muted }}>
                          {fmtShortDate(e.dateStr)} · {SPLIT_TYPES.find((s) => s.id === e.splitType)?.label}{splitDetail}
                        </div>
                      </button>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div className="sgtp-mono" style={{ fontSize: 13, color: C.gold }}>{fmtMoney(e.amount)}</div>
                        {fxRate && <div className="sgtp-mono" style={{ fontSize: 9.5, color: C.muted }}>{fmtInr(e.amount)}</div>}
                      </div>
                      <button onClick={() => remove(e.id)} className="sgtp-btn" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4, flexShrink: 0 }}><Icon name="trash" size={14} /></button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

/* =========================================================================
   TRIP SETUP SHEET
   ========================================================================= */
function TripSetupSheet({ open, initial, homeBaseInitial, onSave, onClose, dismissable }) {
  const [arrivalDate, setArrivalDate] = useState(initial?.arrivalDate || "");
  const [arrivalTime, setArrivalTime] = useState(initial?.arrivalTime || "06:00");
  const [departureDate, setDepartureDate] = useState(initial?.departureDate || "");
  const [departureTime, setDepartureTime] = useState(initial?.departureTime || "20:20");
  const [hbName, setHbName] = useState(homeBaseInitial?.name || "");
  const [hbUrl, setHbUrl] = useState(homeBaseInitial?.mapsUrl || "");
  const [resolvedCoords, setResolvedCoords] = useState(homeBaseInitial?.coords || null);
  const [resolving, setResolving] = useState(false);
  const [resolveMsg, setResolveMsg] = useState("");
  useEffect(() => {
    if (open) {
      setArrivalDate(initial?.arrivalDate || ""); setArrivalTime(initial?.arrivalTime || "06:00");
      setDepartureDate(initial?.departureDate || ""); setDepartureTime(initial?.departureTime || "20:20");
      setHbName(homeBaseInitial?.name || ""); setHbUrl(homeBaseInitial?.mapsUrl || "");
      setResolvedCoords(homeBaseInitial?.coords || null);
      setResolveMsg(homeBaseInitial?.coords ? "Already set from before — tap Find on map again if you've changed it." : "");
    }
  }, [open]); // eslint-disable-line
  const valid = arrivalDate && arrivalTime && departureDate && departureTime;
  const resolvedZone = resolvedCoords ? nearestZoneForCoords(resolvedCoords) : null;

  // Resolve coords: try the pasted link first (instant, no network) — this
  // only works for a FULL Maps URL with lat/lng embedded in it, never a
  // shortened maps.app.goo.gl / goo.gl/maps share link, since those only
  // reveal coordinates after a server redirect a browser can't follow for
  // us. If the link doesn't yield anything, fall back to free Nominatim
  // geocoding on the typed name — same path "Add your own spot" already
  // uses — so a plain address or landmark name works even without a link.
  const locate = async () => {
    setResolveMsg(""); setResolvedCoords(null);
    const urlCoords = extractCoordsFromUrl(hbUrl);
    if (urlCoords) { setResolvedCoords(urlCoords); setResolveMsg("Found it from your link."); return; }
    const isShortLink = /goo\.gl\/maps|maps\.app\.goo\.gl/i.test(hbUrl);
    if (!hbName.trim()) {
      setResolveMsg(isShortLink
        ? "That's a shortened Maps link — it doesn't contain the actual coordinates, and this app can't follow Google's redirect from the browser. Type the place or street name above too, and I'll look it up for free instead."
        : "Type a name or address above, or paste the full Maps URL (open the link in a browser first, then copy the address-bar URL once it shows '/@lat,lng').");
      return;
    }
    setResolving(true);
    const geo = await geocodeAddress(hbName);
    setResolving(false);
    if (geo) { setResolvedCoords(geo); setResolveMsg("Found it by name — check the pin looks right."); }
    else setResolveMsg(isShortLink
      ? "Couldn't resolve the short link or find that name. Try a more specific nearby landmark, or a full street address."
      : "Couldn't find that — try a more specific name, a full address, or a well-known nearby landmark.");
  };

  // Live reachability preview: how many curated places are a short/medium/
  // long ride from here, using the existing free zone travel matrix.
  const reach = useMemo(() => {
    if (!resolvedZone) return null;
    let near = 0, mid = 0, far = 0;
    for (const p of CURATED_PLACES) {
      const est = travelEstimate(resolvedZone, p.zone);
      if (est <= 20) near++; else if (est <= 40) mid++; else far++;
    }
    return { near, mid, far };
  }, [resolvedZone]);

  const handleSave = () => {
    if (!valid) return;
    onSave({ tripSetup: { arrivalDate, arrivalTime, departureDate, departureTime }, homeBase: { name: hbName || "Guest house", zone: resolvedZone || "Other", mapsUrl: hbUrl, coords: resolvedCoords } });
  };
  return (
    <Sheet open={open} onClose={onClose} title="Trip setup" dismissable={dismissable}>
      <p style={{ color: C.muted, fontSize: 13, marginTop: -6, marginBottom: 18, lineHeight: 1.5 }}>
        Kochi → Singapore, Singapore Airlines. This locks in your dates so the board can build arrival, departure, the concert night and the Universal Studios day automatically.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Arrival date"><input className="sgtp-input" type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} /></Field>
        <Field label="Arrival time"><input className="sgtp-input" type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} /></Field>
        <Field label="Departure date"><input className="sgtp-input" type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} /></Field>
        <Field label="Departure time"><input className="sgtp-input" type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} /></Field>
      </div>
      <div style={{ height: 1, background: C.line, margin: "6px 0 18px" }} />
      <Field label="Where you're staying (guest house / relative's place)">
        <input className="sgtp-input" style={{ fontFamily: "Inter", marginBottom: 8 }} placeholder="e.g. Aunty Su's place, Toa Payoh — or a nearby landmark's name" value={hbName} onChange={(e) => { setHbName(e.target.value); setResolvedCoords(null); setResolveMsg(""); }} />
        <input className="sgtp-input" style={{ fontFamily: "Inter" }} placeholder="Paste Google Maps link (full URL works best, not a shortened share link)" value={hbUrl} onChange={(e) => { setHbUrl(e.target.value); setResolvedCoords(null); setResolveMsg(""); }} />
      </Field>
      <button onClick={locate} disabled={(!hbName.trim() && !hbUrl.trim()) || resolving} className="sgtp-btn sgtp-mono" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: `1px solid ${C.transit}`, color: C.transit, borderRadius: 10, padding: "10px", fontSize: 12.5, cursor: (!hbName.trim() && !hbUrl.trim()) || resolving ? "default" : "pointer", marginTop: 10, marginBottom: 12 }}>
        {resolving ? <Icon name="spinner" size={14} /> : <Icon name="location" size={14} />}
        {resolving ? "Finding location…" : "Find on map"}
      </button>
      {resolveMsg && <div style={{ fontSize: 12, color: resolvedCoords ? C.transit : C.taxi, marginBottom: 12, lineHeight: 1.5 }}>{resolveMsg}</div>}
      {resolvedCoords && <div style={{ marginBottom: 14 }}><MiniRouteMap from={resolvedCoords} height={130} /></div>}
      {reach && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(79,176,140,0.1)", border: "1px solid rgba(79,176,140,0.28)", borderRadius: 10, padding: "10px 12px", marginBottom: 18 }}>
          <Icon name="pin" size={15} color={C.transit} />
          <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}>
            Reads as <b>{resolvedZone}</b>: {reach.near} places {"<"}20 min away, {reach.mid} within 20–40 min{reach.far > 0 ? `, ${reach.far} over 40 min — plan buffer or a taxi leg for those` : ""}.
          </span>
        </div>
      )}
      <PrimaryButton onClick={handleSave} disabled={!valid} icon={<Icon name="plane" size={16} />}>Save trip</PrimaryButton>
    </Sheet>
  );
}

/* =========================================================================
   SCHEDULE SHEET
   ========================================================================= */
// Small embedded map for the schedule flow — shows exactly how close (or
// far) a candidate stop is from wherever you'd be coming from, rather than
// making you judge it from a zone label alone. Sheet fully unmounts this on
// close (see Sheet's rendered/closing logic), so a fresh Leaflet instance
// is safe to create on every open with no leftover-instance conflicts.
function MiniRouteMap({ from, to, height = 150 }) {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current || !from || !window.L) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, doubleClickZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    const dot = (color) => L.divIcon({ className: "", iconSize: [14, 14], html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #0A2320;"></div>` });
    L.marker([from.lat, from.lng], { icon: dot(C.transit) }).addTo(map);
    if (to) {
      L.marker([to.lat, to.lng], { icon: dot(C.gold) }).addTo(map);
      L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: C.gold, weight: 2, opacity: 0.7, dashArray: "1,8" }).addTo(map);
      map.fitBounds([[from.lat, from.lng], [to.lat, to.lng]], { padding: [26, 26], maxZoom: 15 });
    } else {
      map.setView([from.lat, from.lng], 16);
    }
    setTimeout(() => map.invalidateSize(), 60);
    return () => map.remove();
  }, [from?.lat, from?.lng, to?.lat, to?.lng]);
  return <div ref={containerRef} style={{ height, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.line}`, background: C.panelRaised }} />;
}
function ScheduleSheet({ open, onClose, place, tripLength, arrivalDateStr, dayTags, itinerary, homeBase, onConfirm }) {
  const [day, setDay] = useState(1);
  const [startTime, setStartTime] = useState("11:00");
  const [durationMin, setDurationMin] = useState(60);
  const [notes, setNotes] = useState("");
  const [fromOverride, setFromOverride] = useState(null);
  const tripLocked = !homeBase?.coords;
  useEffect(() => {
    if (open && place) { setDay(1); setStartTime("11:00"); setDurationMin(place.durationMin || 60); setNotes(place.defaultNotes || place.note || ""); setFromOverride(null); }
  }, [open, place]); // eslint-disable-line
  useEffect(() => { setFromOverride(null); }, [day]);
  if (!place) return null;
  const dayItems = itinerary.filter((it) => it.day === day);
  const dayItemsSorted = [...dayItems].sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
  const otherZones = [...new Set(dayItems.map((it) => it.zone).filter((z) => z && z !== place.zone))];
  const sameZoneCount = dayItems.filter((it) => it.zone === place.zone).length;
  const minRec = minRecFor(place.name);
  const underMin = minRec && durationMin < minRec;
  const dayOptions = Array.from({ length: tripLength }, (_, i) => i + 1);
  const blocked = tripLocked;

  // "Coming from" — pick a reference point (your stay, or an already-
  // scheduled stop that day) so you can see real distance/time and a map
  // before deciding, per your request. Auto-picks the most recent stop that
  // would already have ended by your chosen start time; overridable.
  // (Plain computation, not useMemo — this runs after an early return above,
  // and hooks can't follow a conditional return.)
  const fromOptions = [];
  if (homeBase?.coords) fromOptions.push({ id: "home", label: `${homeBase.name || "Your stay"}`, coords: homeBase.coords, zone: homeBase.zone, endTime: null });
  for (const it of dayItemsSorted) {
    const c = it.coords || coordsForName(it.name);
    if (c) fromOptions.push({ id: it.id, label: `${it.name} (until ${fmt12(addMinutes(it.startTime, it.durationMin))})`, coords: c, zone: it.zone, endTime: addMinutes(it.startTime, it.durationMin) });
  }
  let autoFrom = null;
  if (fromOptions.length > 0) {
    autoFrom = fromOptions.find((o) => o.id === "home") || fromOptions[0];
    for (const o of fromOptions) { if (o.endTime !== null && o.endTime <= startTime) autoFrom = o; }
  }
  const fromRef = (fromOverride && fromOptions.find((o) => o.id === fromOverride)) || autoFrom;
  const est = fromRef ? travelEstimate(fromRef.zone, place.zone) : null;
  const earliestArrival = fromRef && fromRef.endTime ? addMinutes(fromRef.endTime, est) : null;
  const tooEarly = earliestArrival && startTime < earliestArrival;
  const directionsHref = fromRef ? mapsLink(locString(fromRef), locString(place.coords ? place : { name: place.name }), "transit") : null;

  const handleConfirm = () => {
    if (blocked) return;
    onConfirm({ id: uid(), day, startTime, durationMin: Number(durationMin), name: place.name, zone: place.zone, notes, minRecommended: minRec || null, coords: place.coords || null });
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Schedule · ${place.name}`}>
      <Field label="Day">
        <select className="sgtp-select" value={day} onChange={(e) => setDay(Number(e.target.value))} disabled={tripLocked}>
          {dayOptions.map((d) => {
            const dateStr = dateForDay(d, arrivalDateStr); const tag = dayTags[d];
            return <option key={d} value={d}>Day {d} — {fmtDateLabel(dateStr)}{tag ? ` (${tag})` : ""}{tripLocked ? " — add stay location first" : ""}</option>;
          })}
        </select>
      </Field>
      {blocked && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(217,102,111,0.12)", border: "1px solid rgba(217,102,111,0.3)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <Icon name="alert" size={16} color={C.danger} />
          <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}>You haven't set where you're staying yet — nothing can be scheduled until you have, since every travel time starts from there. Add it in Trip setup (pencil icon).</span>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Start time"><input className="sgtp-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
        <Field label="Duration (min)"><input className="sgtp-input" type="number" min={15} step={15} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} /></Field>
      </div>
      {!blocked && fromOptions.length > 0 && (
        <Field label="Coming from">
          <select className="sgtp-select" value={fromRef?.id || ""} onChange={(e) => setFromOverride(e.target.value)}>
            {fromOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </Field>
      )}
      {!blocked && fromRef && place.coords && (
        <div style={{ marginBottom: 14 }}>
          <MiniRouteMap from={fromRef.coords} to={place.coords} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span className="sgtp-mono" style={{ fontSize: 11.5, color: C.muted }}>~{est} min from {fromRef.label.split(" (")[0]} · {(haversineMeters(fromRef.coords, place.coords) / 1000).toFixed(1)} km</span>
            {directionsHref && <a href={directionsHref} target="_blank" rel="noreferrer" className="sgtp-mono sgtp-btn" style={{ fontSize: 11, color: C.transit, textDecoration: "none" }}>Directions →</a>}
          </div>
        </div>
      )}
      {tooEarly && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(204,122,74,0.12)", border: "1px solid rgba(204,122,74,0.3)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <Icon name="alert" size={16} color={C.taxi} />
          <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}>Coming from {fromRef.label.split(" (")[0]}, you'd realistically arrive around {fmt12(earliestArrival)} — {fmt12(startTime)} may be too early.</span>
        </div>
      )}
      {underMin && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(217,102,111,0.12)", border: "1px solid rgba(217,102,111,0.3)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <Icon name="alert" size={16} color={C.danger} />
          <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}>{place.name} is usually worth at least {Math.floor(minRec / 60)}h {minRec % 60 || ""} — you've set {Math.floor(durationMin / 60)}h {durationMin % 60}m.</span>
        </div>
      )}
      {otherZones.length > 0 ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(204,122,74,0.12)", border: "1px solid rgba(204,122,74,0.3)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <Icon name="alert" size={16} color={C.taxi} />
          <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}>Day {day} already has stops in {otherZones.join(", ")} — different area, more travel time.</span>
        </div>
      ) : sameZoneCount > 0 ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(79,176,140,0.12)", border: "1px solid rgba(79,176,140,0.3)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <Icon name="check" size={16} color={C.transit} />
          <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}>Same general area as your other day {day} stops — good pairing.</span>
        </div>
      ) : null}
      <Field label="Notes (optional)"><textarea className="sgtp-input" style={{ fontFamily: "Inter", minHeight: 64, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <PrimaryButton onClick={handleConfirm} disabled={blocked} icon={<Icon name="plus" size={16} />}>Add to itinerary</PrimaryButton>
    </Sheet>
  );
}

/* =========================================================================
   ITINERARY TAB
   ========================================================================= */
function TravelConnector({ fromZone, toZone, fromLoc, toLoc, gapMin, hasReached }) {
  const est = travelEstimate(fromZone, toZone);
  const tight = gapMin !== null && gapMin < est + 15;
  const mrtHref = mapsLink(fromLoc, toLoc, "transit");
  const taxiHref = mapsLink(fromLoc, toLoc, "driving");
  return (
    <div style={{ display: "flex", gap: 12, padding: "2px 0 2px 3px" }}>
      <div style={{ width: 18, display: "flex", justifyContent: "center" }}>
        <svg width="18" height="46" style={{ overflow: "visible" }}><line x1="9" y1="0" x2="9" y2="46" className="sgtp-route-line" /></svg>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, paddingBottom: 10, paddingTop: 4 }}>
        <a href={mrtHref} target="_blank" rel="noreferrer" className="sgtp-mono sgtp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", fontSize: 11.5, color: tight ? C.taxi : C.transit, textDecoration: "none", border: `1px solid ${tight ? "rgba(204,122,74,0.4)" : "rgba(79,176,140,0.35)"}`, borderRadius: 999, padding: "4px 10px" }}>
          <Icon name="train" size={12} /> ~{est} min {gapMin !== null ? `· ${gapMin} min gap` : ""} · traffic-aware directions
        </a>
        {tight && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <a href={taxiHref} target="_blank" rel="noreferrer" className="sgtp-mono sgtp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", fontSize: 11, color: C.cream, background: "rgba(204,122,74,0.16)", border: "1px solid rgba(204,122,74,0.35)", borderRadius: 999, padding: "4px 10px" }}>
              <Icon name="car" size={12} /> Tight — directions by car
            </a>
            {hasReached && (
              <a href={GRAB_LINK} target="_blank" rel="noreferrer" className="sgtp-mono sgtp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", fontSize: 11, color: C.cream, background: "rgba(204,122,74,0.16)", border: "1px solid rgba(204,122,74,0.35)", borderRadius: 999, padding: "4px 10px" }}>
                <Icon name="car" size={12} /> Open Grab
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
function ItineraryItemCard({ item, isAuto, onDelete, justAdded, homeBase }) {
  const minRec = item.minRecommended;
  const underMin = minRec && item.durationMin < minRec;
  const endTime = addMinutes(item.startTime, item.durationMin);
  const dest = locString(item.coords ? item : { name: item.name });
  const gLink = mapsLink(locString(homeBase), dest, "transit");
  return (
    <div className={`sgtp-card ${justAdded ? "sgtp-pop sgtp-glow" : ""}`} style={{ background: isAuto ? "linear-gradient(135deg, rgba(227,177,92,0.09), rgba(227,177,92,0.02))" : C.panel, border: `1px solid ${isAuto ? "rgba(227,177,92,0.3)" : C.line}`, borderRadius: 14, padding: "13px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span className="sgtp-mono" style={{ fontSize: 12.5, color: C.gold, fontWeight: 500 }}>{fmt12(item.startTime)} – {fmt12(endTime)}</span>
            {isAuto && <Icon name="lock" size={11} color={C.muted} />}
          </div>
          <div className="sgtp-display" style={{ fontSize: 17, color: C.cream, lineHeight: 1.25, marginBottom: 4 }}>{item.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <ZoneChip zone={item.zone} />
            {item.notes && <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{item.notes}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <a href={gLink} target="_blank" rel="noreferrer" className="sgtp-btn" style={{ color: C.muted, padding: 5 }}><Icon name="pin" size={16} /></a>
          {!isAuto && <button onClick={() => onDelete(item.id)} className="sgtp-btn" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 5 }}><Icon name="trash" size={16} /></button>}
        </div>
      </div>
      {underMin && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11.5, color: C.danger }}><Icon name="alert" size={12} /> Usually worth {Math.floor(minRec / 60)}h{minRec % 60 ? ` ${minRec % 60}m` : ""}+ — you've allotted less.</div>}
    </div>
  );
}
function DAY_WINDOW(tag) {
  if (tag === "Arrival") return { start: "10:00", end: "22:00" };
  if (tag === "Concert") return { start: "08:00", end: "15:00" };
  if (tag === "Departure") return { start: "08:00", end: "22:00" };
  return { start: "08:00", end: "22:00" };
}

/* =========================================================================
   LIVE DAY TRACKER — free (navigator.geolocation), opt-in, no API cost.
   Watches your real position against today's stops, offers to mark you
   arrived when you're physically close, then flags when you've stayed
   roughly as long as planned so you know it's a good time to move on.
   ========================================================================= */
function haversineMeters(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function DayTracker({ data }) {
  const { tripSetup, itinerary } = data;
  const [enabled, setEnabled] = useState(false);
  const [pos, setPos] = useState(null);
  const [geoErr, setGeoErr] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [confirmedArrival, setConfirmedArrival] = useState(false);
  const [arrivedAt, setArrivedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const watchIdRef = useRef(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDay = tripSetup ? dayNumberFor(todayStr, tripSetup.arrivalDate) : null;
  const tripLength = tripSetup ? dayNumberFor(tripSetup.departureDate, tripSetup.arrivalDate) : 0;
  const isTripDay = todayDay !== null && todayDay >= 1 && todayDay <= tripLength;

  const todaysStops = useMemo(() => {
    if (!isTripDay) return [];
    return itinerary.filter((it) => it.day === todayDay && it.coords).sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
  }, [itinerary, todayDay, isTripDay]);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoErr(""); },
      () => setGeoErr("Couldn't get your location — check location permission for this app/browser."),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
    return () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [enabled]);

  useEffect(() => { setConfirmedArrival(false); setArrivedAt(null); }, [activeIndex]);
  useEffect(() => { if (!confirmedArrival) return; const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, [confirmedArrival]);

  if (!isTripDay || todaysStops.length === 0) return null;
  const activeStop = todaysStops[activeIndex];
  const nextStop = todaysStops[activeIndex + 1] || null;
  const dist = pos && activeStop ? haversineMeters(pos, activeStop.coords) : null;
  const isNear = dist !== null && dist < 250;
  const elapsedMin = confirmedArrival && arrivedAt ? Math.floor((now - arrivedAt) / 60000) : 0;
  const overtime = confirmedArrival && elapsedMin >= (activeStop.durationMin || 60);
  const markArrived = () => { setConfirmedArrival(true); setArrivedAt(Date.now()); };
  const moveOn = () => setActiveIndex((i) => i + 1);

  return (
    <div style={{ background: "linear-gradient(135deg, rgba(79,176,140,0.1), rgba(79,176,140,0.02))", border: "1px solid rgba(79,176,140,0.28)", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: enabled ? 10 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Icon name="location" size={15} color={C.transit} />
          <span style={{ fontSize: 13, color: C.cream, fontWeight: 600 }}>Live tracking — Day {todayDay}</span>
        </div>
        <button onClick={() => setEnabled((e) => !e)} className="sgtp-btn sgtp-mono" style={{ fontSize: 10.5, padding: "5px 10px", borderRadius: 999, border: `1px solid ${enabled ? C.transit : C.line}`, background: enabled ? "rgba(79,176,140,0.18)" : "transparent", color: enabled ? C.transit : C.muted, cursor: "pointer" }}>{enabled ? "On" : "Turn on"}</button>
      </div>
      {!enabled && <p style={{ color: C.muted, fontSize: 12, margin: "6px 0 0", lineHeight: 1.5 }}>Uses your phone's location to notice when you've reached today's stops, and nudges you when it's about time to move on. Free, stays on this device, only runs while this tab is open.</p>}
      {enabled && (
        <>
          {geoErr && <div style={{ fontSize: 12, color: C.danger, marginBottom: 8 }}>{geoErr}</div>}
          <div style={{ fontSize: 14, color: C.cream, fontWeight: 500, marginBottom: 2 }}>{activeStop.name}</div>
          {!confirmedArrival ? (
            <>
              <div className="sgtp-mono" style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>{dist === null ? "Waiting for a location fix…" : isNear ? `~${Math.round(dist)}m away — looks like you're here` : `~${(dist / 1000).toFixed(1)}km away`}</div>
              <button onClick={markArrived} className="sgtp-btn sgtp-mono" style={{ fontSize: 12, padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.transit}`, background: isNear ? "rgba(79,176,140,0.2)" : "transparent", color: C.transit, cursor: "pointer" }}>I've arrived</button>
            </>
          ) : overtime ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.taxi, marginBottom: 8 }}><Icon name="alert" size={13} /> Here ~{Math.floor(elapsedMin / 60)}h{elapsedMin % 60}m — about as long as planned.{nextStop ? ` Ready for ${nextStop.name}?` : " Last stop for today."}</div>
              {nextStop && <button onClick={moveOn} className="sgtp-btn sgtp-mono" style={{ fontSize: 12, padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.gold}`, background: "rgba(227,177,92,0.14)", color: C.gold, cursor: "pointer" }}>Move to next stop</button>}
            </>
          ) : (
            <div className="sgtp-mono" style={{ fontSize: 11.5, color: C.muted }}>Here {elapsedMin}m of a planned {activeStop.durationMin}m{nextStop ? ` · next: ${nextStop.name}` : ""}</div>
          )}
        </>
      )}
    </div>
  );
}

function ItineraryTab({ data, setData, recentlyAddedIds, removingIds, setRemovingIds }) {
  const { tripSetup, itinerary, dayTags, homeBase } = data;
  const [autoPlanning, setAutoPlanning] = useState(false);
  const [autoErr, setAutoErr] = useState("");
  const arrivalDateStr = tripSetup?.arrivalDate;
  const tripLength = tripSetup ? dayNumberFor(tripSetup.departureDate, tripSetup.arrivalDate) : 0;
  const days = useMemo(() => Array.from({ length: tripLength }, (_, i) => i + 1), [tripLength]);
  const itemsByDay = useMemo(() => {
    const map = {}; for (const d of days) map[d] = [];
    for (const it of itinerary) { if (!map[it.day]) map[it.day] = []; map[it.day].push(it); }
    for (const d of days) map[d].sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
    return map;
  }, [itinerary, days]);
  const handleDelete = (id) => {
    setRemovingIds((prev) => new Set(prev).add(id));
    setTimeout(() => { setData((prev) => ({ ...prev, itinerary: prev.itinerary.filter((it) => it.id !== id) })); setRemovingIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); }, 260);
  };
  const tripLocked = !homeBase?.coords;
  const openDayCount = tripLocked ? 0 : days.filter((d) => dayTags[d] !== "Universal Studios").length;
  const clearableCount = itinerary.filter((it) => !it.id.startsWith("auto-")).length;
  const handleClearPlaces = () => {
    if (clearableCount === 0) return;
    const ok = window.confirm(`Clear all ${clearableCount} scheduled place${clearableCount === 1 ? "" : "s"}? This won't touch your arrival, Universal Studios, concert, or departure blocks.`);
    if (!ok) return;
    setData((prev) => ({ ...prev, itinerary: prev.itinerary.filter((it) => it.id.startsWith("auto-")) }));
  };
  const handleAutoPlan = async () => {
    setAutoErr(""); setAutoPlanning(true);
    try {
      if (tripLocked) { setAutoErr("Add your stay location first (pencil icon) — every travel estimate depends on it, so nothing plans until then."); return; }
      const scheduledNames = new Set(itinerary.map((it) => it.name));
      const pool = [...CURATED_PLACES.filter((p) => !p.fixedOnly), ...data.customPlaces].filter((p) => !scheduledNames.has(p.name));
      const openWindows = days.filter((d) => dayTags[d] !== "Universal Studios").map((d) => ({ day: d, tag: dayTags[d] || "Open", window: DAY_WINDOW(dayTags[d]) }));
      const context = {
        homeBaseZone: homeBase.zone,
        fixedAndScheduled: itinerary.map((it) => ({ day: it.day, name: it.name, startTime: it.startTime, durationMin: it.durationMin, zone: it.zone })),
        openWindows,
        placesPool: pool.map((p) => ({ name: p.name, zone: p.zone, durationMin: p.durationMin, mustVisit: !!p.mustVisit })),
      };
      const system = `You are planning open time slots for a budget 3-sibling family trip to Singapore. Rules:
- Only use places from placesPool, or close well-known Singapore variants if a slot needs filling.
- Never touch a day whose tag is "Universal Studios" — it's fixed and excluded already.
- Prefer MRT/bus pacing: leave real breathing room between stops in different zones, don't pack tight back-to-backs.
- Keep "quick photo op" style spots short. Give Gardens by the Bay a late-afternoon-into-evening slot if scheduling it, so it can run into the 7:45/8:45pm Garden Rhapsody light show.
- Prioritise mustVisit:true places (Night Safari, Gardens by the Bay) if not already scheduled.
- Respect each day's open window (start/end) from openWindows.
- Departure day should stay light — max 1-2 short items in the morning.
- Output ONLY a raw JSON array, no markdown fences, no prose. Each item: {"day":number,"name":string,"startTime":"HH:MM","durationMin":number,"zone":"Central|Orchard|Sentosa|Mandai|Changi|Other","notes":string}. Keep notes under 12 words. Keep the array reasonably short.`;
      const prompt = `Context:\n${JSON.stringify(context)}\n\nReturn the JSON array now.`;
      const raw = await askClaude(prompt, system);
      const clean = stripFences(raw);
      const parsed = JSON.parse(clean);
      const newItems = parsed.filter((p) => p && p.day && p.name && p.startTime).map((p) => ({
        id: uid(), day: p.day, startTime: p.startTime, durationMin: Number(p.durationMin) || 60, name: p.name,
        zone: ZONES.includes(p.zone) ? p.zone : "Other", notes: p.notes || "", minRecommended: minRecFor(p.name) || null,
        coords: coordsForName(p.name) || null,
      }));
      if (newItems.length === 0) setAutoErr("Claude didn't return any usable stops — try again.");
      else {
        setData((prev) => ({ ...prev, itinerary: [...prev.itinerary, ...newItems] }));
        recentlyAddedIds.current = new Set(newItems.map((i) => i.id));
        setTimeout(() => { recentlyAddedIds.current = new Set(); }, 1300);
      }
    } catch (e) {
      if (e.code === "no-api-key") setAutoErr("Add your Anthropic API key in Settings (gear icon) first.");
      else if (e.code === "budget-declined") setAutoErr("No problem — didn't make that call.");
      else setAutoErr("Couldn't reach the planner — check connection and try again.");
    } finally { setAutoPlanning(false); }
  };
  if (!tripSetup) return null;
  return (
    <div className="sgtp-enter" style={{ padding: "16px 16px calc(var(--sgtp-nav-h, 64px) + 36px)" }}>
      <DayTracker data={data} />
      {tripLocked && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(204,122,74,0.1)", border: "1px solid rgba(204,122,74,0.28)", borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
          <Icon name="alert" size={15} color={C.taxi} />
          <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}>You haven't set where you're staying yet — the whole trip stays locked to arrival until you have, since every travel estimate starts from there. Add it via the pencil icon in the header.</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button className="sgtp-btn" onClick={handleAutoPlan} disabled={autoPlanning || tripLocked} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: tripLocked ? "transparent" : "linear-gradient(135deg, rgba(227,177,92,0.18), rgba(227,177,92,0.05))", border: `1px solid ${tripLocked ? C.line : C.gold}`, color: tripLocked ? C.muted : C.gold, borderRadius: 14, padding: "13px 16px", fontWeight: 600, fontSize: 14, cursor: autoPlanning || tripLocked ? "default" : "pointer" }}>
          {autoPlanning ? <Icon name="spinner" size={16} /> : <Icon name="sparkles" size={16} />}
          {autoPlanning ? "Planning…" : tripLocked ? "Auto-plan (add stay location first)" : `Auto-plan (${openDayCount} open)`}
        </button>
        <button className="sgtp-btn" onClick={handleClearPlaces} disabled={clearableCount === 0} title="Clears manually and auto-planned places — leaves arrival, USS, concert and departure untouched" style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: `1px solid ${clearableCount === 0 ? C.line : "rgba(217,102,111,0.4)"}`, color: clearableCount === 0 ? C.muted : C.danger, borderRadius: 14, padding: "13px 16px", fontWeight: 600, fontSize: 14, cursor: clearableCount === 0 ? "default" : "pointer" }}>
          <Icon name="trash" size={16} />
        </button>
      </div>
      {autoErr && <div style={{ color: C.danger, fontSize: 12.5, marginBottom: 14 }}>{autoErr}</div>}
      {days.map((d) => {
        const items = itemsByDay[d] || [];
        const dateStr = dateForDay(d, arrivalDateStr);
        const tag = dayTags[d];
        const dayWindow = DAY_WINDOW(tag);
        // Every day starts from wherever you're staying, not just Day 1 —
        // show that leg explicitly instead of implying the day begins at
        // the first scheduled stop.
        const showStayConnector = !tripLocked && d !== 1 && items.length > 0 && items[0].zone;
        const gapFromStay = showStayConnector ? minutesBetween(dayWindow.start, items[0].startTime) : null;
        return (
          <div key={d} className="sgtp-enter" style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
              <span className="sgtp-display" style={{ fontSize: 26, color: C.cream }}>Day {d}</span>
              <span className="sgtp-mono" style={{ fontSize: 12.5, color: C.muted }}>{fmtDateLabel(dateStr)}</span>
              {tag && <span className="sgtp-mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: tag === "Concert" ? C.concert : C.gold, border: `1px solid ${tag === "Concert" ? "rgba(193,73,90,0.4)" : "rgba(227,177,92,0.35)"}`, borderRadius: 999, padding: "2px 8px" }}>{tag}</span>}
            </div>
            {items.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, padding: "10px 2px", fontStyle: "italic" }}>{tripLocked ? "Locked until your stay location is set." : "Nothing scheduled yet — add from Places, or use auto-plan above."}</div>
            ) : (
              <div className="sgtp-stagger">
                {showStayConnector && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, fontSize: 11, color: C.muted }}>
                    <Icon name="location" size={11} /> From {homeBase.name || "your stay"}
                  </div>
                )}
                {showStayConnector && <TravelConnector fromZone={homeBase.zone} toZone={items[0].zone} fromLoc={locString(homeBase)} toLoc={locString(items[0].coords ? items[0] : { name: items[0].name })} gapMin={gapFromStay} hasReached={hasReachedSingapore(tripSetup)} />}
                {items.map((item, idx) => {
                  const isAuto = item.id.startsWith("auto-");
                  const prev = idx > 0 ? items[idx - 1] : null;
                  const gapMin = prev ? minutesBetween(addMinutes(prev.startTime, prev.durationMin), item.startTime) : null;
                  const removing = removingIds.has(item.id);
                  return (
                    <div key={item.id} className={removing ? "sgtp-removing" : ""}>
                      {prev && <TravelConnector fromZone={prev.zone} toZone={item.zone} fromLoc={locString(prev.coords ? prev : { name: prev.name })} toLoc={locString(item.coords ? item : { name: item.name })} gapMin={gapMin} hasReached={hasReachedSingapore(tripSetup)} />}
                      <ItineraryItemCard item={item} isAuto={isAuto} onDelete={handleDelete} justAdded={recentlyAddedIds.current.has(item.id)} homeBase={homeBase} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================================
   PLACES TAB
   ========================================================================= */
function AddSpotForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [zone, setZone] = useState("Central");
  const [duration, setDuration] = useState(60); const [url, setUrl] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [foundCoords, setFoundCoords] = useState(null);
  const [geocodeMsg, setGeocodeMsg] = useState("");
  // Try the pasted link first (instant, no network). If that doesn't yield
  // coordinates, fall back to free Nominatim geocoding on the typed name —
  // so a plain address works too, not just a Maps link.
  const locate = async () => {
    if (!name.trim()) return;
    setGeocodeMsg(""); setFoundCoords(null);
    const urlCoords = extractCoordsFromUrl(url);
    if (urlCoords) { setFoundCoords(urlCoords); setZone(nearestZoneForCoords(urlCoords) || zone); setGeocodeMsg("Found it from your link."); return; }
    setGeocoding(true);
    const geo = await geocodeAddress(name);
    setGeocoding(false);
    if (geo) { setFoundCoords(geo); setZone(nearestZoneForCoords(geo) || zone); setGeocodeMsg("Found it — check the pin looks right."); }
    else setGeocodeMsg("Couldn't find an exact spot for that — it'll still save, just without a precise map pin. Try a more specific name, or paste a Maps link instead.");
  };
  const submit = () => {
    if (!name.trim()) return;
    const coords = foundCoords || extractCoordsFromUrl(url);
    onAdd({ id: `custom-${uid()}`, name: name.trim(), zone, tag: "Custom", durationMin: Number(duration) || 60, mapsUrl: url, coords, defaultNotes: coords ? "" : "No exact pin found — showing by name only." });
    setName(""); setUrl(""); setDuration(60); setOpen(false); setFoundCoords(null); setGeocodeMsg("");
  };
  if (!open) return (
    <button onClick={() => setOpen(true)} className="sgtp-btn" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: `1.5px dashed ${C.line}`, color: C.muted, borderRadius: 14, padding: "13px 16px", fontSize: 13.5, cursor: "pointer", marginTop: 6 }}>
      <Icon name="plus" size={16} /> Add your own spot
    </button>
  );
  return (
    <div className="sgtp-enter" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginTop: 6 }}>
      <Field label="Name"><input className="sgtp-input" style={{ fontFamily: "Inter" }} value={name} onChange={(e) => { setName(e.target.value); setFoundCoords(null); setGeocodeMsg(""); }} placeholder="e.g. Aunty's favourite laksa stall" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Zone"><select className="sgtp-select" value={zone} onChange={(e) => setZone(e.target.value)}>{ZONES.map((z) => <option key={z} value={z}>{z}</option>)}</select></Field>
        <Field label="Duration (min)"><input className="sgtp-input" type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
      </div>
      <Field label="Google Maps link (optional — helps it find the exact spot)"><input className="sgtp-input" style={{ fontFamily: "Inter" }} value={url} onChange={(e) => { setUrl(e.target.value); setFoundCoords(null); setGeocodeMsg(""); }} placeholder="Paste a share link, or leave blank to search by name" /></Field>
      <button onClick={locate} disabled={!name.trim() || geocoding} className="sgtp-btn sgtp-mono" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: `1px solid ${C.transit}`, color: C.transit, borderRadius: 10, padding: "10px", fontSize: 12.5, cursor: !name.trim() || geocoding ? "default" : "pointer", marginBottom: 12 }}>
        {geocoding ? <Icon name="spinner" size={14} /> : <Icon name="location" size={14} />}
        {geocoding ? "Finding location…" : "Find on map"}
      </button>
      {geocodeMsg && <div style={{ fontSize: 12, color: foundCoords ? C.transit : C.muted, marginBottom: 10, lineHeight: 1.5 }}>{geocodeMsg}</div>}
      {foundCoords && <div style={{ marginBottom: 14 }}><MiniRouteMap from={foundCoords} height={130} /></div>}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setOpen(false)} className="sgtp-btn" style={{ flex: 1, background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: "11px", cursor: "pointer" }}>Cancel</button>
        <button onClick={submit} className="sgtp-btn" style={{ flex: 2, background: C.gold, border: "none", color: "#12211E", fontWeight: 700, borderRadius: 10, padding: "11px", cursor: "pointer" }}>Save spot</button>
      </div>
    </div>
  );
}
function PlaceDetailSheet({ place, open, onClose, onSchedule, isScheduled, onAskAI }) {
  const [extract, setExtract] = useState(undefined);
  useEffect(() => {
    if (!open || !place) return;
    setExtract(extractCache[place.name] !== undefined ? extractCache[place.name] : undefined);
    if (extractCache[place.name] === undefined) fetchPlaceExtract(place.name).then(setExtract);
  }, [open, place]);
  if (!place) return null;
  const ytHref = `https://www.youtube.com/results?search_query=${encodeURIComponent(place.name + " Singapore")}`;
  const mapHref = place.coords ? `https://www.google.com/maps/search/?api=1&query=${place.coords.lat},${place.coords.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " Singapore")}`;
  return (
    <Sheet open={open} onClose={onClose} title={place.name}>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <Thumb name={place.name} size={72} radius={12} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <ZoneChip zone={place.zone} />
            <span className="sgtp-mono" style={{ fontSize: 11, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 999, padding: "3px 8px" }}>{place.tag}</span>
          </div>
          <span className="sgtp-mono" style={{ fontSize: 12, color: C.muted }}>~{Math.round(place.durationMin / 60 * 10) / 10}h typical visit</span>
          <a href={mapHref} target="_blank" rel="noreferrer" className="sgtp-mono sgtp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: C.transit, textDecoration: "none" }}>
            <Icon name="location" size={12} /> View on map
          </a>
        </div>
      </div>
      {place.note && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(227,177,92,0.1)", border: "1px solid rgba(227,177,92,0.28)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <Icon name="star" size={14} color={C.gold} />
          <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}>{place.note}</span>
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <div className="sgtp-mono" style={{ fontSize: 11, color: C.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>What's here</div>
        {extract === undefined && <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: 13 }}><Icon name="spinner" size={14} /> Looking it up…</div>}
        {extract === null && <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.55 }}>No Wikipedia summary found for this one — it's still a solid spot, just less documented online.</div>}
        {extract && <div style={{ color: C.cream, fontSize: 13.5, lineHeight: 1.6 }}>{extract}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <a href={ytHref} target="_blank" rel="noreferrer" className="sgtp-btn sgtp-mono" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: C.cream, textDecoration: "none", border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 10px" }}>
          <Icon name="camera" size={13} /> Watch videos
        </a>
        {onAskAI && (
          <button onClick={() => { onClose(); onAskAI(`Is ${place.name} worth visiting for us, and how does it fit our plan?`); }} className="sgtp-btn sgtp-mono" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: C.gold, background: "transparent", border: `1px solid ${C.gold}`, borderRadius: 10, padding: "9px 10px", cursor: "pointer" }}>
            <Icon name="sparkles" size={13} /> Ask AI
          </button>
        )}
      </div>
      <PrimaryButton onClick={() => onSchedule(place)} disabled={isScheduled} icon={<Icon name={isScheduled ? "check" : "plus"} size={16} />}>
        {isScheduled ? "Already scheduled" : "Schedule this"}
      </PrimaryButton>
    </Sheet>
  );
}
function PlacesTab({ data, setData, onSchedule, onAskAI }) {
  const allPlaces = useMemo(() => [...CURATED_PLACES.filter((p) => !p.fixedOnly), ...data.customPlaces], [data.customPlaces]);
  const scheduledNames = useMemo(() => new Set(data.itinerary.map((it) => it.name)), [data.itinerary]);
  const grouped = useMemo(() => { const g = {}; for (const z of ZONES) g[z] = []; for (const p of allPlaces) (g[p.zone] || (g[p.zone] = [])).push(p); return g; }, [allPlaces]);
  const [detailPlace, setDetailPlace] = useState(null);
  return (
    <div className="sgtp-enter" style={{ padding: "16px 16px calc(var(--sgtp-nav-h, 64px) + 36px)" }}>
      <div style={{ marginBottom: 4 }}>
        <h2 className="sgtp-display" style={{ fontSize: 24, color: C.cream, margin: "0 0 4px" }}>Places</h2>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 14px" }}>Tap <Icon name="info" size={11} /> for what's actually there, + to schedule a spot onto a day.</p>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(147,176,170,0.08)", border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", marginBottom: 18 }}>
          <Icon name="wallet" size={14} color={C.muted} />
          <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>For food, you've got three real options: <b style={{ color: C.cream }}>hawker centres</b> (Budget Food below — cheapest, sit anywhere), <b style={{ color: C.cream }}>restaurants</b> (table service, pricier), or a <b style={{ color: C.cream }}>7-Eleven/Cheers</b> — they're on almost every block in Singapore, good for a quick drink or snack without planning a stop for it.</span>
        </div>
      </div>
      {ZONES.map((zone) => {
        const places = grouped[zone];
        if (!places || places.length === 0) return null;
        const byTag = {};
        for (const p of places) (byTag[p.tag] || (byTag[p.tag] = [])).push(p);
        const tagsPresent = TAG_ORDER.filter((t) => byTag[t]);
        for (const t of Object.keys(byTag)) if (!tagsPresent.includes(t)) tagsPresent.push(t);
        return (
          <div key={zone} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ZoneDot zone={zone} size={10} />
              <span className="sgtp-display" style={{ fontSize: 17, color: C.cream }}>{AREA_LABEL[zone] || zone}</span>
            </div>
            {tagsPresent.map((tag) => (
              <div key={tag} style={{ marginBottom: 14, marginLeft: 4 }}>
                <div className="sgtp-mono" style={{ fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>{tag}</div>
                <div className="sgtp-stagger" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {byTag[tag].map((p) => {
                    const isScheduled = scheduledNames.has(p.name);
                    return (
                      <div key={p.id} className="sgtp-card" style={{ display: "flex", alignItems: "center", gap: 12, background: C.panel, border: `1px solid ${p.mustVisit && !isScheduled ? "rgba(227,177,92,0.4)" : C.line}`, borderRadius: 12, padding: "11px 12px" }}>
                        <button onClick={() => setDetailPlace(p)} className="sgtp-btn" style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
                          <Thumb name={p.name} size={44} radius={10} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 14.5, color: C.cream, fontWeight: 500 }}>{p.name}</span>
                              {p.mustVisit && !isScheduled && <Icon name="star" size={12} color={C.gold} />}
                            </div>
                            <div className="sgtp-mono" style={{ fontSize: 11, color: C.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><Icon name="info" size={11} />{Math.round(p.durationMin / 60 * 10) / 10}h{isScheduled ? " · scheduled" : ""}</div>
                          </div>
                        </button>
                        {data.homeBase.coords && (() => {
                          const est = travelEstimate(data.homeBase.zone, p.zone);
                          const far = est > 40;
                          return (
                            <span className="sgtp-mono" style={{ flexShrink: 0, fontSize: 10.5, color: far ? C.danger : C.muted, border: `1px solid ${far ? "rgba(217,102,111,0.35)" : C.line}`, borderRadius: 999, padding: "3px 7px", whiteSpace: "nowrap" }} title="Estimated travel time from your stay">
                              ~{est}m from stay
                            </span>
                          );
                        })()}
                        <button onClick={() => onSchedule(p)} className="sgtp-btn" style={{ width: 32, height: 32, borderRadius: 10, border: "none", flexShrink: 0, background: isScheduled ? "transparent" : C.gold, color: isScheduled ? C.muted : "#12211E", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <Icon name="plus" size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <AddSpotForm onAdd={(place) => setData((prev) => ({ ...prev, customPlaces: [...prev.customPlaces, place] }))} />
      <PlaceDetailSheet place={detailPlace} open={!!detailPlace} onClose={() => setDetailPlace(null)} onSchedule={(p) => { setDetailPlace(null); onSchedule(p); }} isScheduled={detailPlace ? scheduledNames.has(detailPlace.name) : false} onAskAI={onAskAI} />
    </div>
  );
}

/* =========================================================================
   MAP TAB
   ========================================================================= */
function buildPopupHtml(item, index, colorHex, fromLoc) {
  const cached = photoCache[item.name];
  const photoBlock = cached
    ? `<img src="${cached}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`
    : `<div data-photo-for="${escapeHtml(item.name)}" data-photo-pending="1" style="width:100%;height:100px;border-radius:8px;margin-bottom:8px;background:#0E2C29;display:flex;align-items:center;justify-content:center;color:#93B0AA;font-size:11px;font-family:'IBM Plex Mono',monospace;">loading photo…</div>`;
  const destStr = `${item.lat},${item.lng}`;
  // Directions (not just a place search) so Google Maps shows a real,
  // live-traffic-aware travel time between your previous stop and this one —
  // free, no API key, since it's just an external deep link.
  const gmaps = fromLoc
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromLoc)}&destination=${destStr}&travelmode=transit`
    : `https://www.google.com/maps/search/?api=1&query=${destStr}`;
  const linkLabel = fromLoc ? "Directions & live traffic →" : "Open in Google Maps →";
  return `
    <div style="min-width:190px;">
      ${photoBlock}
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
        <span style="width:18px;height:18px;border-radius:50%;background:${colorHex};color:#12211E;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;flex-shrink:0;">${index}</span>
        <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:700;font-size:15px;color:#F3ECDD;line-height:1.2;">${escapeHtml(item.name)}</span>
      </div>
      ${item.timeLabel ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#93B0AA;margin:2px 0 6px;">${item.timeLabel}</div>` : ""}
      <a href="${gmaps}" target="_blank" style="display:inline-block;font-size:11.5px;color:#E3B15C;text-decoration:none;">${linkLabel}</a>
    </div>`;
}

function MapTab({ data }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [selectedDay, setSelectedDay] = useState("all");
  const [unplaced, setUnplaced] = useState(0);

  const { tripSetup, itinerary, dayTags, homeBase } = data;
  const tripLength = tripSetup ? dayNumberFor(tripSetup.departureDate, tripSetup.arrivalDate) : 0;
  const days = useMemo(() => Array.from({ length: tripLength }, (_, i) => i + 1), [tripLength]);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView([1.3521, 103.8198], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    map.on("popupopen", async (e) => {
      const node = e.popup.getElement();
      if (!node) return;
      const ph = node.querySelector("[data-photo-pending]");
      if (!ph) return;
      const name = ph.getAttribute("data-photo-for");
      const url = await fetchPlacePhoto(name);
      if (url) ph.outerHTML = `<img src="${url}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`;
      else { ph.innerText = "No photo found"; ph.removeAttribute("data-photo-pending"); }
    });
    mapRef.current = map;

    // Re-measure whenever the container's real size changes, not just once on
    // a fixed timer — on an installed Android PWA the address-bar/toolbar
    // collapse animation can settle after our initial mount, which otherwise
    // leaves the map sized to a shorter viewport and a visible gap at the
    // bottom above the nav bar.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    // A few immediate re-measures too, for the first paint before the
    // ResizeObserver has anything to compare against.
    requestAnimationFrame(() => map.invalidateSize());
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 400);

    return () => { ro.disconnect(); clearTimeout(t1); clearTimeout(t2); map.remove(); mapRef.current = null; };
  }, []);

  // redraw markers/lines whenever data or filter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    const group = L.layerGroup();
    let placedCount = 0;
    let totalCount = 0;

    const relevantDays = selectedDay === "all" ? days : [Number(selectedDay)];

    if (homeBase.coords) {
      const hb = L.marker([homeBase.coords.lat, homeBase.coords.lng], {
        icon: L.divIcon({ className: "", html: `<div style="width:22px;height:22px;border-radius:6px;background:#F3ECDD;border:2px solid #0A2320;display:flex;align-items:center;justify-content:center;font-size:12px;">🏠</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
      }).bindPopup(`<div style="font-family:'Big Shoulders Display',sans-serif;font-weight:700;font-size:15px;color:#F3ECDD;">${escapeHtml(homeBase.name || "Guest house")}</div>`);
      group.addLayer(hb);
    }

    relevantDays.forEach((d, di) => {
      const color = DAY_COLORS[(d - 1) % DAY_COLORS.length];
      const items = itinerary.filter((it) => it.day === d).sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
      const latlngs = [];
      let fromLoc = homeBase.coords ? `${homeBase.coords.lat},${homeBase.coords.lng}` : null;
      items.forEach((item, idx) => {
        totalCount++;
        const coords = item.coords || coordsForName(item.name);
        if (!coords) return;
        placedCount++;
        latlngs.push([coords.lat, coords.lng]);
        const marker = L.marker([coords.lat, coords.lng], {
          icon: L.divIcon({
            className: "", iconSize: [26, 26], iconAnchor: [13, 13],
            html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};border:2px solid #0A2320;color:#12211E;font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4);">${idx + 1}</div>`,
          }),
        });
        marker.bindPopup(buildPopupHtml({ ...item, lat: coords.lat, lng: coords.lng, timeLabel: `Day ${d} · ${fmt12(item.startTime)}` }, idx + 1, color, fromLoc));
        group.addLayer(marker);
        fromLoc = `${coords.lat},${coords.lng}`;
      });
      if (latlngs.length > 1) {
        group.addLayer(L.polyline(latlngs, { color, weight: 3, opacity: 0.75, dashArray: "1,9", lineCap: "round" }));
      }
    });

    group.addTo(map);
    layerRef.current = group;
    setUnplaced(totalCount - placedCount);

    const bounds = [];
    group.eachLayer((l) => { if (l.getLatLng) bounds.push(l.getLatLng()); else if (l.getLatLngs) bounds.push(...l.getLatLngs()); });
    if (bounds.length > 0) {
      try { map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 15 }); } catch (e) {}
    }
  }, [itinerary, selectedDay, homeBase, days]);

  if (!tripSetup) return null;

  return (
    <div className="sgtp-enter" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: "var(--sgtp-nav-h, 64px)", display: "flex", flexDirection: "column", isolation: "isolate", zIndex: 0 }}>
      <div style={{ padding: "14px 16px 10px" }}>
        <h2 className="sgtp-display" style={{ fontSize: 24, color: C.cream, margin: "0 0 10px" }}>Map</h2>
        <div className="sgtp-scroll-x" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          <button onClick={() => setSelectedDay("all")} className="sgtp-btn sgtp-mono" style={{ flexShrink: 0, fontSize: 12, padding: "6px 12px", borderRadius: 999, border: `1px solid ${selectedDay === "all" ? C.gold : C.line}`, background: selectedDay === "all" ? "rgba(227,177,92,0.15)" : "transparent", color: selectedDay === "all" ? C.gold : C.muted, cursor: "pointer" }}>All days</button>
          {days.map((d) => (
            <button key={d} onClick={() => setSelectedDay(String(d))} className="sgtp-btn sgtp-mono" style={{ flexShrink: 0, fontSize: 12, padding: "6px 12px", borderRadius: 999, border: `1px solid ${selectedDay === String(d) ? DAY_COLORS[(d - 1) % DAY_COLORS.length] : C.line}`, background: selectedDay === String(d) ? DAY_COLORS[(d - 1) % DAY_COLORS.length] + "26" : "transparent", color: selectedDay === String(d) ? DAY_COLORS[(d - 1) % DAY_COLORS.length] : C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: DAY_COLORS[(d - 1) % DAY_COLORS.length] }} /> Day {d}
            </button>
          ))}
        </div>
        {unplaced > 0 && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>{unplaced} stop{unplaced > 1 ? "s" : ""} not shown — no coordinates yet (paste a Maps link when adding them).</div>}
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      </div>
    </div>
  );
}

/* =========================================================================
   ASK AI TAB
   ========================================================================= */
const CHAT_HISTORY_KEY = "sgtp-chat-history";
const GREETING_TEXT = "Ask me anything about the plan, or tell me to change it — e.g. \"move Chinatown to Thursday afternoon\" or \"add Botanic Gardens on day 2\". I'll show exactly what changed before it sticks.";
function loadChatHistory() {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [{ role: "assistant", text: GREETING_TEXT, greeting: true }];
}
function Markdown({ text }) {
  const html = useMemo(() => {
    try {
      const raw = window.marked ? window.marked.parse(text || "") : (text || "");
      return window.DOMPurify ? window.DOMPurify.sanitize(raw) : raw;
    } catch (e) { return (text || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
  }, [text]);
  return <div className="sgtp-md" dangerouslySetInnerHTML={{ __html: html }} />;
}

// Pull a ```actions [...] ``` fenced block (if any) out of Claude's reply and
// return the visible prose separately from the parsed action list. Keeping
// this a strict fence match (not "any JSON found anywhere") avoids false
// positives if Claude ever mentions JSON in prose for an unrelated reason.
function extractActionsBlock(text) {
  const m = (text || "").match(/```actions\s*([\s\S]*?)```/i);
  if (!m) return { visibleText: text || "", actions: [] };
  let actions = [];
  try { const parsed = JSON.parse(m[1].trim()); if (Array.isArray(parsed)) actions = parsed; } catch (e) { actions = []; }
  return { visibleText: (text || "").replace(m[0], "").trim(), actions };
}

// Validate and apply proposed edits against the REAL current itinerary —
// never trust the model's JSON blindly. Fixed (auto-*) blocks are immovable,
// day range and the stay-location lock are enforced exactly like the manual
// UI, and every action produces a human-readable line so the user always
// sees what actually changed (or why something was skipped) before it's final.
function applyAiActions(actions, ctx) {
  const newItinerary = [...ctx.itinerary];
  const results = [];
  for (const a of actions) {
    if (!a || typeof a !== "object" || !a.action) continue;
    if (a.action === "move" || a.action === "delete") {
      const idx = newItinerary.findIndex((it) => it.id === a.itemId);
      if (idx === -1) { results.push({ ok: false, label: "Couldn't find that item to change — it may have already moved." }); continue; }
      const item = newItinerary[idx];
      if (item.id.startsWith("auto-")) { results.push({ ok: false, label: `"${item.name}" is a fixed block and can't be changed here.` }); continue; }
      if (a.action === "delete") { newItinerary.splice(idx, 1); results.push({ ok: true, label: `Removed "${item.name}" from Day ${item.day}.` }); continue; }
      const day = Number(a.day) || item.day;
      if (day < 1 || day > ctx.tripLength) { results.push({ ok: false, label: `Day ${a.day} is outside this ${ctx.tripLength}-day trip.` }); continue; }
      if (ctx.tripLocked) { results.push({ ok: false, label: `Can't move "${item.name}" — add your stay location first, nothing can be scheduled until then.` }); continue; }
      const startTime = /^\d{2}:\d{2}$/.test(a.startTime || "") ? a.startTime : item.startTime;
      newItinerary[idx] = { ...item, day, startTime };
      results.push({ ok: true, label: `Moved "${item.name}" to Day ${day}, ${fmt12(startTime)}.` });
    } else if (a.action === "add") {
      const name = (a.name || "").trim();
      if (!name) { results.push({ ok: false, label: "Skipped adding a place — no name given." }); continue; }
      const day = Number(a.day);
      if (!day || day < 1 || day > ctx.tripLength) { results.push({ ok: false, label: `Day ${a.day} is outside this ${ctx.tripLength}-day trip.` }); continue; }
      if (ctx.tripLocked) { results.push({ ok: false, label: `Can't add "${name}" — add your stay location first, nothing can be scheduled until then.` }); continue; }
      const startTime = /^\d{2}:\d{2}$/.test(a.startTime || "") ? a.startTime : "10:00";
      const meta = ctx.placePool.find((p) => p.name.toLowerCase() === name.toLowerCase())
        || ctx.placePool.find((p) => p.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(p.name.toLowerCase()));
      const finalName = meta ? meta.name : name;
      const durationMin = Number(a.durationMin) || (meta && meta.durationMin) || 60;
      const newItem = { id: uid(), day, startTime, durationMin, name: finalName, zone: (meta && meta.zone) || "Other", notes: a.notes || "", minRecommended: minRecFor(finalName) || null, coords: (meta && meta.coords) || null };
      newItinerary.push(newItem);
      results.push({ ok: true, label: `Added "${finalName}" to Day ${day}, ${fmt12(startTime)}.` });
    }
  }
  return { newItinerary, results };
}

function AskAITab({ data, setData, pendingQuestion, onConsumeQuestion }) {
  const [messages, setMessages] = useState(loadChatHistory);
  const [input, setInput] = useState(""); const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => { if (pendingQuestion) { setInput(pendingQuestion); onConsumeQuestion && onConsumeQuestion(); } }, [pendingQuestion]);
  const tripLength = data.tripSetup ? dayNumberFor(data.tripSetup.departureDate, data.tripSetup.arrivalDate) : 0;
  const tripLocked = !data.homeBase?.coords;
  const placePool = useMemo(() => [...CURATED_PLACES.filter((p) => !p.fixedOnly), ...data.customPlaces], [data.customPlaces]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages)); } catch (e) {} }, [messages]);
  const clearChat = () => {
    if (!window.confirm("Clear this chat? The AI will lose context of what you've discussed so far.")) return;
    setMessages([{ role: "assistant", text: GREETING_TEXT, greeting: true }]);
  };
  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages = [...messages, { role: "user", text }];
    setInput(""); setMessages(newMessages); setLoading(true);
    try {
      const poolLines = placePool.map((p) => `${p.name} | ${p.zone} | ${p.durationMin}m`).join("\n");
      const system = `You help with a real Singapore trip and can also EDIT the itinerary when asked to. Reference actual day numbers and stop names, be concise, and keep the budget/MRT-first, unhurried-pacing preferences in mind. Format replies in Markdown — **bold** for emphasis, and real Markdown tables (| pipes + header separator row) whenever comparing options or listing structured info, never ASCII-art tables.

KNOWN PLACES (name | zone | typical duration) — prefer these exact names when adding a stop:
${poolLines}

TRIP JSON (tripLocked means NOTHING can be scheduled on any day yet — the whole trip is on hold until the stay location is set, since every travel estimate depends on it):
${JSON.stringify({ ...data, tripLocked })}

EDITING — only when the user is actually asking for a change (move/add/remove a place, change a time):
- After your normal reply, append one fenced block: \`\`\`actions\\n[ ... ]\\n\`\`\` containing ONLY a raw JSON array (no comments, no trailing text inside the fence).
- Allowed action shapes: {"action":"move","itemId":"<id from TRIP JSON itinerary>","day":<1-${tripLength}>,"startTime":"HH:MM"} · {"action":"delete","itemId":"<id>"} · {"action":"add","name":"<place name>","day":<1-${tripLength}>,"startTime":"HH:MM","durationMin":<minutes>,"notes":"<short, optional>"}.
- NEVER target an itemId starting with "auto-" (arrival/USS/concert/departure/check-in are fixed).
- The whole trip is ${tripLocked ? "LOCKED — never output ANY move/add action for any day until the stay location is set. Say so plainly instead." : "open"}.
- If nothing needs to change, omit the actions block entirely.
- Don't restate the changes in your visible reply — a confirmation list is shown separately, so keep your prose to context/reasoning only.`;
      const apiHistory = trimHistory(newMessages.filter((m) => !m.greeting).map((m) => ({ role: m.role, content: m.text })));
      const reply = await askClaude(apiHistory, system);
      const { visibleText, actions } = extractActionsBlock(reply || "");
      let changes = [];
      if (actions.length > 0) {
        const { newItinerary, results } = applyAiActions(actions, { itinerary: data.itinerary, tripLength, tripLocked, placePool });
        changes = results;
        if (results.some((r) => r.ok)) setData((prev) => ({ ...prev, itinerary: newItinerary }));
      }
      setMessages((m) => [...m, { role: "assistant", text: visibleText || reply || "Hmm, I didn't get a response — try again.", changes }]);
    } catch (e) {
      const msg = e.code === "no-api-key" ? "Add your Anthropic API key in Settings (key icon) first." : e.code === "budget-declined" ? "No problem — didn't send that one." : "Couldn't reach the planner — check connection and try again.";
      setMessages((m) => [...m, { role: "assistant", text: msg }]);
    } finally { setLoading(false); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 className="sgtp-display" style={{ fontSize: 24, color: C.cream, margin: 0 }}>Ask AI</h2>
          <button onClick={clearChat} className="sgtp-btn sgtp-mono" style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 999, padding: "5px 11px", fontSize: 11, cursor: "pointer" }}>Clear chat</button>
        </div>
        {messages.map((m, i) => (
          <div key={i} className="sgtp-enter" style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div style={{ maxWidth: "88%", padding: "10px 13px", borderRadius: 14, fontSize: 14, lineHeight: 1.5, background: m.role === "user" ? `linear-gradient(135deg, ${C.gold}, ${C.goldDim})` : C.panel, color: m.role === "user" ? "#12211E" : C.cream, border: m.role === "user" ? "none" : `1px solid ${C.line}` }}>
              {m.role === "user" ? <span style={{ whiteSpace: "pre-wrap" }}>{m.text}</span> : <Markdown text={m.text} />}
              {m.changes && m.changes.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}`, display: "flex", flexDirection: "column", gap: 5 }}>
                  {m.changes.map((c, ci) => (
                    <div key={ci} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: c.ok ? C.transit : C.danger }}>
                      <Icon name={c.ok ? "check" : "alert"} size={12} />
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: 13, padding: "4px 2px" }}><Icon name="spinner" size={14} /> Thinking…</div>}
      </div>
      <div style={{ display: "flex", gap: 8, padding: "10px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)", borderTop: `1px solid ${C.line}`, background: C.ink }}>
        <input className="sgtp-input" style={{ fontFamily: "Inter", flex: 1 }} placeholder="e.g. Move Chinatown to Thursday afternoon" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button onClick={send} disabled={loading} className="sgtp-btn" style={{ width: 46, borderRadius: 12, border: "none", background: C.gold, color: "#12211E", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><Icon name="send" size={17} /></button>
      </div>
    </div>
  );
}

/* =========================================================================
   HEADER + NAV
   ========================================================================= */
function Header({ tripSetup, homeBase, onEdit, onSettings, onExpenses }) {
  const tripLength = tripSetup ? dayNumberFor(tripSetup.departureDate, tripSetup.arrivalDate) : 0;
  return (
    <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 14px) 18px 14px", background: "linear-gradient(180deg, #0D2B27 0%, #0A2320 100%)", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div className="sgtp-mono" style={{ fontSize: 10.5, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Kochi → Singapore · SQ</div>
        <div className="sgtp-display" style={{ fontSize: 20, color: C.cream, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {tripSetup ? `${tripLength}-day trip` : "Trip planner"}
          {tripSetup && <span className="sgtp-mono" style={{ fontSize: 11, color: C.gold, border: "1px solid rgba(227,177,92,0.35)", borderRadius: 999, padding: "2px 8px" }}>{fmtDateLabel(tripSetup.arrivalDate)} – {fmtDateLabel(tripSetup.departureDate)}</span>}
        </div>
        {tripSetup && (
          <button onClick={onEdit} className="sgtp-btn" style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, background: "none", border: "none", padding: 0, cursor: "pointer", color: homeBase?.coords ? C.transit : C.taxi }}>
            <Icon name="location" size={11} />
            <span className="sgtp-mono" style={{ fontSize: 11 }}>{homeBase?.coords ? `Staying at ${homeBase.name || "your stay"} (${homeBase.zone})` : "Add your stay location →"}</span>
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {tripSetup && <button onClick={onExpenses} className="sgtp-btn" style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: 8, cursor: "pointer" }}><Icon name="wallet" size={16} /></button>}
        <button onClick={onSettings} className="sgtp-btn" style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: 8, cursor: "pointer" }}><Icon name="key" size={16} /></button>
        <button onClick={onEdit} className="sgtp-btn" style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: 8, cursor: "pointer" }}><Icon name="pencil" size={16} /></button>
      </div>
    </div>
  );
}
function BottomNav({ active, setActive, navRef }) {
  const tabs = [
    { id: "itinerary", label: "Itinerary", icon: "list" },
    { id: "places", label: "Places", icon: "pin" },
    { id: "map", label: "Map", icon: "map" },
    { id: "ai", label: "Ask AI", icon: "sparkles" },
  ];
  return (
    <div ref={navRef} style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 9999, background: "rgba(10,35,32,0.92)", backdropFilter: "blur(10px)", borderTop: `1px solid ${C.line}`, padding: "8px 4px calc(env(safe-area-inset-bottom, 0px) + 8px)", display: "flex", justifyContent: "space-around" }}>
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => setActive(t.id)} className={`sgtp-tab sgtp-btn ${isActive ? "active" : ""}`} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: isActive ? C.gold : C.muted, padding: "6px 10px" }}>
            <span className="sgtp-tab-icon"><Icon name={t.icon} size={20} strokeWidth={isActive ? 2.4 : 2} /></span>
            <span className="sgtp-mono" style={{ fontSize: 10, letterSpacing: "0.03em" }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
   ROOT
   ========================================================================= */
function SingaporeTripPlanner() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("itinerary");
  const [setupOpen, setSetupOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [removingIds, setRemovingIds] = useState(new Set());
  const [pendingAiQuestion, setPendingAiQuestion] = useState(null);
  const recentlyAddedIds = useRef(new Set());
  const rootRef = useRef(null);
  const navRef = useRef(null);
  // Jump to Ask AI with a starter question pre-filled — never auto-sent, so
  // the actual API call only happens if you tap send yourself.
  const goAskAI = useCallback((question) => { setPendingAiQuestion(question); setActiveTab("ai"); }, []);

  // Measure the bottom nav's ACTUAL rendered height (it varies by device —
  // safe-area-inset-bottom differs on gesture-nav Android phones) and publish
  // it as a CSS var. Anything that must never render underneath the nav
  // (the map, in particular) sizes itself off this real number instead of
  // trusting z-index/stacking alone, which is what silently failed before.
  useEffect(() => {
    if (!navRef.current || !rootRef.current) return;
    const el = navRef.current, root = rootRef.current;
    const measure = () => { root.style.setProperty("--sgtp-nav-h", `${el.offsetHeight}px`); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data.tripSetup]);

  useEffect(() => {
    (async () => {
      try { const res = await storageGet(STORAGE_KEY); if (res && res.value) setData(JSON.parse(res.value)); }
      catch (e) { /* no existing data yet */ }
      setLoaded(true);
    })();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    window.__sgtpCustomPlaces = data.customPlaces;
    (async () => { try { await storageSet(STORAGE_KEY, JSON.stringify(data)); } catch (e) { console.error("storage save failed", e); } })();
  }, [data, loaded]);
  useEffect(() => { if (loaded && !data.tripSetup) setSetupOpen(true); }, [loaded, data.tripSetup]);

  const handleSetupSave = useCallback(({ tripSetup, homeBase }) => {
    setData((prev) => {
      const year = tripSetup.arrivalDate.slice(0, 4);
      const arrival = tripSetup.arrivalDate; const departure = tripSetup.departureDate;
      const tripLength = dayNumberFor(departure, arrival);
      const concertDate = `${year}-${CONCERT_MMDD}`; const ussDate = `${year}-${USS_MMDD}`;
      const concertDay = dayNumberFor(concertDate, arrival); const ussDay = dayNumberFor(ussDate, arrival);
      const nonAuto = prev.itinerary.filter((it) => !it.id.startsWith("auto-"));
      const mergedHomeBase = { ...prev.homeBase, ...homeBase };
      const autoItems = [{ id: "auto-arrival", day: 1, startTime: tripSetup.arrivalTime, durationMin: 60, name: "Land at Changi, clear immigration & baggage", zone: "Changi", notes: "~60 min buffer for a group of 3 with luggage.", minRecommended: null, coords: CHANGI_COORDS }];
      // The trip genuinely can't start with sightseeing before you've reached
      // where you're staying — once the location is known, make that its own
      // locked step right after arrival, not just an implicit assumption.
      if (mergedHomeBase.coords) {
        const travelMin = travelEstimate("Changi", mergedHomeBase.zone) + 20;
        const checkinStart = addMinutes(tripSetup.arrivalTime, 60);
        autoItems.push({ id: "auto-checkin", day: 1, startTime: checkinStart, durationMin: travelMin, name: `Travel to ${mergedHomeBase.name || "your stay"} & drop bags`, zone: mergedHomeBase.zone, notes: "First stop of the trip — everything else on Day 1 starts from here.", minRecommended: null, coords: mergedHomeBase.coords });
      }
      if (ussDay >= 1 && ussDay <= tripLength) autoItems.push({ id: "auto-uss", day: ussDay, startTime: "10:00", durationMin: 570, name: "Universal Studios Singapore (fixed full day)", zone: "Sentosa", notes: "~S$146+/person for admission + Express Pass — buy online in advance, re-check pricing closer to the date.", minRecommended: 480, coords: { lat: 1.2540, lng: 103.8238 } });
      if (concertDay >= 1 && concertDay <= tripLength) autoItems.push({ id: "auto-concert", day: concertDay, startTime: "16:00", durationMin: 360, name: "Concert night — National Stadium, Kallang", zone: "Central", notes: "Arrive ~3h early for Fast Track/Express entry queues. Doors ~7pm.", minRecommended: null, coords: STADIUM_COORDS });
      const departureStart = addMinutes(tripSetup.departureTime, -270);
      autoItems.push({ id: "auto-departure", day: tripLength, startTime: departureStart, durationMin: 270, name: "Head to Changi via Jewel Changi Airport", zone: "Changi", notes: "4.5h block — time to enjoy Jewel plus check-in, immigration & security.", minRecommended: null, coords: CHANGI_COORDS });
      const dayTags = {}; dayTags[1] = "Arrival";
      if (ussDay >= 1 && ussDay <= tripLength) dayTags[ussDay] = "Universal Studios";
      if (concertDay >= 1 && concertDay <= tripLength) dayTags[concertDay] = "Concert";
      dayTags[tripLength] = "Departure";
      return { ...prev, tripSetup, homeBase: { ...prev.homeBase, ...homeBase }, itinerary: [...autoItems, ...nonAuto], dayTags };
    });
    setSetupOpen(false);
  }, []);

  const handleScheduleConfirm = useCallback((item) => {
    setData((prev) => ({ ...prev, itinerary: [...prev.itinerary, item] }));
    recentlyAddedIds.current = new Set([item.id]);
    setTimeout(() => { recentlyAddedIds.current = new Set(); }, 1300);
    setScheduleTarget(null); setActiveTab("itinerary");
  }, []);

  if (!loaded) {
    return (
      <div className="sgtp-root" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: C.ink }}>
        <GlobalStyle /><Icon name="spinner" size={22} color={C.gold} />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="sgtp-root" style={{ position: "relative", height: "100%", minHeight: "100vh", background: C.ink, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <GlobalStyle />
      <Header tripSetup={data.tripSetup} homeBase={data.homeBase} onEdit={() => setSetupOpen(true)} onSettings={() => setSettingsOpen(true)} onExpenses={() => setExpensesOpen(true)} />
      <div style={{ flex: 1, overflowY: activeTab === "map" || activeTab === "ai" ? "hidden" : "auto", position: "relative" }}>
        {data.tripSetup && activeTab === "itinerary" && <ItineraryTab data={data} setData={setData} recentlyAddedIds={recentlyAddedIds} removingIds={removingIds} setRemovingIds={setRemovingIds} />}
        {data.tripSetup && activeTab === "places" && <PlacesTab data={data} setData={setData} onSchedule={setScheduleTarget} onAskAI={goAskAI} />}
        {data.tripSetup && activeTab === "map" && <MapTab data={data} />}
        {data.tripSetup && activeTab === "ai" && <div className="sgtp-enter" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: "var(--sgtp-nav-h, 64px)" }}><AskAITab data={data} setData={setData} pendingQuestion={pendingAiQuestion} onConsumeQuestion={() => setPendingAiQuestion(null)} /></div>}
      </div>
      {data.tripSetup && <BottomNav active={activeTab} setActive={setActiveTab} navRef={navRef} />}
      <TripSetupSheet open={setupOpen} initial={data.tripSetup} homeBaseInitial={data.homeBase} onSave={handleSetupSave} onClose={() => data.tripSetup && setSetupOpen(false)} dismissable={!!data.tripSetup} />
      <ScheduleSheet open={!!scheduleTarget} place={scheduleTarget} tripLength={data.tripSetup ? dayNumberFor(data.tripSetup.departureDate, data.tripSetup.arrivalDate) : 0} arrivalDateStr={data.tripSetup?.arrivalDate} dayTags={data.dayTags} itinerary={data.itinerary} homeBase={data.homeBase} onClose={() => setScheduleTarget(null)} onConfirm={handleScheduleConfirm} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExpensesSheet open={expensesOpen} onClose={() => setExpensesOpen(false)} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<SingaporeTripPlanner />);
