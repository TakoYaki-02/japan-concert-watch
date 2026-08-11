export type SourceRef = {
  key: string;
  name: string;
  url: string;
  detectedAt: string;
};

export type Concert = {
  id: string;
  artistName: string;
  title?: string | null;
  performanceDate: string;
  startTime?: string | null;
  venueName: string;
  prefecture: string;
  status: "scheduled" | "postponed" | "cancelled";
  generalSaleAt?: string | null;
  presaleInfo?: Array<{ label: string; period?: string; url?: string }>;
  firstDetectedAt: string;
  lastSeenAt: string;
  sources: SourceRef[];
};

export type SourceStatus = {
  key: string;
  name: string;
  status: "ok" | "partial" | "skipped" | "error";
  fetchedAt: string;
  count: number;
  message?: string;
};

export type ConcertData = {
  schemaVersion: number;
  generatedAt: string | null;
  concerts: Concert[];
  sourceStatus: SourceStatus[];
};
