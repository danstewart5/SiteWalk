import type { ChangeOrder, PunchItem, Rfi, RoutableKind, TradeContact } from "./types";

export type ReviewItem = {
  kind: RoutableKind;
  id: string;
  body: string;
  trade: string;
  module: string;
  photo: string | null;
};

export function pendingReviewItems(input: {
  punch: PunchItem[];
  rfis: Rfi[];
  changes: ChangeOrder[];
}): ReviewItem[] {
  return [
    ...input.punch
      .filter((p) => p.notificationStatus === "pending" && !p.done)
      .map((p) => ({
        kind: "punch" as const,
        id: p.id,
        body: p.item,
        trade: p.trade,
        module: "Punch list",
        photo: p.photo,
      })),
    ...input.rfis
      .filter((r) => r.notificationStatus === "pending" && r.status === "Open")
      .map((r) => ({
        kind: "rfi" as const,
        id: r.id,
        body: r.question,
        trade: r.trade,
        module: "RFI",
        photo: r.photo,
      })),
    ...input.changes
      .filter((c) => c.notificationStatus === "pending" && c.status === "Pending")
      .map((c) => ({
        kind: "change" as const,
        id: c.id,
        body: c.description,
        trade: c.trade,
        module: "Change order",
        photo: null,
      })),
  ];
}

export function contactsForReview(trades: TradeContact[], trade: string) {
  return trades.filter((t) => t.trade === trade);
}
