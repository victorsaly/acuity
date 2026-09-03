/*
 * Delulu Beats, offline.
 *
 * Installed to a home screen the site has to work with no network at all, so
 * this warms every route the moment it is installed — the HTML and the script
 * and style chunks that HTML names — rather than waiting for you to have
 * visited a game before it will open one.
 *
 * What it deliberately does not touch: anything cross-origin. The leaderboard
 * lives at api.victorsaly.com and is a live board; a cached copy of it would
 * be worse than no board, which the app already handles gracefully.
 *
 * Bump VERSION to throw away every cache on the next activation.
 */

const VERSION = "v1";
/* The precached shell, and the same place odds and ends land: the sample
   manifest, the router payloads, anything same-origin with no better home. */
const CORE = `delulu-core-${VERSION}`;
const PAGES = `delulu-pages-${VERSION}`;
const ASSETS = `delulu-assets-${VERSION}`;
const MEDIA = `delulu-media-${VERSION}`;
/* Kept apart because these are the one thing matched with the query ignored:
   the router stamps each payload URL with a per-build `_rsc` hash. */
const PAYLOADS = `delulu-payloads-${VERSION}`;
const KEEP = [CORE, PAGES, ASSETS, MEDIA, PAYLOADS];

/* The worker is served from the root the app is deployed under, so its own
   location is where the base path is written down — preview builds under a
   subpath need no separate copy of it. */
const BASE = new URL("./", self.location).pathname;
const at = (path) => BASE + path.replace(/^\//, "");

const OFFLINE = at("/offline/");

/** The router's payloads, which carry a per-build query the cache must ignore. */
const isPayload = (url) => url.pathname.endsWith(".txt") && url.pathname.includes("/__next");

/** Every page, because an installed app opens at whichever one you left. */
const ROUTES = [
  "/", "/leaderboard/", "/studio/", "/about/", "/offline/",
  "/color/", "/sound/", "/time/", "/tempo/", "/memory/",
  "/piano/", "/fever/", "/phantom/", "/offgrid/",
];

/**
 * Where the export puts the payload the router fetches for a route.
 *
 * A client-side navigation asks for this, not for the HTML, so warming the
 * HTML alone leaves an offline tap on a link doing nothing at all. The name
 * is the export's, derived from the route; a build that renames these costs a
 * full page load per navigation rather than a broken one, because the HTML is
 * cached either way.
 */
const payloadUrl = (route) => {
  const segment = route.replace(/^\/|\/$/g, "").replace(/\//g, ".");
  return at(`${route}__next${segment ? `.${segment}` : ""}.__PAGE__.txt`);
};

const CORE_FILES = [
  at("/manifest.webmanifest"),
  at("/icon.svg"),
  at("/icons/icon-192.png"),
  at("/icons/icon-512.png"),
  at("/icons/apple-touch-icon.png"),
];

/**
 * Media is the one cache big enough to need a ceiling. The kits alone are ~150
 * files, so this has to clear them comfortably or an install would start
 * evicting the samples it just fetched.
 */
const MEDIA_MAX = 400;

const isMedia = (url) =>
  /\.(mp3|wav|ogg|png|jpe?g|svg|webp|avif|woff2?)$/i.test(url.pathname);

/** Content-hashed by the build, so a hit is always the right file, forever. */
const isImmutable = (url) => url.pathname.startsWith(at("/_next/static/"));

/** One request, cached only if it actually came back. Never throws. */
async function cachePut(cacheName, request, response) {
  if (!response || !response.ok || response.type === "opaque") return response;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    if (cacheName === MEDIA) await trim(cache, MEDIA_MAX);
  } catch {
    /* quota, or a response that cannot be stored — serving it is what matters */
  }
  return response;
}

/** Oldest first, which for a Cache is insertion order. */
async function trim(cache, max) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, keys.length - max)) await cache.delete(key);
}

async function fromCache(request) {
  return (await caches.match(request, { ignoreSearch: false })) ?? null;
}

/** Cache first: only for things whose URL changes when their content does. */
async function cacheFirst(request, cacheName) {
  const hit = await fromCache(request);
  if (hit) return hit;
  const response = await fetch(request);
  return cachePut(cacheName, request, response);
}

/** Network first: fresh whenever there is a network, cached when there isn't. */
async function networkFirst(request, cacheName) {
  try {
    return await cachePut(cacheName, request, await fetch(request));
  } catch {
    const hit = await fromCache(request);
    if (hit) return hit;
    throw new Error("offline and not cached");
  }
}

/**
 * Pull a route into the cache along with the chunks its HTML names.
 *
 * Storing the HTML alone would give an offline visitor a page that renders
 * nothing: every route here is a client component, and the markup is no use
 * without the scripts it points at.
 */
