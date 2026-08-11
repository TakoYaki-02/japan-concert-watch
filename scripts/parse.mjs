import * as cheerio from "cheerio";

const PREFECTURES = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"];
const CITY_HINTS = new Map([["東京", "東京都"], ["横浜", "神奈川県"], ["大阪", "大阪府"], ["名古屋", "愛知県"], ["札幌", "北海道"], ["福岡", "福岡県"], ["神戸", "兵庫県"], ["京都", "京都府"], ["広島", "広島県"], ["仙台", "宮城県"], ["千葉", "千葉県"], ["埼玉", "埼玉県"]]);

export function discoverLinks(html, baseUrl, source, limit = 12) {
  const $ = cheerio.load(html);
  const urls = [];
  $("a[href]").each((_, element) => {
    try {
      const url = new URL($(element).attr("href"), baseUrl);
      url.hash = "";
      if (source.allowedHosts.includes(url.hostname.toLowerCase()) && source.detailPath.test(url.pathname) && !urls.includes(url.toString())) urls.push(url.toString());
    } catch { /* 不正URLは無視 */ }
  });
  return urls.slice(0, limit);
}

export function parseConcertPage(html, pageUrl, source, fetchedAt, contentHash = "") {
  const $ = cheerio.load(html);
  if (source.key === "smash") return fromSmash($, pageUrl, source, fetchedAt, contentHash);
  if (source.key === "udo") return fromUdo($, pageUrl, source, fetchedAt, contentHash);
  if (source.key === "creativeman") return fromCreativeman($, pageUrl, source, fetchedAt, contentHash);
  if (source.key === "udiscovermusic") return fromUdiscover($, pageUrl, source, fetchedAt, contentHash);
  if (source.key === "kpop-concert-nav") return fromKpopConcertNav($, pageUrl, source, fetchedAt, contentHash);
  if (source.key === "kpop-music-now") return fromKpopMusicNow($, pageUrl, source, fetchedAt, contentHash);
  const pageText = $("body").text();
  if (!/(来日|初来日|JAPAN\s*(?:TOUR|LIVE|SHOW)|IN\s+JAPAN)/i.test(pageText)) return [];
  const events = extractJsonLd($).flatMap(flattenEvents);
  const parsed = events.map((event) => fromJsonLd(event, pageUrl, source, fetchedAt, contentHash)).filter(Boolean);
  if (parsed.length) return parsed;
  const fallback = fromVisibleText($, pageUrl, source, fetchedAt, contentHash);
  return fallback ? [fallback] : [];
}

function fromCreativeman($, pageUrl, source, fetchedAt, contentHash) {
  const metaTitle = clean($('meta[property="og:title"]').attr("content") || $("title").text());
  const artistName = clean(metaTitle.split(/[|｜]/)[0].replace(/\s+20\d{2}.*$/, ""));
  if (!artistName) return [];
  const items = [];
  $(".ticket-info").each((_, section) => {
    const heading = clean($(section).find("h3").first().text());
    const dateMatch = heading.match(/(20\d{2})\.(\d{1,2})\.(\d{1,2})/);
    const venueName = clean($(section).find("h3 > span").last().text());
    if (!dateMatch || !venueName) return;
    const sectionText = clean($(section).text());
    const startTime = sectionText.match(/START\s*(\d{1,2}:\d{2})/i)?.[1] ?? null;
    const saleMatch = sectionText.match(/一般発売日\s*[:：]?\s*(\d{1,2})\/(\d{1,2})/);
    const performanceYear = Number(dateMatch[1]);
    const performanceMonth = Number(dateMatch[2]);
    const saleYear = saleMatch && Number(saleMatch[1]) > performanceMonth ? performanceYear - 1 : performanceYear;
    const generalSaleAt = saleMatch ? parseJapaneseDateTime(`${saleMatch[1]}/${saleMatch[2]}`, String(saleYear)) : null;
    const presaleInfo = $(section).find(".early-ticket h4").map((__, item) => ({ label: clean($(item).text()) })).get().filter((item) => item.label).slice(0, 5);
    items.push(record({ artistName, title: metaTitle, performanceDate: `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`, startTime, venueName, prefecture: inferPrefecture(heading, venueName), status: /(?:公演)?中止/.test(sectionText) ? "cancelled" : /延期/.test(sectionText) ? "postponed" : "scheduled", generalSaleAt, presaleInfo, pageUrl, source, fetchedAt, contentHash }));
  });
  return items;
}

