import { draftSiteReport } from "@/lib/ai-report";
import { useSiteWalk } from "@/lib/store";

export function reportSnapshot() {
  const s = useSiteWalk.getState();
  const day = new Date().toISOString().slice(0, 10);
  return {
    company: s.company,
    employee: s.employeeName,
    date: day,
    walkNotes: s.walkNotes,
    rfis: s.rfis,
    logs: s.logs.filter((l) => l.date === day || l.createdAt.startsWith(day)),
    submittals: s.submittals,
    safety: s.safety.filter((x) => x.createdAt.startsWith(day)),
    punch: s.punch,
    changes: s.changes,
    clockEvents: s.clockEvents.slice(-20),
  };
}

export async function generateDailyReport() {
  const store = useSiteWalk.getState();
  const wanted = store.reportWantedAt;
  store.setReportBusy(true);
  try {
    const res = await draftSiteReport({
      data: { snapshot: JSON.stringify(reportSnapshot()) },
    });
    if (!res.ok) {
      useSiteWalk.getState().setReport({
        text: store.dailyReport,
        error: res.error,
        at: wanted,
      });
      return;
    }
    useSiteWalk.getState().setReport({ text: res.text, error: "", at: wanted });
  } catch {
    useSiteWalk.getState().setReport({
      text: store.dailyReport,
      error: "Could not draft the report.",
      at: wanted,
    });
  }
}