async function warmRoute(route) {
  const path = at(route);
  const response = await fetch(path, { cache: "reload" });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cachePut(PAGES, new Request(path), response);

  try {
    const payload = new Request(payloadUrl(route));
    await cachePut(PAYLOADS, payload, await fetch(payload));
  } catch {
    /* a miss costs a full page load, not a failed navigation */
  }

  const chunks = new Set();
  for (const match of html.matchAll(/["'(]([^"'()\s]*\/_next\/static\/[^"'()\s]+?\.(?:js|css))["')]/g)) {
    chunks.add(new URL(match[1], self.location.origin).href);
  }
  await Promise.all([...chunks].map(async (href) => {
    try {
      const request = new Request(href);
      if (await fromCache(request)) return;
      await cachePut(ASSETS, request, await fetch(request));
    } catch {
      /* one missing chunk is not a reason to abandon the rest */
    }
  }));
}

/**
 * The drum samples, which the rhythm games are unplayable without.
 *
 * Not warmed with the routes: this is four megabytes, and someone who merely
 * opened the site in a tab did not ask to download a kit they may never hear.
 * The page asks for it once the app is actually installed — see InstallApp.
 *
 * The list comes from the manifest the app itself reads, so a kit added there
 * is warmed here without this file knowing anything about it. Beat Lab's vox
 * and effects are not in that manifest and stay on-demand.
 */
async function warmSamples() {
  const manifest = at("/samples/manifest.json");
  const response = await fetch(manifest, { cache: "reload" });
  if (!response.ok) return;
  const kits = (await response.clone().json()).kits ?? {};
  await cachePut(CORE, new Request(manifest), response);

  const files = [];
  for (const [kit, voices] of Object.entries(kits)) {
    for (const voice of Object.values(voices)) {
      for (const file of voice.files ?? []) files.push(at(`/samples/${kit}/${file}`));
    }
  }
  /* Four at a time: enough to be quick, few enough to leave the network to
     whatever the player is doing while this runs. */
  for (let i = 0; i < files.length; i += 4) {
    await Promise.all(files.slice(i, i + 4).map(async (file) => {
      try {
        const request = new Request(file);
        if (await fromCache(request)) return;
        await cachePut(MEDIA, request, await fetch(request));
      } catch {
        /* one sample short is a quieter kit, not a broken app */
      }
    }));
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "warm-samples") return;
  event.waitUntil(warmSamples().catch(() => {}));
});

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE);
    /* One at a time rather than addAll: a single 404 must not fail the whole
       install and leave the app with no worker at all. */
    await Promise.all(CORE_FILES.map((file) => cache.add(file).catch(() => {})));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => name.startsWith("delulu-") && !KEEP.includes(name))
        .map((name) => caches.delete(name)),
    );
    await self.clients.claim();
    /* Sequential on purpose: this runs while the page it was installed from is
       still loading, and fourteen parallel route fetches would compete with it. */
    for (const route of ROUTES) {
      try { await warmRoute(route); } catch { /* offline, or that route moved */ }
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  /* The leaderboard, and anything else off this origin, goes straight to the
     network — a stale board is worse than the absent one the app draws. */
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    /* Keyed on the path alone. The export answers every query with the same
       HTML, so one entry per route matches what was warmed, rather than a
       fresh copy per visit carrying a query — and the sign-in return trip
       arrives as `?auth=<one-time code>`, which has no business being written
       into a cache key or looked for in one. Keying on the request itself
       both stored that code and then missed the warmed page it should have
       fallen back to. */
    const key = new Request(url.origin + url.pathname);
    event.respondWith((async () => {
      try {
        return await cachePut(PAGES, key, await fetch(request));
      } catch {
        return (await fromCache(key)) ?? (await caches.match(OFFLINE)) ?? Response.error();
      }
    })());
    return;
  }

  if (isPayload(url)) {
    /* Network first so a live visit always gets the current build, but the
       fallback ignores the `_rsc` query — it changes every build, and an
       exact match would miss the copy warmed minutes ago. */
    return event.respondWith((async () => {
      try {
        return await cachePut(PAYLOADS, new Request(url.origin + url.pathname), await fetch(request));
      } catch {
        return (await caches.match(url.origin + url.pathname, { ignoreSearch: true }))
          ?? Response.error();
      }
    })());
  }

  if (isImmutable(url)) return event.respondWith(cacheFirst(request, ASSETS));
  if (isMedia(url)) return event.respondWith(cacheFirst(request, MEDIA));
  event.respondWith(networkFirst(request, CORE));
});
