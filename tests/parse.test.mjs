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

test("robots.txtの最長一致を尊重する", () => {
  const robots = "User-agent: *\nDisallow: /private\nAllow: /private/public\n";
  assert.equal(evaluateRobots(robots, "/shows"), true);
  assert.equal(evaluateRobots(robots, "/private/data"), false);
  assert.equal(evaluateRobots(robots, "/private/public/show"), true);
});
