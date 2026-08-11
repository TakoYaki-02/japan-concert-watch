import { ExternalLink, MapPin, Star, Ticket } from "lucide-react";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { formatDate, formatDateTime, isNew, safeHttpUrl } from "../lib";
import type { Concert } from "../types";

export function ConcertCard({ concert, favorite, onToggleFavorite }: { concert: Concert; favorite: boolean; onToggleFavorite: () => void }) {
  const status = concert.status === "cancelled" ? "中止" : concert.status === "postponed" ? "延期" : null;
  return (
    <Card className="overflow-hidden p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="hidden min-w-20 rounded-2xl bg-ink px-3 py-3 text-center text-white sm:block">
          <span className="block text-sm font-medium text-white/70">公演日</span>
          <span className="mt-1 block text-lg font-bold">{formatDate(concert.performanceDate)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {isNew(concert) && <Badge tone="new">NEW</Badge>}
            {status && <Badge tone="danger">{status}</Badge>}
            <span className="text-sm font-semibold text-brand sm:hidden">{formatDate(concert.performanceDate)}</span>
          </div>
          <div className="flex items-start gap-3">
            <h2 className="min-w-0 flex-1 text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">{concert.artistName}</h2>
            <button type="button" onClick={onToggleFavorite} aria-label={favorite ? `${concert.artistName}をお気に入りから外す` : `${concert.artistName}をお気に入りに追加`} aria-pressed={favorite} className={`grid size-10 shrink-0 place-items-center rounded-full border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${favorite ? "border-amber-300 bg-amber-50 text-amber-500" : "border-line text-muted hover:border-amber-300 hover:text-amber-500"}`}><Star className={`size-5 ${favorite ? "fill-current" : ""}`} /></button>
          </div>
          {concert.title && <p className="mt-1 text-sm text-muted">{concert.title}</p>}
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <p className="flex items-center gap-2"><MapPin className="size-4 shrink-0 text-brand" aria-hidden />{concert.venueName} <span className="text-muted">({concert.prefecture})</span></p>
            <p className="flex items-center gap-2"><Ticket className="size-4 shrink-0 text-brand" aria-hidden /><span className="text-muted">一般発売</span> {formatDateTime(concert.generalSaleAt)}</p>
          </div>
          {!!concert.presaleInfo?.length && (
            <div className="mt-4 rounded-xl bg-canvas px-3 py-2 text-sm">
              <span className="font-semibold">先行情報：</span> {concert.presaleInfo.map((item) => `${item.label}${item.period ? `（${item.period}）` : ""}`).join(" / ")}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
            <span className="text-xs text-muted">情報元</span>
            {concert.sources.map((source) => {
              const href = safeHttpUrl(source.url);
              return href ? <a key={`${source.key}-${source.url}`} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand">{source.name}<ExternalLink className="size-3.5" aria-hidden /></a> : null;
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
