import { contactsForReview, pendingReviewItems } from "@/lib/review";
import { sendPendingToTrades } from "@/lib/send-batch";
import { useSiteWalk } from "@/lib/store";
import { TRADES } from "@/lib/types";
import { useState } from "react";
import { Badge, Button, Card, Empty, Field, Select, Textarea } from "./ui";

export function ReviewView() {
  const punch = useSiteWalk((s) => s.punch);
  const rfis = useSiteWalk((s) => s.rfis);
  const changes = useSiteWalk((s) => s.changes);
  const trades = useSiteWalk((s) => s.trades);
  const updateBody = useSiteWalk((s) => s.updatePendingBody);
  const setPunchTrade = useSiteWalk((s) => s.setPunchTrade);
  const setRfiTrade = useSiteWalk((s) => s.setRfiTrade);
  const setChangeTrade = useSiteWalk((s) => s.setChangeTrade);
  const discard = useSiteWalk((s) => s.discardPending);
  const items = pendingReviewItems({ punch, rfis, changes });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div>
      <h2 className="mb-1 text-lg font-medium tracking-tight text-ink">Review before send</h2>
      <p className="mb-3 text-sm text-muted">
        Items are already on the punch/RFI/change lists. Fix the wording or trade, discard junk, then
        send. Nothing texts a sub until you tap Send to trades.
      </p>
      {items.length > 0 ? (
        <Button
          className="mb-4 w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await sendPendingToTrades();
            setBusy(false);
            setNote(
              res.device
                ? `Routed ${res.count}. This phone will open a text for the first contact — tap Text on any that remain.`
                : `Sent ${res.count} to trades.`,
            );
          }}
        >
          {busy ? "Sending…" : `Send to trades · ${items.length} pending`}
        </Button>
      ) : null}
      {note ? <p className="mb-3 text-sm text-muted">{note}</p> : null}
      {items.length === 0 ? <Empty>Nothing waiting to send.</Empty> : null}
      <div className="space-y-3">
        {items.map((it) => {
          const contacts = contactsForReview(trades, it.trade);
          return (
            <Card key={`${it.kind}-${it.id}`} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{it.module}</strong>
                <Badge tone="warn">Pending review</Badge>
              </div>
              <Field label="What it says">
                <Textarea value={it.body} onChange={(e) => updateBody(it.kind, it.id, e.target.value)} />
              </Field>
              <Field label="Trade">
                <Select
                  value={it.trade}
                  onChange={(e) => {
                    const trade = e.target.value;
                    if (it.kind === "punch") setPunchTrade(it.id, trade);
                    else if (it.kind === "rfi") setRfiTrade(it.id, trade);
                    else setChangeTrade(it.id, trade);
                  }}
                >
                  {TRADES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <p className="text-xs text-muted">
                {contacts.length
                  ? contacts
                      .map((c) => `${c.company} · ${c.contact || "contact"} · ${c.phone || c.email || "no number"}`)
                      .join(" · ")
                  : "No contact on file — will flag Unrouted if you send."}
              </p>
              {it.photo ? (
                <img src={it.photo} alt="" className="h-20 w-20 rounded-sm object-cover" />
              ) : null}
              <Button variant="ghost" className="text-danger" onClick={() => discard(it.kind, it.id)}>
                Discard
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
