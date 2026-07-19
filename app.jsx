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
  { id: "p-tiongbahru", name: "Tiong Bahru", zone: "Other", durationMin: 60, tag: "Food", icon: "utensils", coords: { lat: 1.2857, lng: 103.8267 } },
  { id: "p-eastcoast", name: "East Coast Park", zone: "Other", durationMin: 90, tag: "Nature", icon: "tree", coords: { lat: 1.3010, lng: 103.9120 } },
  { id: "p-botanic", name: "Botanic Gardens", zone: "Other", durationMin: 90, tag: "Nature", icon: "tree", coords: { lat: 1.3138, lng: 103.8159 } },
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
  m = url.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}
function locString(nameOrCoords) {
  if (nameOrCoords && nameOrCoords.coords) return `${nameOrCoords.coords.lat},${nameOrCoords.coords.lng}`;
  return `${nameOrCoords.name}, Singapore`;
}
function travelEstimate(zoneA, zoneB) { if (!zoneA || !zoneB) return 30; return TRAVEL_MATRIX[zoneA]?.[zoneB] ?? 30; }
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

async function askClaude(promptOrMessages, systemPrompt, maxTokens = 1000) {
  const key = getApiKey();
  if (!key) { const e = new Error("no-api-key"); e.code = "no-api-key"; throw e; }
  const messages = Array.isArray(promptOrMessages) ? promptOrMessages : [{ role: "user", content: promptOrMessages }];
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
      .sgtp-root { font-family: 'Inter', system-ui, sans-serif; -webkit-tap-highlight-color: transparent; }
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

      .sgtp-enter { animation: sgtp-fade-in 0.35s cubic-bezier(.2,.8,.2,1) both; }
      .sgtp-sheet-enter { animation: sgtp-sheet-up 0.32s cubic-bezier(.16,.9,.28,1) both; }
      .sgtp-sheet-exit { animation: sgtp-sheet-down 0.24s cubic-bezier(.4,0,1,1) both; }
      .sgtp-scrim-enter { animation: sgtp-scrim-in 0.24s ease both; }
      .sgtp-pop { animation: sgtp-pop 0.4s cubic-bezier(.2,.8,.2,1) both; }
      .sgtp-glow { animation: sgtp-glow 1.1s ease-out 1; }
      .sgtp-removing { animation: sgtp-collapse 0.28s ease forwards; overflow: hidden; }
      .sgtp-spin { animation: sgtp-spin 0.9s linear infinite; }

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
    <div className="sgtp-scrim-enter" style={{ position: "absolute", inset: 0, background: "rgba(5,15,14,0.65)", backdropFilter: "blur(2px)", zIndex: 40, display: "flex", alignItems: "flex-end" }} onClick={() => dismissable && onClose && onClose()}>
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
  useEffect(() => { if (open) setKey(getApiKey()); }, [open]);
  const save = () => { setApiKeyStorage(key.trim()); onClose(); };
  return (
    <Sheet open={open} onClose={onClose} title="AI settings">
      <p style={{ color: C.muted, fontSize: 13, marginTop: -6, marginBottom: 16, lineHeight: 1.55 }}>
        Ask AI and auto-plan call Claude directly from your phone's browser, so they need your own Anthropic API key. Get one at{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: C.gold }}>console.anthropic.com</a>.
        The key stays only on this device (browser local storage) — it's never sent anywhere except Anthropic's API.
      </p>
      <Field label="Anthropic API key">
        <input className="sgtp-input" type="password" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
      </Field>
      <PrimaryButton onClick={save} icon={<Icon name="check" size={16} />}>Save key</PrimaryButton>
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
  useEffect(() => {
    if (open) {
      setArrivalDate(initial?.arrivalDate || ""); setArrivalTime(initial?.arrivalTime || "06:00");
      setDepartureDate(initial?.departureDate || ""); setDepartureTime(initial?.departureTime || "20:20");
      setHbName(homeBaseInitial?.name || ""); setHbUrl(homeBaseInitial?.mapsUrl || "");
    }
  }, [open]); // eslint-disable-line
  const valid = arrivalDate && arrivalTime && departureDate && departureTime;

  // Resolve coords either from a pasted Maps link, or — per the "just the
  // name of a nearby landmark" request — a fuzzy match against curated
  // place names if no link was given.
  const resolvedCoords = useMemo(() => {
    const urlCoords = extractCoordsFromUrl(hbUrl);
    if (urlCoords) return urlCoords;
    const q = hbName.trim().toLowerCase();
    if (!q) return null;
    const match = CURATED_PLACES.find((p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase()));
    return match ? match.coords : null;
  }, [hbUrl, hbName]);
  const resolvedZone = resolvedCoords ? nearestZoneForCoords(resolvedCoords) : null;

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
        <input className="sgtp-input" style={{ fontFamily: "Inter", marginBottom: 8 }} placeholder="e.g. Aunty Su's place, Toa Payoh — or a nearby landmark's name" value={hbName} onChange={(e) => setHbName(e.target.value)} />
        <input className="sgtp-input" style={{ fontFamily: "Inter" }} placeholder="Paste Google Maps share link (optional, more precise)" value={hbUrl} onChange={(e) => setHbUrl(e.target.value)} />
      </Field>
      {reach && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(79,176,140,0.1)", border: "1px solid rgba(79,176,140,0.28)", borderRadius: 10, padding: "10px 12px", marginTop: -6, marginBottom: 18 }}>
          <Icon name="pin" size={15} color={C.transit} />
          <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}>
            Reads as <b>{resolvedZone}</b>: {reach.near} places {"<"}20 min away, {reach.mid} within 20–40 min{reach.far > 0 ? `, ${reach.far} over 40 min — plan buffer or a taxi leg for those` : ""}.
          </span>
        </div>
      )}
      {!reach && (hbName.trim() || hbUrl.trim()) && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(204,122,74,0.12)", border: "1px solid rgba(204,122,74,0.3)", borderRadius: 10, padding: "10px 12px", marginTop: -6, marginBottom: 18 }}>
          <Icon name="alert" size={15} color={C.taxi} />
          <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}>Couldn't place that yet — paste a Maps link, or try a better-known nearby landmark name, to get a reachability read.</span>
        </div>
      )}
      <PrimaryButton onClick={handleSave} disabled={!valid} icon={<Icon name="plane" size={16} />}>Save trip</PrimaryButton>
    </Sheet>
  );
}