function fromKpopConcertNav($, pageUrl, source, fetchedAt, contentHash) {
  const payload = $("script").map((_, element) => {
    const script = $(element).html() ?? "";
    const match = script.match(/^self\.__next_f\.push\((\[.*\])\)$/s);
    if (!match) return "";
    try { const value = JSON.parse(match[1]); return typeof value[1] === "string" ? value[1] : ""; } catch { return ""; }
  }).get().join("\n");
  const items = [];
  for (const event of extractEventObjects(payload)) {
    const iso = typeof event.eventDate === "string" ? event.eventDate.replace(/^\$D/, "") : "";
    if (!iso || !event.venueName || !event.artist?.name || event.isVisible === false) continue;
    const performanceDate = dateInJapan(iso);
    if (!performanceDate || performanceDate < dateInJapan(fetchedAt)) continue;
    const sourceUrl = /^https:\/\//.test(event.sourceUrl ?? "") ? event.sourceUrl : pageUrl;
    items.push(record({ artistName: clean(event.artist.name), title: clean(event.title), performanceDate, startTime: timeInJapan(iso), venueName: clean(event.venueName), prefecture: clean(event.prefecture) || inferPrefecture(event.venueName), status: /cancel/i.test(event.status) ? "cancelled" : /postpon/i.test(event.status) ? "postponed" : "scheduled", generalSaleAt: toIso((event.ticketSaleStart ?? "").replace(/^\$D/, "")), presaleInfo: [], pageUrl: sourceUrl, source, fetchedAt, contentHash }));
  }
  return items;
}

function extractEventObjects(payload) {
  const items = [];
  let cursor = 0;
  while ((cursor = payload.indexOf('{"id":', cursor)) >= 0) {
    const end = balancedObjectEnd(payload, cursor);
    if (end < 0) break;
    const candidate = payload.slice(cursor, end);
    if (candidate.includes('"eventDate"') && candidate.includes('"venueName"')) {
      try { items.push(JSON.parse(candidate)); } catch { /* Next.jsのイベント以外は無視 */ }
    }
    cursor = end;
  }
  return items;
}

function balancedObjectEnd(text, start) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return index + 1;
  }
  return -1;
}

function fromKpopMusicNow($, pageUrl, source, fetchedAt, contentHash) {
  const items = [];
  $('a[href^="/event/"]').each((_, element) => {
    const heading = clean($(element).find("h3").text());
    const schedule = clean($(element).find("p").text());
    const separator = heading.lastIndexOf(" @");
    const dateMatch = schedule.match(/(20\d{2})\/(\d{2})\/(\d{2})/);
    if (separator < 1 || !dateMatch) return;
    const performanceDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    if (performanceDate < dateInJapan(fetchedAt)) return;
    const title = heading.slice(0, separator);
    const venueName = heading.slice(separator + 2);
    const startTime = schedule.match(/開演\s*(\d{1,2}:\d{2})/)?.[1] ?? null;
    const detailUrl = new URL($(element).attr("href"), pageUrl).toString();
    items.push(record({ artistName: artistFromKpopTitle(title), title, performanceDate, startTime, venueName, prefecture: inferPrefecture(venueName), status: "scheduled", generalSaleAt: null, presaleInfo: [], pageUrl: detailUrl, source, fetchedAt, contentHash }));
  });
  return items;
}

function artistFromKpopTitle(title) {
  const stripped = title.replace(/^20\d{2}(?:-\d{2})?\s+/, "");
  const marker = stripped.search(/\s+(?:(?:\d+(?:ST|ND|RD|TH)|JAPAN|ASIA|WORLD)\s+)*(?:TOUR|CONCERT|LIVE|FAN[- ]?(?:CON|MEETING)|SHOWCASE)\b/i);
  return clean(marker > 0 ? stripped.slice(0, marker) : stripped);
}

function dateInJapan(value) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function timeInJapan(value) {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tokyo" });
}

