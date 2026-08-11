export const SOURCES = [
  {
    key: "udo",
    name: "UDO音楽事務所",
    entryUrl: "https://www.udo.jp/",
    allowedHosts: ["www.udo.jp", "udo.jp"],
    detailPath: /^\/(shows|concert)\//,
  },
  {
    key: "creativeman",
    name: "Creativeman",
    entryUrl: "https://www.creativeman.co.jp/event/",
    allowedHosts: ["www.creativeman.co.jp", "creativeman.co.jp"],
    detailPath: /^\/artist\//,
  },
  {
    key: "smash",
    name: "SMASH",
    entryUrl: "https://smash-jpn.com/live/",
    allowedHosts: ["smash-jpn.com", "www.smash-jpn.com"],
    detailPath: /^\/live\//,
  },
  {
    key: "livenation",
    name: "Live Nation Japan / H.I.P.",
    entryUrl: "https://www.livenation.co.jp/event/allevents",
    allowedHosts: ["www.livenation.co.jp", "livenation.co.jp", "www.hipjpn.co.jp", "hipjpn.co.jp"],
    detailPath: /^\/(event|artist|live)\//,
  },
  {
    key: "kyodotokyo",
    name: "キョードー東京",
    entryUrl: "https://www.kyodotokyo.com/",
    allowedHosts: ["www.kyodotokyo.com", "kyodotokyo.com", "tickets.kyodotokyo.com"],
    detailPath: /^\/[a-zA-Z0-9_-]+\/?$/,
  },
  {
    key: "billboard-live",
    name: "Billboard Live",
    entryUrl: "https://www.billboard-live.com/tokyo/schedules",
    allowedHosts: ["www.billboard-live.com", "billboard-live.com", "pre.billboard-live.com"],
    detailPath: /^\/(tokyo|yokohama|osaka)\/(show|schedules)/,
  },
  {
    key: "udiscovermusic",
    name: "uDiscoverMusic Japan",
    entryUrl: "https://www.udiscovermusic.jp/news/2022-coming-to-japan-musicians",
    allowedHosts: ["www.udiscovermusic.jp", "udiscovermusic.jp"],
    detailPath: /^\/news\/.*coming-to-japan/,
  },
  {
    key: "club-quattro",
    name: "CLUB QUATTRO",
    entryUrl: "https://www.club-quattro.com/shibuya/schedule/",
    allowedHosts: ["www.club-quattro.com", "club-quattro.com"],
    detailPath: /^\/(shibuya|umeda|nagoya|hiroshima)\/schedule\/detail\//,
  },
];

export function sourceForUrl(url) {
  const host = new URL(url).hostname.toLowerCase();
  return SOURCES.find((source) => source.allowedHosts.includes(host));
}
