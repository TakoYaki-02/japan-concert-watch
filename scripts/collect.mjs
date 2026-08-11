import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSafeFetcher } from "./fetch-safe.mjs";
import { dedupeConcerts } from "./normalize.mjs";
import { discoverLinks, parseConcertPage } from "./parse.mjs";
import { SOURCES } from "./sources.mjs";

const outputPath = path.resolve("public/data/concerts.json");
const previous = await readPrevious();
const allRecords = [];
const sourceStatus = [];
globalThis.__concertFetchCount = 0;

for (const source of SOURCES) {
  const fetchPage = createSafeFetcher(source);
  const startedAt = new Date().toISOString();
  let count = 0;
  try {
    const entry = await fetchPage(source.entryUrl);
    if (source.key === "udiscovermusic") {
      const entryRecords = parseConcertPage(entry.body, entry.url, source, entry.fetchedAt, entry.contentHash);
      allRecords.push(...entryRecords);
      count += entryRecords.length;
    }
    const links = source.key === "udiscovermusic" ? [] : discoverLinks(entry.body, entry.url, source);
    const results = await Promise.allSettled(links.map(async (url) => {
      const page = await fetchPage(url);
      return parseConcertPage(page.body, page.url, source, page.fetchedAt, page.contentHash);
    }));
    for (const result of results) if (result.status === "fulfilled") { allRecords.push(...result.value); count += result.value.length; }
    const failed = results.filter((result) => result.status === "rejected").length;
    sourceStatus.push({ key: source.key, name: source.name, status: failed ? "partial" : "ok", fetchedAt: startedAt, count, message: failed ? `${failed}ページを取得できませんでした` : "取得完了" });
  } catch (error) {
    sourceStatus.push({ key: source.key, name: source.name, status: "error", fetchedAt: startedAt, count, message: safeMessage(error) });
  }
}

const now = new Date().toISOString();
const today = now.slice(0, 10);
const failedKeys = new Set(sourceStatus.filter((status) => status.status === "error").map((status) => status.key));
const retained = (previous.concerts ?? []).filter((concert) => concert.performanceDate >= today && concert.sources.every((item) => failedKeys.has(item.key)));
const concerts = dedupeConcerts([...allRecords, ...retained], previous.concerts ?? []);
const output = { schemaVersion: 1, generatedAt: now, concerts, sourceStatus };
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`収集完了: ${concerts.length}公演 / HTTP ${globalThis.__concertFetchCount}回`);
for (const status of sourceStatus) console.log(`${status.name}: ${status.status} (${status.count}件) ${status.message}`);

async function readPrevious() {
  try { return JSON.parse(await readFile(outputPath, "utf8")); } catch { return { concerts: [] }; }
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : "取得に失敗しました";
  return message.replace(/https?:\/\/[^\s]+/g, "URL").slice(0, 160);
}