function fromUdo($, pageUrl, source, fetchedAt, contentHash) {
  const metaTitle = clean($('meta[property="og:title"]').attr("content"));
  const artistName = clean(metaTitle.replace(/\s+20\d{2}.*$/, "").replace(/｜.*$/, "")) || clean($(".s-showsDetail__title").first().text());
  const title = clean($(".s-showsDetail__titleDescription").first().text());
  const pageText = $(".s-showsDetail__main").text();
  if (!artistName || !/(来日|初来日|JAPAN\s*(?:TOUR|LIVE|SHOW)|IN\s+JAPAN|招聘)/i.test(pageText)) return [];
  const items = [];
  $(".s-showsDetail__scheduleItem").each((_, element) => {
    const dateText = $(element).find(".s-showsDetail__scheduleDate").first().text().replace(/\s+/g, "");
    const dateMatch = dateText.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
    const venueName = clean($(element).find(".s-showsDetail__scheduleVenue").first().text());
    if (!dateMatch || !venueName) return;
    const times = $(element).find(".s-showsDetail__scheduleTime").map((__, time) => $(time).text()).get().join(" ");
    const startTime = times.match(/(\d{1,2}:\d{2})\s*start/i)?.[1] ?? null;
    const regionText = $(element).closest(".s-showsDetail__scheduleContent").prevAll(".s-showsDetail__scheduleTabs").first().text();
    items.push(record({ artistName, title, performanceDate: `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`, startTime, venueName, prefecture: inferPrefecture(venueName, regionText, pageText.slice(0, 500)), status: /中止/.test($(element).text()) ? "cancelled" : /延期/.test($(element).text()) ? "postponed" : "scheduled", generalSaleAt: findUdoGeneralSale($, dateMatch[1]), presaleInfo: extractUdoPresales($), pageUrl, source, fetchedAt, contentHash }));
  });
  return items;
}

function findUdoGeneralSale($, fallbackYear) {
  let result = null;
  $(".s-showsDetail__ticketSection").each((_, section) => {
    if (!/一般(?:発売|販売)/.test($(section).find(".s-showsDetail__ticketSectionTitle").text())) return;
    const text = $(section).text();
    const match = text.match(/((?:20\d{2}年)?\s*\d{1,2}月\s*\d{1,2}日[^\n]{0,20}(?:\d{1,2}:\d{2})?)/);
    if (match) result = parseJapaneseDateTime(match[1], fallbackYear);
  });
  return result;
}

function extractUdoPresales($) {
  return $(".s-showsDetail__ticketSection").filter((_, section) => /先行/.test($(section).find(".s-showsDetail__ticketSectionTitle").text())).find(".s-showsDetail__ticketCardTitle").map((_, item) => ({ label: clean($(item).text()) })).get().slice(0, 5);
}

function fromSmash($, pageUrl, source, fetchedAt, contentHash) {
  const artistName = clean($(".liveTit h3").first().text());
  const description = $(".r_box .read").text();
  if (!artistName || !/(来日|初来日|JAPAN\s*(?:TOUR|LIVE|SHOW)|IN\s+JAPAN)/i.test(description)) return [];
  const items = [];
  $(".sche section").each((_, section) => {
    const strongText = $(section).find("span.tx14 p strong").first().text().replace(/\s+/g, " ").trim();
    const dateMatch = strongText.match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})/);
    if (!dateMatch) return;
    const venueName = clean(strongText.replace(dateMatch[0], "").replace(/\([^)]*\)/g, "").trim());
    if (!venueName || /会場HP|ロケーション/.test(venueName)) return;
    const city = clean($(section).find("h5").first().text());
    const scheduleText = $(section).text();
    const startMatch = scheduleText.match(/START\s*(\d{1,2}:\d{2})/i);
    const saleMatch = description.match(/(?:一般発売|一般販売)(?:日|開始)?\s*[:：]?\s*((?:20\d{2}[年/.\-])?\s*\d{1,2}[月/.\-]\s*\d{1,2}日?(?:[^\n]{0,15}\d{1,2}[:：]\d{2})?)/);
    items.push(record({ artistName, title: clean($(".read p").first().text()), performanceDate: `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`, startTime: startMatch?.[1] ?? null, venueName, prefecture: inferPrefecture(scheduleText, city), status: /中止/.test(description) ? "cancelled" : /延期/.test(description) ? "postponed" : "scheduled", generalSaleAt: saleMatch ? parseJapaneseDateTime(saleMatch[1], dateMatch[1]) : null, presaleInfo: extractPresales(description), pageUrl, source, fetchedAt, contentHash }));
  });
  return items;
}

