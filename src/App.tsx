import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, CalendarRange, ChevronLeft, ChevronRight, Database, RefreshCw, Search, SlidersHorizontal, Sparkles, Star } from "lucide-react";
import { ConcertCard } from "./components/ConcertCard";
import { Button } from "./components/ui/Button";
import { formatMonth, monthKey } from "./lib";
import type { Concert, ConcertData } from "./types";

const EMPTY: ConcertData = { schemaVersion: 1, generatedAt: null, concerts: [], sourceStatus: [] };
const currentMonth = new Date().toLocaleDateString("sv-SE", { year: "numeric", month: "2-digit", timeZone: "Asia/Tokyo" });
const FAVORITES_KEY = "concert-watch:favorites:v1";
const NOTIFIED_KEY = "concert-watch:notified:v1";

function shiftMonth(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function App() {
  const [data, setData] = useState<ConcertData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [month, setMonth] = useState(currentMonth);
  const [query, setQuery] = useState("");
  const [prefecture, setPrefecture] = useState("kanto3");
  const [source, setSource] = useState("all");
  const [newOnly, setNewOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]"); } catch { return []; }
  });
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() => "Notification" in window ? Notification.permission : "unsupported");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/concerts.json`, { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error("data unavailable");
        return response.json();
      })
      .then((value: ConcertData) => {
        setData(value);
        notifyFavoriteConcerts(value, favorites);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []); // お気に入りは初回表示時点の端末設定を使用する

  function toggleFavorite(artistName: string) {
    setFavorites((current) => {
      const next = current.includes(artistName) ? current.filter((item) => item !== artistName) : [...current, artistName];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") notifyFavoriteConcerts(data, favorites);
  }

  const prefectures = useMemo(() => [...new Set(data.concerts.map((concert) => concert.prefecture))].sort(), [data]);
  const sources = useMemo(() => [...new Map(data.concerts.flatMap((concert) => concert.sources).map((item) => [item.key, item])).values()], [data]);
  const filtered = useMemo(() => data.concerts
    .filter((concert) => newOnly || monthKey(concert.performanceDate) === month)
    .filter((concert) => !newOnly || isNewConcert(concert))
    .filter((concert) => prefecture === "all" || (prefecture === "kanto3" ? ["東京都", "千葉県", "神奈川県"].includes(concert.prefecture) : concert.prefecture === prefecture))
    .filter((concert) => source === "all" || concert.sources.some((item) => item.key === source))
    .filter((concert) => !favoritesOnly || favorites.includes(concert.artistName))
    .filter((concert) => `${concert.artistName} ${concert.title ?? ""} ${concert.venueName}`.toLocaleLowerCase("ja").includes(query.trim().toLocaleLowerCase("ja")))
    .sort((a, b) => a.performanceDate.localeCompare(b.performanceDate) || (a.startTime ?? "").localeCompare(b.startTime ?? "")), [data, month, prefecture, query, source, favoritesOnly, favorites, newOnly]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="grid size-10 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/20"><CalendarRange className="size-5" /></div>
          <div><p className="font-extrabold tracking-tight">来日公演ウォッチ</p><p className="text-xs text-muted">海外アーティストの日本公演情報</p></div>
          <div className="ml-auto hidden items-center gap-2 text-xs text-muted sm:flex"><RefreshCw className="size-3.5" />{data.generatedAt ? `最終更新 ${new Date(data.generatedAt).toLocaleString("ja-JP")}` : "収集前"}</div>
          <Button onClick={enableNotifications} disabled={notificationPermission === "denied" || notificationPermission === "unsupported"} className="ml-auto sm:ml-3" title="お気に入りの新着を、アプリを開いたときに通知"><Bell className="size-4" /><span className="hidden lg:inline">{notificationPermission === "granted" ? "通知オン" : notificationPermission === "denied" ? "通知拒否済み" : "通知を有効化"}</span></Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="rounded-3xl bg-ink px-5 py-7 text-white shadow-xl shadow-ink/10 sm:px-8 sm:py-9">
          <p className="text-sm font-semibold text-white/60">CONCERT CALENDAR</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <Button aria-label="前月" disabled={newOnly} onClick={() => setMonth(shiftMonth(month, -1))} className="border-white/15 bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="size-5" /></Button>
            <h1 className="text-center text-3xl font-black tracking-tight sm:text-4xl">{newOnly ? "新着公演" : formatMonth(month)}</h1>
            <Button aria-label="翌月" disabled={newOnly} onClick={() => setMonth(shiftMonth(month, 1))} className="border-white/15 bg-white/10 text-white hover:bg-white/20"><ChevronRight className="size-5" /></Button>
          </div>
          <p className="mt-3 text-center text-sm text-white/60">{filtered.length}件の公演</p>
        </section>

        <section aria-label="絞り込み" className="relative z-10 -mt-1 grid gap-3 rounded-2xl border border-line bg-white p-4 shadow-lg shadow-ink/5 sm:-mt-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[minmax(14rem,1fr)_auto_auto_auto_auto]">
          <label className="relative"><span className="sr-only">アーティストや会場を検索</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="アーティスト・会場を検索" className="h-11 w-full rounded-xl border border-line bg-canvas pl-10 pr-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" /></label>
          <label className="relative"><SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><span className="sr-only">地域</span><select value={prefecture} onChange={(event) => setPrefecture(event.target.value)} className="h-11 min-w-36 appearance-none rounded-xl border border-line bg-white pl-10 pr-8 outline-none focus:border-brand"><option value="kanto3">関東3県（東京・千葉・神奈川）</option><option value="all">全国</option>{prefectures.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span className="sr-only">情報元</span><select value={source} onChange={(event) => setSource(event.target.value)} className="h-11 w-full min-w-40 rounded-xl border border-line bg-white px-3 outline-none focus:border-brand"><option value="all">すべての情報元</option>{sources.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
          <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${favoritesOnly ? "border-amber-300 bg-amber-50 text-amber-700" : "border-line bg-white text-muted"}`}><Star className={`size-4 ${favoritesOnly ? "fill-current" : ""}`} />お気に入りのみ</button>
          <button type="button" aria-pressed={newOnly} onClick={() => setNewOnly((value) => !value)} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${newOnly ? "border-orange-300 bg-orange-50 text-orange-700" : "border-line bg-white text-muted"}`}><Sparkles className="size-4" />全期間のNEW</button>
        </section>

        <section className="mt-7 grid gap-4">
          {loading && <Message icon={<RefreshCw className="size-6 animate-spin" />} title="公演情報を読み込んでいます" />}
          {loadError && <Message icon={<AlertCircle className="size-6" />} title="公演情報を読み込めませんでした" detail="しばらくしてから再読み込みしてください。" />}
          {!loading && !loadError && filtered.map((concert) => <ConcertCard concert={concert} favorite={favorites.includes(concert.artistName)} onToggleFavorite={() => toggleFavorite(concert.artistName)} key={concert.id} />)}
          {!loading && !loadError && filtered.length === 0 && <Message icon={<Database className="size-7" />} title={data.generatedAt ? "条件に一致する公演はありません" : "まだ公演情報が収集されていません"} detail={data.generatedAt ? "月や検索条件を変更してお試しください。" : "npm run collect または定期ワークフローの実行後に表示されます。"} />}
        </section>

        {!!data.sourceStatus.length && <details className="mt-8 rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer font-bold">取得状況</summary><div className="mt-4 grid gap-3 text-sm">{data.sourceStatus.map((item) => <div key={item.key} className="flex flex-col justify-between gap-1 border-t border-line pt-3 sm:flex-row"><span className="font-semibold">{item.name} <span className="font-normal text-muted">{item.count}件</span></span><span className={item.status === "ok" ? "text-brand" : "text-amber-700"}>{item.message ?? item.status}</span></div>)}</div></details>}
      </main>
      <footer className="border-t border-line px-4 py-8 text-center text-xs text-muted">情報は各公演主催者の公式ページで必ずご確認ください。</footer>
    </div>
  );
}

function Message({ icon, title, detail }: { icon: React.ReactNode; title: string; detail?: string }) {
  return <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-line bg-white p-8 text-center"><div><div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-brand-soft text-brand">{icon}</div><p className="font-bold">{title}</p>{detail && <p className="mt-2 text-sm text-muted">{detail}</p>}</div></div>;
}

function notifyFavoriteConcerts(data: ConcertData, favorites: string[]) {
  if (!("Notification" in window) || Notification.permission !== "granted" || favorites.length === 0) return;
  let notified: string[] = [];
  try { notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "[]"); } catch { notified = []; }
  const now = Date.now();
  const fresh = data.concerts.filter((concert) => favorites.includes(concert.artistName) && now - new Date(concert.firstDetectedAt).getTime() <= 40 * 86400000 && !notified.includes(concert.id));
  fresh.slice(0, 3).forEach((concert) => new Notification(`${concert.artistName}の来日公演`, { body: `${concert.performanceDate} ${concert.venueName}` }));
  if (fresh.length) localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...new Set([...notified, ...fresh.map((concert) => concert.id)])].slice(-200)));
}

function isNewConcert(concert: Concert) {
  const age = Date.now() - new Date(concert.firstDetectedAt).getTime();
  return age >= 0 && age <= 40 * 86400000;
}
