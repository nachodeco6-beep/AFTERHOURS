// Archivo generado desde src/index.ts con «npm run build». No lo edites a mano: es la versión para pegar en el panel de Cloudflare.

// src/index.ts
var DEFAULT_ORIGINS = ["https://nachodeco6-beep.github.io", "http://localhost:5173"];
var UNSPLASH_API = "https://api.unsplash.com";
var CACHE_SECONDS = 60 * 60;
var TIMEOUT_MS = 8e3;
var QUERY_MAX = 100;
var PER_PAGE_DEFAULT = 15;
var PER_PAGE_MAX = 30;
var PAGE_MAX = 100;
var MEMORY_MAX = 100;
function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}
function fail(code, status, message, extra = {}) {
  const body = { error: { code, message, ...extra } };
  return json(body, status, { "Cache-Control": "no-store" });
}
function allowedOrigins(env) {
  const list = (env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
  return list.length ? list : DEFAULT_ORIGINS;
}
function withCors(response, origin) {
  const res = new Response(response.body, response);
  if (origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Expose-Headers", "X-Cache, X-Ratelimit-Remaining");
  }
  res.headers.append("Vary", "Origin");
  return res;
}
function withUtm(link) {
  const url = new URL(link);
  url.searchParams.set("utm_source", "afterhours");
  url.searchParams.set("utm_medium", "referral");
  return url.toString();
}
function isUnsplashPhoto(v) {
  const p = v;
  return Boolean(
    p && typeof p.id === "string" && typeof p.width === "number" && typeof p.height === "number" && p.urls && typeof p.urls.small === "string" && typeof p.urls.regular === "string" && p.links && typeof p.links.html === "string" && p.user && typeof p.user.name === "string" && p.user.links && typeof p.user.links.html === "string"
  );
}
function normalizePhoto(raw) {
  if (!isUnsplashPhoto(raw)) return null;
  const text = (raw.alt_description || raw.description || "").trim();
  const alt = text ? text.charAt(0).toUpperCase() + text.slice(1) : `Foto de ${raw.user.name}`;
  return {
    id: `unsplash:${raw.id}`,
    source: "unsplash",
    width: raw.width,
    height: raw.height,
    color: raw.color && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : null,
    alt,
    // hotlinked exactly as Unsplash sends them (ixid included)
    urls: { thumb: raw.urls.thumb, small: raw.urls.small, regular: raw.urls.regular, full: raw.urls.full },
    author: { name: raw.user.name, profileUrl: withUtm(raw.user.links.html) },
    pageUrl: withUtm(raw.links.html),
    unsplashId: raw.id
  };
}
async function callUnsplash(path, key) {
  try {
    return await fetch(`${UNSPLASH_API}${path}`, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch {
    return null;
  }
}
async function upstreamError(res) {
  const header = res.headers.get("X-Ratelimit-Remaining");
  const remaining = header !== null && header.trim() !== "" && Number.isFinite(Number(header)) ? Number(header) : void 0;
  const extra = { upstreamStatus: res.status, ...remaining !== void 0 ? { rateLimitRemaining: remaining } : {} };
  const text = await res.text().catch(() => "");
  if (res.status === 401) {
    return fail("invalid_key", 502, "Unsplash rechaz\xF3 la clave. Revis\xE1 que el secreto UNSPLASH_ACCESS_KEY sea la \xABAccess Key\xBB de tu app.", extra);
  }
  if (res.status === 429 || res.status === 403 && (remaining === 0 || /rate limit/i.test(text))) {
    return fail("rate_limited", 429, "Se alcanz\xF3 el l\xEDmite de pedidos a Unsplash por esta hora. Prob\xE1 de nuevo m\xE1s tarde.", extra);
  }
  if (res.status === 404) {
    return fail("not_found", 404, "Unsplash no encontr\xF3 lo que pediste.", extra);
  }
  if (res.status >= 500) {
    return fail("unsplash_error", 502, `Unsplash no est\xE1 respondiendo bien (error ${res.status}). Prob\xE1 en unos minutos.`, extra);
  }
  return fail("unsplash_error", 502, `Unsplash rechaz\xF3 el pedido (error ${res.status}).`, extra);
}
var memory = /* @__PURE__ */ new Map();
function rememberInMemory(key, body, remaining) {
  memory.delete(key);
  memory.set(key, { expires: Date.now() + CACHE_SECONDS * 1e3, body, remaining });
  while (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value);
}
function edgeCache() {
  return typeof caches !== "undefined" && "default" in caches ? caches.default : null;
}
function cachedResponse(body, source, remaining) {
  const headers = { "Cache-Control": `public, max-age=${CACHE_SECONDS}`, "X-Cache": source };
  if (remaining !== null) headers["X-Ratelimit-Remaining"] = remaining;
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}
function intParam(url, name, fallback, min, max) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= min && n <= max ? n : null;
}
async function handleSearch(url, env, ctx) {
  const query = (url.searchParams.get("query") ?? "").trim().replace(/\s+/g, " ");
  if (query.length < 1 || query.length > QUERY_MAX) {
    return fail("invalid_params", 400, `El par\xE1metro \xABquery\xBB tiene que tener entre 1 y ${QUERY_MAX} caracteres.`);
  }
  const perPage = intParam(url, "per_page", PER_PAGE_DEFAULT, 1, PER_PAGE_MAX);
  if (perPage === null) return fail("invalid_params", 400, `El par\xE1metro \xABper_page\xBB tiene que ser un n\xFAmero entre 1 y ${PER_PAGE_MAX}.`);
  const page = intParam(url, "page", 1, 1, PAGE_MAX);
  if (page === null) return fail("invalid_params", 400, `El par\xE1metro \xABpage\xBB tiene que ser un n\xFAmero entre 1 y ${PAGE_MAX}.`);
  const key = env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) return fail("missing_key", 500, "Falta cargar el secreto UNSPLASH_ACCESS_KEY en el Worker.");
  const normalized = query.toLowerCase();
  const params = new URLSearchParams({ query: normalized, per_page: String(perPage), page: String(page) });
  const cacheKey = `${url.origin}/search?${params}`;
  const fromMemory = memory.get(cacheKey);
  if (fromMemory && fromMemory.expires > Date.now()) return cachedResponse(fromMemory.body, "HIT", null);
  const cache = edgeCache();
  const hit = cache ? await cache.match(cacheKey).catch(() => void 0) : void 0;
  if (hit) {
    const body2 = await hit.text();
    rememberInMemory(cacheKey, body2, null);
    return cachedResponse(body2, "HIT", null);
  }
  params.set("content_filter", "high");
  const res = await callUnsplash(`/search/photos?${params}`, key);
  if (!res) return fail("unsplash_unreachable", 503, "No pudimos comunicarnos con Unsplash. Prob\xE1 de nuevo en unos minutos.");
  if (!res.ok) return upstreamError(res);
  let data;
  try {
    data = await res.json();
  } catch {
    return fail("unsplash_error", 502, "Unsplash respondi\xF3 algo que no pudimos leer.", { upstreamStatus: res.status });
  }
  const photos = Array.isArray(data.results) ? data.results.map(normalizePhoto).filter((p) => p !== null) : [];
  const payload = { total: typeof data.total === "number" ? data.total : photos.length, photos };
  const body = JSON.stringify(payload);
  const remaining = res.headers.get("X-Ratelimit-Remaining");
  rememberInMemory(cacheKey, body, remaining);
  if (cache) ctx.waitUntil(cache.put(cacheKey, cachedResponse(body, "HIT", null)).catch(() => void 0));
  return cachedResponse(body, "MISS", remaining);
}
async function handleDownload(url, env) {
  const id = (url.searchParams.get("id") ?? "").replace(/^unsplash:/, "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return fail("invalid_params", 400, "El par\xE1metro \xABid\xBB no es un identificador de Unsplash v\xE1lido.");
  }
  const key = env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) return fail("missing_key", 500, "Falta cargar el secreto UNSPLASH_ACCESS_KEY en el Worker.");
  const res = await callUnsplash(`/photos/${id}/download`, key);
  if (!res) return fail("unsplash_unreachable", 503, "No pudimos comunicarnos con Unsplash. Prob\xE1 de nuevo en unos minutos.");
  if (!res.ok) return upstreamError(res);
  const data = await res.json().catch(() => null);
  if (!data || typeof data.url !== "string") {
    return fail("unsplash_error", 502, "Unsplash respondi\xF3 algo que no pudimos leer.", { upstreamStatus: res.status });
  }
  const body = { url: data.url };
  return json(body, 200, { "Cache-Control": "no-store" });
}
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = origin !== null && allowedOrigins(env).includes(origin);
    if (url.pathname === "/" && request.method === "GET") {
      const status = json({
        service: "afterhours-search",
        ok: true,
        keyConfigured: Boolean(env.UNSPLASH_ACCESS_KEY?.trim()),
        endpoints: ["/search?query=\u2026&per_page=15&page=1", "/download?id=\u2026"]
      });
      return withCors(status, allowed ? origin : null);
    }
    if (!allowed) {
      return fail(
        "origin_not_allowed",
        403,
        origin === null ? "Este buscador solo responde a la web de AFTERHOURS (el pedido no trae la cabecera Origin)." : `El origen ${origin} no tiene permiso para usar esta b\xFAsqueda.`
      );
    }
    if (request.method === "OPTIONS") {
      return withCors(
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400"
          }
        }),
        origin
      );
    }
    if (request.method !== "GET") {
      return withCors(fail("method_not_allowed", 405, "Solo se aceptan pedidos GET."), origin);
    }
    let response;
    try {
      if (url.pathname === "/search") response = await handleSearch(url, env, ctx);
      else if (url.pathname === "/download") response = await handleDownload(url, env);
      else response = fail("not_found", 404, "Esta direcci\xF3n no existe. Us\xE1 /search o /download.");
    } catch {
      response = fail("unsplash_error", 500, "Algo fall\xF3 dentro del Worker.");
    }
    return withCors(response, origin);
  }
};
export {
  index_default as default
};
