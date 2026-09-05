import { sendTradeNotice } from "@/lib/notify";
import { openDeviceSend } from "@/lib/routing";
import { pendingReviewItems } from "@/lib/review";
import { useSiteWalk } from "@/lib/store";

export async function sendPendingToTrades() {
  const s = useSiteWalk.getState();
  const pending = pendingReviewItems(s);
  for (const item of pending) {
    s.routeItem(item.kind, item.id);
  }
  const queued = useSiteWalk.getState().notifications.filter((n) => n.status === "queued");
  let device = 0;
  for (const n of queued) {
    const res = await sendTradeNotice({
      data: {
        channel: n.channel,
        to: n.to,
        body: n.body,
        subject: `SiteWalk ${n.tradeName}`,
      },
    });
    if (res.ok) {
      useSiteWalk.getState().markNotice(n.id, "sent");
      continue;
    }
    if (res.mode === "device") {
      device += 1;
      if (device === 1) openDeviceSend(n);
      useSiteWalk.getState().markNotice(n.id, "sent");
      continue;
    }
    useSiteWalk.getState().markNotice(n.id, "failed", res.error);
  }
  return { count: pending.length, device };
}
