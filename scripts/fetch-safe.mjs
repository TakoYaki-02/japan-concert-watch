import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const USER_AGENT = "JapanConcertWatch/0.1 (+personal, low-frequency collector)";
const MAX_BYTES = 5 * 1024 * 1024;
const cacheDir = path.resolve(".cache/http");
const robotsCache = new Map();

export function createSafeFetcher(source) {
  let sourceCount = 0;
  const maxSource = positiveInt(process.env.COLLECT_MAX_PER_SOURCE, 15);
  const maxTotal = positiveInt(process.env.COLLECT_MAX_TOTAL, 80);
  const timeout = positiveInt(process.env.COLLECT_TIMEOUT_MS, 15000);
  const cacheMs = positiveInt(process.env.COLLECT_CACHE_HOURS, 24) * 3600000;

  return async function safeFetch(url, options = {}) {
    const parsed = assertAllowed(url, source.allowedHosts);
    if (sourceCount >= maxSource || globalThis.__concertFetchCount >= maxTotal) throw new Error("取得上限に達しました");
    const cached = await readCache(parsed.toString(), cacheMs);
    if (cached && !options.ignoreCache) return cached;
    if (!options.skipRobots && !(await robotsAllowed(parsed, source.allowedHosts, timeout))) throw new Error(`robots.txtにより取得不可: ${parsed.pathname}`);

    sourceCount += 1;
    globalThis.__concertFetchCount = (globalThis.__concertFetchCount ?? 0) + 1;
    const result = await request(parsed, source.allowedHosts, timeout);
    await writeCache(parsed.toString(), result);
    return result;
  };
}

async function request(initialUrl, allowedHosts, timeout) {
  let url = initialUrl;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let response;
    try {
      response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/xml;q=0.9" }, redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("不正なリダイレクトです");
      url = assertAllowed(new URL(location, url).toString(), allowedHosts);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get("content-type") ?? "";
    if (!/(text\/(html|plain|xml)|application\/(xhtml\+xml|xml))/i.test(type)) throw new Error(`未対応Content-Type: ${type}`);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new Error("レスポンスが上限を超えています");
    const body = await readLimited(response, MAX_BYTES);
    return { url: url.toString(), body, fetchedAt: new Date().toISOString(), contentHash: createHash("sha256").update(body).digest("hex") };
  }
  throw new Error("リダイレクト回数が上限を超えています");
}

async function readLimited(response, limit) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("レスポンスが上限を超えています"); }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function robotsAllowed(url, allowedHosts, timeout) {
  const origin = url.origin;
  if (!robotsCache.has(origin)) {
    const promise = request(new URL("/robots.txt", origin), allowedHosts, timeout)
      .then((result) => result.body)
      .catch(() => null);
    robotsCache.set(origin, promise);
  }
  const body = await robotsCache.get(origin);
  if (body === null) return false;
  return evaluateRobots(body, url.pathname);
}

export function evaluateRobots(body, pathname) {
  const groups = [];
  let agents = [];
  let rules = [];
  const flush = () => { if (agents.length) groups.push({ agents, rules }); agents = []; rules = []; };
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const index = line.indexOf(":");
    if (index < 0) continue;
    const field = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (field === "user-agent") { if (rules.length) flush(); agents.push(value.toLowerCase()); }
    else if ((field === "allow" || field === "disallow") && agents.length) rules.push({ allow: field === "allow", path: value });
  }
  flush();
  const relevant = groups.filter((group) => group.agents.some((agent) => agent === "*" || USER_AGENT.toLowerCase().startsWith(agent)));
  const matches = relevant.flatMap((group) => group.rules).filter((rule) => rule.path && pathname.startsWith(rule.path));
  if (!matches.length) return true;
  matches.sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return matches[0].allow;
}

function assertAllowed(value, allowedHosts) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !allowedHosts.includes(url.hostname.toLowerCase())) throw new Error(`許可されていない取得先: ${url.origin}`);
  return url;
}

async function readCache(url, maxAge) {
  try {
    const data = JSON.parse(await readFile(cachePath(url), "utf8"));
    return Date.now() - new Date(data.fetchedAt).getTime() <= maxAge ? data : null;
  } catch { return null; }
}

async function writeCache(url, data) {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath(url), JSON.stringify(data), "utf8");
}

function cachePath(url) { return path.join(cacheDir, `${createHash("sha256").update(url).digest("hex")}.json`); }
function positiveInt(value, fallback) { const parsed = Number.parseInt(value ?? "", 10); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback; }
