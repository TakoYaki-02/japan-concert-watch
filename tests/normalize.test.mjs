import test from "node:test";
import assert from "node:assert/strict";
import { dedupeConcerts, normalizeText, normalizeVenue } from "../scripts/normalize.mjs";

const base = {
  artistName: "The Example", performanceDate: "2026-10-15", venueName: "日本武道館", prefecture: "東京都", status: "scheduled",
  firstDetectedAt: "2026-08-01T00:00:00.000Z", lastSeenAt: "2026-08-01T00:00:00.000Z",
  sources: [{ key: "a", name: "A", url: "https://example.com/a", detectedAt: "2026-08-01T00:00:00.000Z" }],
};

test("表記をNFKCで正規化する", () => {
  assert.equal(normalizeText("ＴＨＥ Example・Live"), "theexamplelive");
  assert.equal(normalizeVenue("Nippon Budokan"), "日本武道館");
});

test("同一公演の出典を統合する", () => {
  const second = { ...base, artistName: "THE EXAMPLE", venueName: "Nippon Budokan", sources: [{ key: "b", name: "B", url: "https://example.com/b", detectedAt: "2026-08-02T00:00:00.000Z" }] };
  const result = dedupeConcerts([base, second]);
  assert.equal(result.length, 1);
  assert.equal(result[0].sources.length, 2);
});

test("過去の初回検出日を維持する", () => {
  const previous = [{ ...base, id: "kept-id", firstDetectedAt: "2026-07-01T00:00:00.000Z" }];
  const [result] = dedupeConcerts([{ ...base, firstDetectedAt: "2026-08-10T00:00:00.000Z" }], previous);
  assert.equal(result.id, "kept-id");
  assert.equal(result.firstDetectedAt, "2026-07-01T00:00:00.000Z");
});
