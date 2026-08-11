import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRobots } from "../scripts/fetch-safe.mjs";
import { parseConcertPage } from "../scripts/parse.mjs";

const source = { key: "test", name: "テスト公式", allowedHosts: ["example.com"] };

test("MusicEventの構造化データを解析する", () => {
  const html = `<html><body><h1>THE EXAMPLE 来日公演</h1><script type="application/ld+json">{"@context":"https://schema.org","@type":"MusicEvent","name":"THE EXAMPLE JAPAN TOUR","startDate":"2026-10-15T19:00:00+09:00","performer":{"@type":"MusicGroup","name":"THE EXAMPLE"},"location":{"@type":"Place","name":"日本武道館","address":{"addressRegion":"東京都"}},"offers":{"validFrom":"2026-08-29T10:00:00+09:00"}}</script></body></html>`;
  const [concert] = parseConcertPage(html, "https://example.com/show", source, "2026-08-11T00:00:00.000Z", "hash");
  assert.equal(concert.artistName, "THE EXAMPLE");
  assert.equal(concert.performanceDate, "2026-10-15");
  assert.equal(concert.prefecture, "東京都");
  assert.equal(concert.generalSaleAt, "2026-08-29T01:00:00.000Z");
});

test("来日の根拠がないページは除外する", () => {
  const html = `<html><body><h1>国内公演</h1><script type="application/ld+json">{"@type":"MusicEvent","name":"国内公演","startDate":"2026-10-15","performer":{"name":"国内歌手"},"location":{"name":"日本武道館"}}</script></body></html>`;
  assert.deepEqual(parseConcertPage(html, "https://example.com/show", source, "2026-08-11T00:00:00.000Z"), []);
});

test("CreativemanのNEWS発表日を公演日として扱わない", () => {
  const creativeman = { key: "creativeman", name: "Creativeman", allowedHosts: ["example.com"] };
  const html = `<html><head><meta property="og:title" content="ELECTRIC CALLBOY | エレクトリック・コールボーイ 2026 来日公演公式"></head><body>
    <section class="news"><span class="date">2026.7.17 Fri</span><strong>サポート・アクトが決定！</strong></section>
    <div class="info-det ticket-info"><h3>大阪 2026.<span>8.29</span>（土）<br><span>GORILLA HALL OSAKA</span></h3><span class="open-start">OPEN 17:00 / START 18:00</span><p class="info-sale-date">一般発売日：12/13(土)〜</p></div>
    <div class="info-det ticket-info"><h3>東京 2026.<span>8.31</span>（月）<br><span>東京ガーデンシアター</span></h3><span class="open-start">OPEN 18:00 / START 19:00</span></div>
  </body></html>`;
  const result = parseConcertPage(html, "https://example.com/artist/2026/08ecb/", creativeman, "2026-08-11T00:00:00.000Z", "hash");
  assert.deepEqual(result.map((item) => item.performanceDate), ["2026-08-29", "2026-08-31"]);
  assert.deepEqual(result.map((item) => item.venueName), ["GORILLA HALL OSAKA", "東京ガーデンシアター"]);
  assert.equal(result[0].generalSaleAt, "2025-12-12T15:00:00.000Z");
});

test("汎用解析でも離れた発表日ではなく会場に近い公演日を使う", () => {
  const html = `<html><body><h1>THE EXAMPLE 来日公演</h1><p>発表日 2026年7月17日</p><p>最新ニュースを発表しました。</p><hr><section><p>公演日 2026年8月29日</p><p>会場：日本武道館</p><p>開演 19:00</p></section></body></html>`;
  const [concert] = parseConcertPage(html, "https://example.com/show", source, "2026-08-11T00:00:00.000Z", "hash");
  assert.equal(concert.performanceDate, "2026-08-29");
  assert.equal(concert.venueName, "日本武道館");
  assert.equal(concert.startTime, "19:00");
});

test("K-POP一覧の構造化イベントをアーティスト指定なしで解析する", () => {
  const kpop = { key: "kpop-concert-nav", name: "K-POPコンサートナビ", allowedHosts: ["example.com"] };
  const event = { id: "event-1", title: "Stray Kids World Tour ＜RUN IT JAPAN＞", eventDate: "$D2026-08-29T08:30:00.000Z", venueName: "MUFGスタジアム（国立競技場）", prefecture: "東京都", ticketSaleStart: null, status: "upcoming", sourceUrl: "https://www.straykidsjapan.com/runitjapan/", isVisible: true, artist: { id: "artist-1", name: "Stray Kids" } };
  const payload = `0:${JSON.stringify(event)}`;
  const html = `<script>${`self.__next_f.push(${JSON.stringify([1, payload])})`}</script>`;
  const [concert] = parseConcertPage(html, "https://example.com/events", kpop, "2026-08-11T00:00:00.000Z", "hash");
  assert.equal(concert.artistName, "Stray Kids");
  assert.equal(concert.performanceDate, "2026-08-29");
  assert.equal(concert.startTime, "17:30");
  assert.equal(concert.venueName, "MUFGスタジアム（国立競技場）");
});

test("K-POP年間一覧を解析する", () => {
  const kpop = { key: "kpop-music-now", name: "K-POP MUSIC NOW LIVE", allowedHosts: ["example.com"] };
  const html = `<a href="/event/124/"><h3>TREASURE TOUR [PULSE ON] IN JAPAN @Kアリーナ横浜</h3><p>2026/09/12（土） 開場 17:00 / 開演 18:30</p></a>`;
  const [concert] = parseConcertPage(html, "https://example.com/event/year/2026/", kpop, "2026-08-11T00:00:00.000Z", "hash");
  assert.equal(concert.artistName, "TREASURE");
  assert.equal(concert.performanceDate, "2026-09-12");
  assert.equal(concert.venueName, "Kアリーナ横浜");
});

test("robots.txtの最長一致を尊重する", () => {
  const robots = "User-agent: *\nDisallow: /private\nAllow: /private/public\n";
  assert.equal(evaluateRobots(robots, "/shows"), true);
  assert.equal(evaluateRobots(robots, "/private/data"), false);
  assert.equal(evaluateRobots(robots, "/private/public/show"), true);
});
