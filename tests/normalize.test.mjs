import test from "node:test";
import assert from "node:assert/strict";
import { dedupeConcerts, normalizeArtist, normalizeText, normalizeVenue } from "../scripts/normalize.mjs";

const base = {
  artistName: "The Example", performanceDate: "2026-10-15", venueName: "日本武道館", prefecture: "東京都", status: "scheduled",
  firstDetectedAt: "2026-08-01T00:00:00.000Z", lastSeenAt: "2026-08-01T00:00:00.000Z",
  sources: [{ key: "a", name: "A", url: "https://example.com/a", detectedAt: "2026-08-01T00:00:00.000Z" }],
};

test("表記をNFKCで正規化する", () => {
  assert.equal(normalizeText("ＴＨＥ Example・Live"), "theexamplelive");
  assert.equal(normalizeVenue("Nippon Budokan"), "日本武道館");
  assert.equal(normalizeVenue("MUFGスタジアム（国立競技場）"), normalizeVenue("国立競技場"));
});

test("日英併記のアーティスト名を同じキーに正規化する", () => {
  assert.equal(normalizeArtist("ジャーニー／Journey"), normalizeArtist("JOURNEY"));
  assert.equal(normalizeArtist("エピカ／Epica"), normalizeArtist("EPICA"));
  assert.equal(normalizeArtist("チェット・フェイカー／Chet Faker"), normalizeArtist("CHET FAKER"));
  assert.equal(normalizeArtist("Stay Kids"), normalizeArtist("Stray Kids"));
});

test("同一公演の出典を統合する", () => {
  const second = { ...base, artistName: "THE EXAMPLE", venueName: "Nippon Budokan", sources: [{ key: "b", name: "B", url: "https://example.com/b", detectedAt: "2026-08-02T00:00:00.000Z" }] };
  const result = dedupeConcerts([base, second]);
  assert.equal(result.length, 1);
  assert.equal(result[0].sources.length, 2);
});

test("日英表記が異なる同一公演を統合する", () => {
  const english = { ...base, artistName: "JOURNEY" };
  const bilingual = { ...base, artistName: "ジャーニー／Journey", sources: [{ key: "b", name: "B", url: "https://example.com/b", detectedAt: "2026-08-02T00:00:00.000Z" }] };
  const result = dedupeConcerts([english, bilingual]);
  assert.equal(result.length, 1);
  assert.equal(result[0].sources.length, 2);
});

test("過去の初回検出日を維持する", () => {
  const previous = [{ ...base, id: "kept-id", firstDetectedAt: "2026-07-01T00:00:00.000Z" }];
  const [result] = dedupeConcerts([{ ...base, firstDetectedAt: "2026-08-10T00:00:00.000Z" }], previous);
  assert.equal(result.id, "kept-id");
  assert.equal(result.firstDetectedAt, "2026-07-01T00:00:00.000Z");
});