function fromUdiscover($, pageUrl, source, fetchedAt, contentHash) {
  const defaultYear = clean($("article h2, .entry-content h2, h2").filter((_, element) => /^20\d{2}年?$/.test($(element).text().trim())).first().text()).match(/20\d{2}/)?.[0] ?? String(new Date(fetchedAt).getUTCFullYear());
  const items = [];
  $("p").each((_, paragraph) => {
    const text = $(paragraph).text().replace(/\s+/g, " ").trim();
    if (!text.startsWith("■")) return;
    const firstDate = text.search(/\d{1,2}月\d{1,2}日/);
    if (firstDate < 2) return;
    const artistName = clean(text.slice(1, firstDate).replace(/\s*[＊*].*$/, ""));
    const year = clean($(paragraph).prevAll("h2").filter((_, element) => /^20\d{2}年?$/.test($(element).text().trim())).first().text()).match(/20\d{2}/)?.[0] ?? defaultYear;
    const pattern = /(\d{1,2})月(\d{1,2})日\s*[（(]([^）)]+)[）)]/g;
    for (const match of text.matchAll(pattern)) {
      const location = clean(match[3]);
      const [area, ...venueParts] = location.split(/\s+/);
      const venueName = clean(venueParts.join(" "));
      if (!artistName || !venueName) continue;
      const linked = $(paragraph).find("a[href^='https://']").first().attr("href");
      items.push(record({ artistName, title: artistName, performanceDate: `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`, startTime: null, venueName, prefecture: inferPrefecture(area, location), status: /中止/.test(text) ? "cancelled" : /延期/.test(text) ? "postponed" : "scheduled", generalSaleAt: null, presaleInfo: [], pageUrl: linked || pageUrl, source, fetchedAt, contentHash }));
    }
  });
  return items;
}

function extractJsonLd($) {
  const values = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try { values.push(JSON.parse($(element).text())); } catch { /* 壊れた構造化データは無視 */ }
  });
  return values;
}

function flattenEvents(value) {
  if (Array.isArray(value)) return value.flatMap(flattenEvents);
  if (!value || typeof value !== "object") return [];
  if (value["@graph"]) return flattenEvents(value["@graph"]);
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  return types.some((type) => ["Event", "MusicEvent"].includes(type)) ? [value] : [];
}

function fromJsonLd(event, pageUrl, source, fetchedAt, contentHash) {
  const date = toDate(event.startDate);
  const location = Array.isArray(event.location) ? event.location[0] : event.location;
  const venueName = clean(location?.name);
  const artistName = clean(event.performer?.name ?? event.performer?.[0]?.name ?? event.name);
  if (!date || !venueName || !artistName) return null;
  const address = typeof location?.address === "string" ? location.address : [location?.address?.addressRegion, location?.address?.addressLocality].filter(Boolean).join(" ");
  const offers = Array.isArray(event.offers) ? event.offers : event.offers ? [event.offers] : [];
  return record({ artistName, title: clean(event.name), performanceDate: date, startTime: toTime(event.startDate), venueName, prefecture: inferPrefecture(address, venueName), status: mapStatus(event.eventStatus), generalSaleAt: toIso(offers.find((offer) => offer.validFrom)?.validFrom), presaleInfo: [], pageUrl, source, fetchedAt, contentHash });
}

function fromVisibleText($, pageUrl, source, fetchedAt, contentHash) {
  $("script,style,noscript,svg").remove();
  const blockText = $("body").find("p,li,h1,h2,h3,h4,dt,dd").map((_, element) => clean($(element).text())).get().filter(Boolean).join("\n");
  const text = (blockText || $("body").text()).replace(/[\t\r]+/g, " ").replace(/\n+/g, "\n");
  const title = clean($("h1").first().text() || $("title").text());
  const schedule = findScheduleBlock(text);
  if (!title || !schedule) return null;
  const { dateMatch, venueMatch, context } = schedule;
  const performanceDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
  const generalMatch = text.match(/(?:一般発売|一般販売)(?:日|開始)?\s*[:：]?\s*((?:20\d{2}[年/.\-])?\s*\d{1,2}[月/.\-]\s*\d{1,2}日?(?:[^\n]{0,15}\d{1,2}[:：]\d{2})?)/);
  return record({ artistName: artistFromTitle(title), title, performanceDate, startTime: context.match(/(?:START|開演)\s*[:：]?\s*(\d{1,2}:\d{2})/i)?.[1] ?? null, venueName: clean(venueMatch[1]), prefecture: inferPrefecture(context, venueMatch[1]), status: /中止/.test(context) ? "cancelled" : /延期/.test(context) ? "postponed" : "scheduled", generalSaleAt: generalMatch ? parseJapaneseDateTime(generalMatch[1], dateMatch[1]) : null, presaleInfo: extractPresales(text), pageUrl, source, fetchedAt, contentHash });
}

