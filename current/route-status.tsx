import { sendTradeNotice } from "@/lib/notify";
import { openDeviceSend } from "@/lib/routing";
import { useSiteWalk } from "@/lib/store";
import { TRADES, type NoticeStatus, type RoutableKind, type TradeNotice } from "@/lib/types";
import { Badge, Button, Card, Select } from "./ui";

export function RouteBadge({ status }: { status?: NoticeStatus | null }) {
  if (!status) return null;
  if (status === "pending") return <Badge tone="warn">Pending review</Badge>;
  if (status === "unrouted") return <Badge tone="warn">Unrouted</Badge>;
  if (status === "sent" || status === "delivered") return <Badge tone="ok">Sent</Badge>;
  if (status === "failed") return <Badge tone="danger">Failed</Badge>;
  if (status === "queued") return <Badge tone="neutral">Ready to send</Badge>;
  return null;
}

export function RouteBanner() {
  const last = useSiteWalk((s) => s.lastRoute);
  const clear = useSiteWalk((s) => s.clearLastRoute);
  const setView = useSiteWalk((s) => s.setView);
  if (!last) return null;
  if (last.unrouted) {
    return (
      <Card className="mb-3 border-warn bg-warn-bg">
        <p className="text-sm text-warn">
          No contact on file for this trade. Item is flagged unrouted.
        </p>
        <div className="mt-2 flex gap-2">
          <Button variant="secondary" className="min-h-9" onClick={() => setView("trades")}>
            Add trade contact
          </Button>
          <Button variant="ghost" className="min-h-9" onClick={() => clear()}>
            Dismiss
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card className="mb-3">
      <p className="text-sm">
        Queued to {last.notices.filter((n) => n.status === "queued").map((n) => n.company).join(", ") || "trade"}.
      </p>
      <NoticeActions notices={last.notices.filter((n) => n.status === "queued")} />
      <Button variant="ghost" className="mt-2 min-h-9" onClick={() => clear()}>
        Dismiss
      </Button>
    </Card>
  );
}

export function ItemRoute({
  itemId,
  trade,
  onTrade,
}: {
  itemId: string;
  kind: RoutableKind;
  trade: string;
  status?: NoticeStatus | null;
  onTrade: (trade: string) => void;
}) {
  const notices = useSiteWalk((s) => s.notifications ?? []).filter((n) => n.itemId === itemId);
  return (
    <div className="mt-2 space-y-2">
      <Select value={trade} onChange={(e) => onTrade(e.target.value)} aria-label="Reassign trade">
        {TRADES.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </Select>
      <NoticeActions notices={notices.filter((n) => n.status === "queued" || n.status === "failed")} />
    </div>
  );
}

function NoticeActions({ notices }: { notices: TradeNotice[] }) {
  const mark = useSiteWalk((s) => s.markNotice);
  if (notices.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {notices.map((n) => (
        <Button
          key={n.id}
          variant="secondary"
          className="min-h-9"
          onClick={async () => {
            const res = await sendTradeNotice({
              data: {
                channel: n.channel,
                to: n.to,
                body: n.body,
                subject: `SiteWalk ${n.tradeName}`,
              },
            });
            if (res.ok) {
              mark(n.id, "sent");
              return;
            }
            if (res.mode === "device") {
              openDeviceSend(n);
              mark(n.id, "sent");
              return;
            }
            mark(n.id, "failed", res.error);
          }}
        >
          {n.channel === "sms" ? "Text" : "Email"} {n.company || n.to}
        </Button>
      ))}
    </div>
  );
}