/* =========================================================================
   SCHEDULE SHEET
   ========================================================================= */
function ScheduleSheet({ open, onClose, place, tripLength, arrivalDateStr, dayTags, itinerary, homeBase, onConfirm }) {
  const [day, setDay] = useState(1);
  const [startTime, setStartTime] = useState("10:00");
  const [durationMin, setDurationMin] = useState(60);
  const [notes, setNotes] = useState("");
  const day1Locked = !homeBase?.coords;
  useEffect(() => {
    if (open && place) { setDay(day1Locked && tripLength > 1 ? 2 : 1); setStartTime("10:00"); setDurationMin(place.durationMin || 60); setNotes(place.defaultNotes || place.note || ""); }
  }, [open, place]); // eslint-disable-line
  if (!place) return null;
  const dayItems = itinerary.filter((it) => it.day === day);
  const otherZones = [...new Set(dayItems.map((it) => it.zone).filter((z) => z && z !== place.zone))];
  const sameZoneCount = dayItems.filter((it) => it.zone === place.zone).length;
  const minRec = minRecFor(place.name);
  const underMin = minRec && durationMin < minRec;
  const dayOptions = Array.from({ length: tripLength }, (_, i) => i + 1);
  const blocked = day1Locked && day === 1;
  const handleConfirm = () => {
    if (blocked) return;
    onConfirm({ id: uid(), day, startTime, durationMin: Number(durationMin), name: place.name, zone: place.zone, notes, minRecommended: minRec || null, coords: place.coords || null });
  };
  return (
    <Sheet open={open} onClose={onClose} title={`Schedule · ${place.name}`}>
      <Field label="Day">
        <select className="sgtp-select" value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {dayOptions.map((d) => {
            const dateStr = dateForDay(d, arrivalDateStr); const tag = dayTags[d];
            const locked = day1Locked && d === 1;
            return <option key={d} value={d}>Day {d} — {fmtDateLabel(dateStr)}{tag ? ` (${tag})` : ""}{locked ? " — add stay location first" : ""}</option>;
          })}
        </select>
      </Field>
      {blocked && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(217,102,111,0.12)", border: "1px solid rgba(217,102,111,0.3)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
          <Icon name="alert" size={16} color={C.danger} />
          <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}>You haven't set where you're staying yet — the trip can't really start until you've reached it. Add it in Trip setup (pencil icon), then Day 1 unlocks.</span>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Start time"><input className="sgtp-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field>
        <Field label="Duration (min)"><input className="sgtp-input" type="number" min={15} step={15} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} /></Field>
      </div>
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
function TravelConnector({ fromZone, toZone, fromLoc, toLoc, gapMin }) {
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
          <Icon name="train" size={12} /> ~{est} min {gapMin !== null ? `· ${gapMin} min gap` : ""}
        </a>
        {tight && (
          <a href={taxiHref} target="_blank" rel="noreferrer" className="sgtp-mono sgtp-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", fontSize: 11, color: C.cream, background: "rgba(204,122,74,0.16)", border: "1px solid rgba(204,122,74,0.35)", borderRadius: 999, padding: "4px 10px" }}>
            <Icon name="car" size={12} /> Tight — taxi (outside your usual budget, worth it here)
          </a>
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
  const day1Locked = !homeBase?.coords;
  const openDayCount = days.filter((d) => dayTags[d] !== "Universal Studios" && !(day1Locked && d === 1)).length;
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
      const scheduledNames = new Set(itinerary.map((it) => it.name));
      const pool = [...CURATED_PLACES.filter((p) => !p.fixedOnly), ...data.customPlaces].filter((p) => !scheduledNames.has(p.name));
      const openWindows = days.filter((d) => dayTags[d] !== "Universal Studios" && !(day1Locked && d === 1)).map((d) => ({ day: d, tag: dayTags[d] || "Open", window: DAY_WINDOW(dayTags[d]) }));
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
      else setAutoErr("Couldn't reach the planner — check connection and try again.");
    } finally { setAutoPlanning(false); }
  };
  if (!tripSetup) return null;
  return (
    <div style={{ padding: "16px 16px 100px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button className="sgtp-btn" onClick={handleAutoPlan} disabled={autoPlanning} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg, rgba(227,177,92,0.18), rgba(227,177,92,0.05))", border: `1px solid ${C.gold}`, color: C.gold, borderRadius: 14, padding: "13px 16px", fontWeight: 600, fontSize: 14, cursor: autoPlanning ? "default" : "pointer" }}>
          {autoPlanning ? <Icon name="spinner" size={16} /> : <Icon name="sparkles" size={16} />}
          {autoPlanning ? "Planning…" : `Auto-plan (${openDayCount} open)`}
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
        return (
          <div key={d} className="sgtp-enter" style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
              <span className="sgtp-display" style={{ fontSize: 26, color: C.cream }}>Day {d}</span>
              <span className="sgtp-mono" style={{ fontSize: 12.5, color: C.muted }}>{fmtDateLabel(dateStr)}</span>
              {tag && <span className="sgtp-mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: tag === "Concert" ? C.concert : C.gold, border: `1px solid ${tag === "Concert" ? "rgba(193,73,90,0.4)" : "rgba(227,177,92,0.35)"}`, borderRadius: 999, padding: "2px 8px" }}>{tag}</span>}
            </div>
            {d === 1 && day1Locked && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(204,122,74,0.1)", border: "1px solid rgba(204,122,74,0.28)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
                <Icon name="alert" size={15} color={C.taxi} />
                <span style={{ fontSize: 12.5, color: C.cream, lineHeight: 1.5 }}>You haven't set where you're staying yet — day 1 stays locked to arrival until you have. Add it via the pencil icon in the header.</span>
              </div>
            )}
            {items.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, padding: "10px 2px", fontStyle: "italic" }}>{d === 1 && day1Locked ? "Locked until your stay location is set." : "Nothing scheduled yet — add from Places, or use auto-plan above."}</div>
            ) : (
              <div>
                {items.map((item, idx) => {
                  const isAuto = item.id.startsWith("auto-");
                  const prev = idx > 0 ? items[idx - 1] : null;
                  const gapMin = prev ? minutesBetween(addMinutes(prev.startTime, prev.durationMin), item.startTime) : null;
                  const removing = removingIds.has(item.id);
                  return (
                    <div key={item.id} className={removing ? "sgtp-removing" : ""}>
                      {prev && <TravelConnector fromZone={prev.zone} toZone={item.zone} fromLoc={locString(prev.coords ? prev : { name: prev.name })} toLoc={locString(item.coords ? item : { name: item.name })} gapMin={gapMin} />}
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
  const submit = () => {
    if (!name.trim()) return;
    const coords = extractCoordsFromUrl(url);
    onAdd({ id: `custom-${uid()}`, name: name.trim(), zone, tag: "Custom", durationMin: Number(duration) || 60, mapsUrl: url, coords, defaultNotes: coords ? "" : url ? "Using name as map search — paste an expanded @lat,lng link for pinpoint directions." : "" });
    setName(""); setUrl(""); setDuration(60); setOpen(false);
  };
  if (!open) return (
    <button onClick={() => setOpen(true)} className="sgtp-btn" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: `1.5px dashed ${C.line}`, color: C.muted, borderRadius: 14, padding: "13px 16px", fontSize: 13.5, cursor: "pointer", marginTop: 6 }}>
      <Icon name="plus" size={16} /> Add your own spot
    </button>
  );
  return (
    <div className="sgtp-enter" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginTop: 6 }}>
      <Field label="Name"><input className="sgtp-input" style={{ fontFamily: "Inter" }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aunty's favourite laksa stall" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Zone"><select className="sgtp-select" value={zone} onChange={(e) => setZone(e.target.value)}>{ZONES.map((z) => <option key={z} value={z}>{z}</option>)}</select></Field>
        <Field label="Duration (min)"><input className="sgtp-input" type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
      </div>
      <Field label="Google Maps link (optional)"><input className="sgtp-input" style={{ fontFamily: "Inter" }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a share link" /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setOpen(false)} className="sgtp-btn" style={{ flex: 1, background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: "11px", cursor: "pointer" }}>Cancel</button>
        <button onClick={submit} className="sgtp-btn" style={{ flex: 2, background: C.gold, border: "none", color: "#12211E", fontWeight: 700, borderRadius: 10, padding: "11px", cursor: "pointer" }}>Save spot</button>
      </div>
    </div>
  );
}
function PlacesTab({ data, setData, onSchedule }) {
  const allPlaces = useMemo(() => [...CURATED_PLACES.filter((p) => !p.fixedOnly), ...data.customPlaces], [data.customPlaces]);
  const scheduledNames = useMemo(() => new Set(data.itinerary.map((it) => it.name)), [data.itinerary]);
  const grouped = useMemo(() => { const g = {}; for (const z of ZONES) g[z] = []; for (const p of allPlaces) (g[p.zone] || (g[p.zone] = [])).push(p); return g; }, [allPlaces]);
  return (
    <div style={{ padding: "16px 16px 100px" }}>
      <div style={{ marginBottom: 4 }}>
        <h2 className="sgtp-display" style={{ fontSize: 24, color: C.cream, margin: "0 0 4px" }}>Places</h2>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 18px" }}>Tap + to schedule a spot onto a day. Photos load from Wikipedia where available.</p>
      </div>
      {ZONES.map((zone) => {
        const places = grouped[zone];
        if (!places || places.length === 0) return null;
        return (
          <div key={zone} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <ZoneDot zone={zone} size={9} />
              <span className="sgtp-mono" style={{ fontSize: 12, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>{zone}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {places.map((p) => {
                const isScheduled = scheduledNames.has(p.name);
                return (
                  <div key={p.id} className="sgtp-card" style={{ display: "flex", alignItems: "center", gap: 12, background: C.panel, border: `1px solid ${p.mustVisit && !isScheduled ? "rgba(227,177,92,0.4)" : C.line}`, borderRadius: 12, padding: "11px 12px" }}>
                    <Thumb name={p.name} size={44} radius={10} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14.5, color: C.cream, fontWeight: 500 }}>{p.name}</span>
                        {p.mustVisit && !isScheduled && <Icon name="star" size={12} color={C.gold} />}
                      </div>
                      <div className="sgtp-mono" style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{p.tag} · {Math.round(p.durationMin / 60 * 10) / 10}h{isScheduled ? " · scheduled" : ""}</div>
                    </div>
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
        );
      })}
      <AddSpotForm onAdd={(place) => setData((prev) => ({ ...prev, customPlaces: [...prev.customPlaces, place] }))} />
    </div>
  );
}

/* =========================================================================
   MAP TAB
   ========================================================================= */
function buildPopupHtml(item, index, colorHex) {
  const cached = photoCache[item.name];
  const photoBlock = cached
    ? `<img src="${cached}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`
    : `<div data-photo-for="${escapeHtml(item.name)}" data-photo-pending="1" style="width:100%;height:100px;border-radius:8px;margin-bottom:8px;background:#0E2C29;display:flex;align-items:center;justify-content:center;color:#93B0AA;font-size:11px;font-family:'IBM Plex Mono',monospace;">loading photo…</div>`;
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
  return `
    <div style="min-width:190px;">
      ${photoBlock}
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
        <span style="width:18px;height:18px;border-radius:50%;background:${colorHex};color:#12211E;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;flex-shrink:0;">${index}</span>
        <span style="font-family:'Big Shoulders Display',sans-serif;font-weight:700;font-size:15px;color:#F3ECDD;line-height:1.2;">${escapeHtml(item.name)}</span>
      </div>
      ${item.timeLabel ? `<div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#93B0AA;margin:2px 0 6px;">${item.timeLabel}</div>` : ""}
      <a href="${gmaps}" target="_blank" style="display:inline-block;font-size:11.5px;color:#E3B15C;text-decoration:none;">Open in Google Maps →</a>
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
        marker.bindPopup(buildPopupHtml({ ...item, lat: coords.lat, lng: coords.lng, timeLabel: `Day ${d} · ${fmt12(item.startTime)}` }, idx + 1, color));
        group.addLayer(marker);
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
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", isolation: "isolate", zIndex: 0 }}>
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
function loadChatHistory() {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [{ role: "assistant", text: "Ask me anything about the plan — I can see your actual days and stops.", greeting: true }];
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
function AskAITab({ data }) {
  const [messages, setMessages] = useState(loadChatHistory);
  const [input, setInput] = useState(""); const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages)); } catch (e) {} }, [messages]);
  const clearChat = () => {
    if (!window.confirm("Clear this chat? The AI will lose context of what you've discussed so far.")) return;
    setMessages([{ role: "assistant", text: "Ask me anything about the plan — I can see your actual days and stops.", greeting: true }]);
  };
  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages = [...messages, { role: "user", text }];
    setInput(""); setMessages(newMessages); setLoading(true);
    try {
      const system = `You help with a real Singapore trip. Here is the current trip data as JSON — reference actual day numbers and stop names in your answers, be concise, and keep the budget/MRT-first, unhurried-pacing preferences in mind. Format your replies in Markdown where it helps — use **bold** for emphasis and real Markdown tables (with | pipes and a header separator row) whenever you're comparing options or listing structured info, instead of plain prose or ASCII art.\n\nTRIP JSON:\n${JSON.stringify(data)}`;
      const apiHistory = trimHistory(newMessages.filter((m) => !m.greeting).map((m) => ({ role: m.role, content: m.text })));
      const reply = await askClaude(apiHistory, system);
      setMessages((m) => [...m, { role: "assistant", text: reply || "Hmm, I didn't get a response — try again." }]);
    } catch (e) {
      const msg = e.code === "no-api-key" ? "Add your Anthropic API key in Settings (gear icon) first." : "Couldn't reach the planner — check connection and try again.";
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
            </div>
          </div>
        ))}
        {loading && <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.muted, fontSize: 13, padding: "4px 2px" }}><Icon name="spinner" size={14} /> Thinking…</div>}
      </div>
      <div style={{ display: "flex", gap: 8, padding: "10px 16px calc(env(safe-area-inset-bottom, 0px) + 90px)", borderTop: `1px solid ${C.line}`, background: C.ink }}>
        <input className="sgtp-input" style={{ fontFamily: "Inter", flex: 1 }} placeholder="e.g. What's the earliest we can leave day 3?" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button onClick={send} disabled={loading} className="sgtp-btn" style={{ width: 46, borderRadius: 12, border: "none", background: C.gold, color: "#12211E", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><Icon name="send" size={17} /></button>
      </div>
    </div>
  );
}

