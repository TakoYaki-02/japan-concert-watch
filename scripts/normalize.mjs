import { createHash } from "node:crypto";

const VENUE_ALIASES = new Map([
  ["日本武道館", "日本武道館"], ["nipponbudokan", "日本武道館"],
  ["東京ドーム", "東京ドーム"], ["tokyodome", "東京ドーム"],
  ["kアリーナ横浜", "Kアリーナ横浜"], ["karena横浜", "Kアリーナ横浜"],
  ["さいたまスーパーアリーナ", "さいたまスーパーアリーナ"], ["saitamasuperarena", "さいたまスーパーアリーナ"],
]);

export function normalizeText(value = "") {
  return value.normalize("NFKC").toLocaleLowerCase("ja").replace(/[\s・･\-—–_.,'’"“”()（）\[\]【】/／]/g, "");
}

export function normalizeVenue(value = "") {
  const normalized = normalizeText(value).replace(/ホール$/, "");
  return VENUE_ALIASES.get(normalized) ?? normalized;
}

export function dedupeConcerts(records, previous = []) {
  const previousByKey = new Map(previous.map((item) => [identityKey(item), item]));
  const merged = new Map();
  for (const record of records) {
    const key = identityKey(record);
    const current = merged.get(key);
    if (current) {
      current.sources = uniqueSources([...current.sources, ...record.sources]);
      current.generalSaleAt ||= record.generalSaleAt;
      current.presaleInfo = uniquePresales([...(current.presaleInfo ?? []), ...(record.presaleInfo ?? [])]);
      current.lastSeenAt = later(current.lastSeenAt, record.lastSeenAt);
    } else {
      const old = previousByKey.get(key);
      merged.set(key, {
        ...record,
        id: old?.id ?? createHash("sha256").update(key).digest("hex").slice(0, 20),
        firstDetectedAt: old?.firstDetectedAt ?? record.firstDetectedAt,
        generalSaleAt: record.generalSaleAt ?? old?.generalSaleAt ?? null,
        sources: uniqueSources(record.sources),
      });
    }
  }
  return [...merged.values()].sort((a, b) => a.performanceDate.localeCompare(b.performanceDate));
}

export function identityKey(record) {
  const timeDiscriminator = record.startTime && record.title ? `|${record.startTime}|${normalizeText(record.title)}` : "";
  return `${normalizeText(record.artistName)}|${record.performanceDate}|${normalizeVenue(record.venueName)}${timeDiscriminator}`;
}

function uniqueSources(items) { return [...new Map(items.map((item) => [`${item.key}|${item.url}`, item])).values()]; }
function uniquePresales(items) { return [...new Map(items.map((item) => [`${item.label}|${item.period ?? ""}`, item])).values()]; }
function later(a, b) { return a > b ? a : b; }
