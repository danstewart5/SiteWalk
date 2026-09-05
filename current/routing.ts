import type { NoticeStatus, PreferredChannel, RoutableKind, TradeContact, TradeNotice } from "./types";

export function contactsForTrade(trades: TradeContact[], trade: string, siteId?: string) {
  return trades.filter((t) => {
    if (t.trade !== trade) return false;
    if (!t.siteId) return true;
    if (!siteId) return true;
    return t.siteId === siteId;
  });
}

export function channelsFor(contact: TradeContact): ("sms" | "email")[] {
  const pref: PreferredChannel = contact.preferredChannel || "sms";
  const want = pref === "both" ? (["sms", "email"] as const) : ([pref] as const);
  return want.filter((ch) => (ch === "sms" ? Boolean(contact.phone?.trim()) : Boolean(contact.email?.trim())));
}

export function composeNotice(input: {
  kind: RoutableKind;
  trade: string;
  site: string;
  description: string;
  who: string;
  when: string;
  hasPhoto: boolean;
}) {
  const label = input.kind === "punch" ? "punch item" : input.kind === "rfi" ? "RFI" : "change order";
  const photo = input.hasPhoto ? " Photo is on file with the super." : "";
  const who = input.who || "the super";
  const desc = input.description.trim().replace(/[.!?]+$/, "");
  return `New ${label} on ${input.site} (${input.trade}). ${desc}.${photo} Logged by ${who} ${input.when}. Reply or call ${who} with questions.`;
}

export function smsHref(to: string, body: string) {
  const num = to.replace(/[^\d+]/g, "");
  return `sms:${num}?body=${encodeURIComponent(body)}`;
}

export function mailHref(to: string, subject: string, body: string) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function openDeviceSend(notice: TradeNotice) {
  if (notice.channel === "sms") {
    window.location.href = smsHref(notice.to, notice.body);
  } else {
    window.location.href = mailHref(notice.to, `SiteWalk ${notice.tradeName}`, notice.body);
  }
}

export function buildRoute(input: {
  kind: RoutableKind;
  itemId: string;
  trade: string;
  description: string;
  hasPhoto: boolean;
  who: string;
  site: string;
  siteId?: string;
  trades: TradeContact[];
}): { status: NoticeStatus; notices: Omit<TradeNotice, "id">[] } {
  const when = new Date().toLocaleString();
  const timestamp = new Date().toISOString();
  const contacts = contactsForTrade(input.trades, input.trade, input.siteId);
  if (contacts.length === 0) {
    return {
      status: "unrouted",
      notices: [
        {
          itemId: input.itemId,
          itemType: input.kind,
          tradeId: "",
          tradeName: input.trade,
          company: "",
          channel: "sms",
          to: "",
          body: `No contact on file for ${input.trade}.`,
          status: "unrouted",
          timestamp,
          retryCount: 0,
        },
      ],
    };
  }
  const notices: Omit<TradeNotice, "id">[] = [];
  for (const contact of contacts) {
    const channels = channelsFor(contact);
    const body = composeNotice({
      kind: input.kind,
      trade: input.trade,
      site: input.site,
      description: input.description,
      who: input.who,
      when,
      hasPhoto: input.hasPhoto,
    });
    for (const channel of channels) {
      notices.push({
        itemId: input.itemId,
        itemType: input.kind,
        tradeId: contact.id,
        tradeName: contact.trade,
        company: contact.company,
        channel,
        to: channel === "sms" ? contact.phone : contact.email,
        body,
        status: "queued",
        timestamp,
        retryCount: 0,
      });
    }
  }
  if (notices.length === 0) {
    return {
      status: "unrouted",
      notices: [
        {
          itemId: input.itemId,
          itemType: input.kind,
          tradeId: "",
          tradeName: input.trade,
          company: "",
          channel: "sms",
          to: "",
          body: `No phone or email on file for ${input.trade}.`,
          status: "unrouted",
          timestamp,
          retryCount: 0,
        },
      ],
    };
  }
  return { status: "queued", notices };
}