/* =========================================================================
   HEADER + NAV
   ========================================================================= */
function Header({ tripSetup, onEdit, onSettings }) {
  const tripLength = tripSetup ? dayNumberFor(tripSetup.departureDate, tripSetup.arrivalDate) : 0;
  return (
    <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 14px) 18px 14px", background: "linear-gradient(180deg, #0D2B27 0%, #0A2320 100%)", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div className="sgtp-mono" style={{ fontSize: 10.5, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Kochi → Singapore · SQ</div>
        <div className="sgtp-display" style={{ fontSize: 20, color: C.cream, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {tripSetup ? `${tripLength}-day trip` : "Trip planner"}
          {tripSetup && <span className="sgtp-mono" style={{ fontSize: 11, color: C.gold, border: "1px solid rgba(227,177,92,0.35)", borderRadius: 999, padding: "2px 8px" }}>{fmtDateLabel(tripSetup.arrivalDate)} – {fmtDateLabel(tripSetup.departureDate)}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={onSettings} className="sgtp-btn" style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: 8, cursor: "pointer" }}><Icon name="key" size={16} /></button>
        <button onClick={onEdit} className="sgtp-btn" style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: 8, cursor: "pointer" }}><Icon name="pencil" size={16} /></button>
      </div>
    </div>
  );
}
function BottomNav({ active, setActive }) {
  const tabs = [
    { id: "itinerary", label: "Itinerary", icon: "list" },
    { id: "places", label: "Places", icon: "pin" },
    { id: "map", label: "Map", icon: "map" },
    { id: "ai", label: "Ask AI", icon: "sparkles" },
  ];
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 9999, background: "rgba(10,35,32,0.92)", backdropFilter: "blur(10px)", borderTop: `1px solid ${C.line}`, padding: "8px 4px calc(env(safe-area-inset-bottom, 0px) + 8px)", display: "flex", justifyContent: "space-around" }}>
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
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [removingIds, setRemovingIds] = useState(new Set());
  const recentlyAddedIds = useRef(new Set());

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
      const autoItems = [{ id: "auto-arrival", day: 1, startTime: tripSetup.arrivalTime, durationMin: 60, name: "Land at Changi, clear immigration & baggage", zone: "Changi", notes: "~60 min buffer for a group of 3 with luggage.", minRecommended: null, coords: CHANGI_COORDS }];
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
    <div className="sgtp-root" style={{ position: "relative", height: "100%", minHeight: "100vh", background: C.ink, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <GlobalStyle />
      <Header tripSetup={data.tripSetup} onEdit={() => setSetupOpen(true)} onSettings={() => setSettingsOpen(true)} />
      <div style={{ flex: 1, overflowY: activeTab === "map" || activeTab === "ai" ? "hidden" : "auto", position: "relative" }}>
        {data.tripSetup && activeTab === "itinerary" && <ItineraryTab data={data} setData={setData} recentlyAddedIds={recentlyAddedIds} removingIds={removingIds} setRemovingIds={setRemovingIds} />}
        {data.tripSetup && activeTab === "places" && <PlacesTab data={data} setData={setData} onSchedule={setScheduleTarget} />}
        {data.tripSetup && activeTab === "map" && <MapTab data={data} />}
        {data.tripSetup && activeTab === "ai" && <div style={{ position: "absolute", inset: 0 }}><AskAITab data={data} /></div>}
      </div>
      {data.tripSetup && <BottomNav active={activeTab} setActive={setActiveTab} />}
      <TripSetupSheet open={setupOpen} initial={data.tripSetup} homeBaseInitial={data.homeBase} onSave={handleSetupSave} onClose={() => data.tripSetup && setSetupOpen(false)} dismissable={!!data.tripSetup} />
      <ScheduleSheet open={!!scheduleTarget} place={scheduleTarget} tripLength={data.tripSetup ? dayNumberFor(data.tripSetup.departureDate, data.tripSetup.arrivalDate) : 0} arrivalDateStr={data.tripSetup?.arrivalDate} dayTags={data.dayTags} itinerary={data.itinerary} homeBase={data.homeBase} onClose={() => setScheduleTarget(null)} onConfirm={handleScheduleConfirm} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<SingaporeTripPlanner />);