function findScheduleBlock(text) {
  const lines = text.split("\n").map(clean).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const dateMatch = lines[index].match(/(20\d{2})[年/.\-]\s*(\d{1,2})[月/.\-]\s*(\d{1,2})日?/);
    if (!dateMatch) continue;
    const context = lines.slice(Math.max(0, index - 1), index + 3).join("\n");
    const venueMatch = context.match(/(?:会場|VENUE|Venue)\s*[:：]?\s*([^\n|]{2,60})/);
    if (venueMatch) return { dateMatch, venueMatch, context };
  }
  return null;
}

function record(value) {
  return { artistName: value.artistName, title: value.title || null, performanceDate: value.performanceDate, startTime: value.startTime || null, venueName: value.venueName, prefecture: value.prefecture || "未特定", status: value.status, generalSaleAt: value.generalSaleAt || null, presaleInfo: value.presaleInfo, firstDetectedAt: value.fetchedAt, lastSeenAt: value.fetchedAt, sources: [{ key: value.source.key, name: value.source.name, url: value.pageUrl, detectedAt: value.fetchedAt, contentHash: value.contentHash }] };
}

function extractPresales(text) {
  const matches = [...text.matchAll(/([^\n]{0,20}(?:先行|プレオーダー)[^\n]{0,50})/g)].slice(0, 3);
  return matches.map((match) => ({ label: clean(match[1]) })).filter((item) => item.label);
}

function artistFromTitle(title) { return clean(title.split(/[｜|–—]/)[0].replace(/来日公演.*$/, "")); }
function clean(value) { return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 240) : ""; }
function toDate(value) { const match = typeof value === "string" && value.match(/^(20\d{2})-(\d{2})-(\d{2})/); return match ? `${match[1]}-${match[2]}-${match[3]}` : null; }
function toTime(value) { const match = typeof value === "string" && value.match(/T(\d{2}:\d{2})/); return match?.[1] ?? null; }
function toIso(value) { if (!value || Number.isNaN(Date.parse(value))) return null; return new Date(value).toISOString(); }
function mapStatus(value = "") { return /Cancelled/i.test(value) ? "cancelled" : /Postponed/i.test(value) ? "postponed" : "scheduled"; }
function inferPrefecture(...values) {
  const text = values.join(" ");
  const venueHints = new Map([
    ["有明", "東京都"], ["恵比寿", "東京都"], ["渋谷", "東京都"], ["Shibuya", "東京都"], ["豊洲", "東京都"], ["昭和女子大学", "東京都"], ["日本武道館", "東京都"],
    ["横浜", "神奈川県"], ["梅田", "大阪府"], ["なんば", "大阪府"], ["難波", "大阪府"], ["大阪", "大阪府"], ["COMTEC", "愛知県"], ["名古屋", "愛知県"],
    ["札幌", "北海道"], ["福岡", "福岡県"], ["神戸", "兵庫県"], ["京都", "京都府"], ["広島", "広島県"],
  ]);
  return PREFECTURES.find((item) => text.includes(item))
    ?? PREFECTURES.find((item) => text.includes(item.replace(/[都府県]$/, "")))
    ?? [...venueHints].find(([hint]) => text.includes(hint))?.[1]
    ?? [...CITY_HINTS].find(([city]) => text.includes(city))?.[1]
    ?? "未特定";
}

function parseJapaneseDateTime(value, fallbackYear) {
  const match = value.match(/(?:(20\d{2})年)?\s*(\d{1,2})[月/.\-]\s*(\d{1,2})日?[^\d]*(?:(\d{1,2})[:：](\d{2}))?/);
  if (!match) return null;
  const year = match[1] ?? fallbackYear;
  const iso = `${year}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T${(match[4] ?? "00").padStart(2, "0")}:${match[5] ?? "00"}:00+09:00`;
  return new Date(iso).toISOString();
}
