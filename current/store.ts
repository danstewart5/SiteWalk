import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "./utils";
import { DEFAULT_PIPELINE, DEFAULT_PIPELINE_QUESTIONS } from "./pipeline";
import type { PipelineQuestion, PipelineStage } from "./pipeline";
import { buildRoute } from "./routing";
import type {
  ChangeOrder,
  ClockEvent,
  DailyLog,
  JobSite,
  PunchItem,
  Rfi,
  RoutableKind,
  SafetyEntry,
  Submittal,
  TradeContact,
  TradeNotice,
  View,
  WalkNote,
} from "./types";

type SiteWalkState = {
  view: View;
  setView: (view: View) => void;
  company: string;
  employeeName: string;
  setProfile: (p: { company?: string; employeeName?: string }) => void;
  seeded: boolean;
  seedDemo: () => void;
  rfis: Rfi[];
  addRfi: (r: Omit<Rfi, "id" | "createdAt" | "status" | "answer" | "notifiedAt" | "notificationStatus">) => void;
  answerRfi: (id: string, answer: string) => void;
  setRfiTrade: (id: string, trade: string) => void;
  deleteRfi: (id: string) => void;
  logs: DailyLog[];
  addLog: (l: Omit<DailyLog, "id" | "createdAt">) => void;
  deleteLog: (id: string) => void;
  submittals: Submittal[];
  addSubmittal: (s: Omit<Submittal, "id" | "createdAt" | "status">) => void;
  approveSubmittal: (id: string) => void;
  deleteSubmittal: (id: string) => void;
  safety: SafetyEntry[];
  addSafety: (s: Omit<SafetyEntry, "id" | "createdAt">) => void;
  deleteSafety: (id: string) => void;
  punch: PunchItem[];
  addPunch: (p: Omit<PunchItem, "id" | "createdAt" | "done" | "notifiedAt" | "notificationStatus">) => void;
  togglePunch: (id: string) => void;
  setPunchTrade: (id: string, trade: string) => void;
  deletePunch: (id: string) => void;
  changes: ChangeOrder[];
  addChange: (c: Omit<ChangeOrder, "id" | "createdAt" | "status" | "notifiedAt" | "notificationStatus">) => void;
  setChangeStatus: (id: string, status: ChangeOrder["status"]) => void;
  setChangeTrade: (id: string, trade: string) => void;
  deleteChange: (id: string) => void;
  trades: TradeContact[];
  addTrade: (t: Omit<TradeContact, "id">) => void;
  deleteTrade: (id: string) => void;
  sites: JobSite[];
  addSite: (s: Omit<JobSite, "id" | "active">) => void;
  deleteSite: (id: string) => void;
  clockEvents: ClockEvent[];
  logClock: (e: Omit<ClockEvent, "id">) => void;
  resolveFlag: (id: string, outIso: string) => void;
  walkNotes: WalkNote[];
  addWalkNote: (n: Omit<WalkNote, "id" | "createdAt">) => void;
  updateWalkNote: (id: string, patch: Partial<Pick<WalkNote, "body" | "tag">>) => void;
  deleteWalkNote: (id: string) => void;
  convertWalkNote: (id: string) => void;
  walkActive: boolean;
  walkStartedAt: string | null;
  startWalk: () => void;
  endWalk: () => void;
  pipeline: PipelineStage[];
  pipelineQuestions: PipelineQuestion[];
  updatePipeline: (id: string, patch: Partial<Omit<PipelineStage, "id">>) => void;
  setPipelineConfirmed: (id: string, confirmed: boolean) => void;
  updatePipelineAnswer: (id: string, answer: string) => void;
  resetPipeline: () => void;
  notifications: TradeNotice[];
  lastRoute: { itemId: string; unrouted: boolean; notices: TradeNotice[] } | null;
  routeItem: (kind: RoutableKind, id: string) => void;
  markNotice: (id: string, status: TradeNotice["status"], error?: string) => void;
  clearLastRoute: () => void;
};

export const useSiteWalk = create<SiteWalkState>()(
  persist(
    (set, get) => ({
      view: "home",
      setView: (view) => set({ view }),
      company: "SiteWalk",
      employeeName: "",
      setProfile: (p) => set(p),
      seeded: false,
      seedDemo: () => {
        if (get().seeded) return;
        const now = new Date().toISOString();
        set({
          seeded: true,
          company: get().company || "Ridgeline Builds",
          employeeName: get().employeeName || "Danno",
          rfis: [
            {
              id: uid(),
              question:
                "Confirm beam pocket depth at grid B-4. Existing drawings show 200mm, field measure is 165mm.",
              trade: "Framing",
              recipient: "struct@example.com",
              status: "Open",
              answer: "",
              photo: null,
              createdAt: now,
              notificationStatus: "unrouted",
              notifiedAt: now,
            },
            {
              id: uid(),
              question: "Is the powder-room exhaust to terminate through the north gable or the roof?",
              trade: "HVAC",
              recipient: "",
              status: "Answered",
              answer: "North gable, 150mm from ridge. See SK-12.",
              photo: null,
              createdAt: now,
              answeredAt: now,
            },
          ],
          logs: [
            {
              id: uid(),
              date: now.slice(0, 10),
              weather: "Clear",
              crewCount: "7",
              trades: "Framing, Electrical",
              delays: "Lumber delivery 90 minutes late.",
              notes: "Second-floor walls stood. Rough-in starts tomorrow.",
              createdAt: now,
            },
          ],
          submittals: [
            {
              id: uid(),
              item: "Kitchen cabinet shop drawings — white oak, inset doors",
              trade: "ABC Cabinets",
              recipient: "sales@abccabinets.example",
              dueDate: now.slice(0, 10),
              status: "Pending",
              createdAt: now,
            },
          ],
          safety: [
            {
              id: uid(),
              type: "Near-Miss",
              desc: "Unsecured sheet of OSB slid off second-floor deck during wind gust. No injuries.",
              person: "Framing crew",
              action: "All deck material stacked and strapped. Spotter assigned.",
              photo: null,
              createdAt: now,
            },
          ],
          punch: [
            {
              id: uid(),
              item: "Touch up drywall corner bead, powder room",
              location: "Main floor powder",
              trade: "Finishing",
              photo: null,
              done: false,
              createdAt: now,
              notificationStatus: "unrouted",
              notifiedAt: now,
            },
            {
              id: uid(),
              item: "Missing smoke detector, upstairs hall",
              location: "Level 2 hall",
              trade: "Electrical",
              photo: null,
              done: false,
              createdAt: now,
              notificationStatus: "queued",
              notifiedAt: now,
            },
          ],
          changes: [
            {
              id: uid(),
              description: "Add pot lights in living room (6) per owner walk",
              amount: "2400",
              trade: "Electrical",
              status: "Pending",
              createdAt: now,
              notificationStatus: "queued",
              notifiedAt: now,
            },
          ],
          trades: [
            {
              id: uid(),
              company: "North Slope Plumbing",
              trade: "Plumbing",
              contact: "Mike Chen",
              phone: "403-555-0142",
              email: "mike@northslope.example",
              notes: "On site Tues/Thurs",
              preferredChannel: "sms",
              siteId: "",
            },
            {
              id: uid(),
              company: "Gridline Electric",
              trade: "Electrical",
              contact: "Samira Ali",
              phone: "403-555-0190",
              email: "samira@gridline.example",
              notes: "",
              preferredChannel: "both",
              siteId: "",
            },
          ],
        });
        get().punch.forEach((p) => get().routeItem("punch", p.id));
        get().rfis.forEach((r) => get().routeItem("rfi", r.id));
        get().changes.forEach((c) => get().routeItem("change", c.id));
      },
      rfis: [],
      addRfi: (r) => {
        const id = uid();
        set({
          rfis: [
            ...get().rfis,
            { ...r, id, status: "Open", answer: "", createdAt: new Date().toISOString() },
          ],
        });
        get().routeItem("rfi", id);
      },
      answerRfi: (id, answer) =>
        set({
          rfis: get().rfis.map((r) =>
            r.id === id
              ? { ...r, answer, status: "Answered", answeredAt: new Date().toISOString() }
              : r,
          ),
        }),
      deleteRfi: (id) => set({ rfis: get().rfis.filter((r) => r.id !== id) }),
      setRfiTrade: (id, trade) => {
        const current = get().rfis.find((r) => r.id === id);
        if (!current || current.trade === trade) return;
        set({ rfis: get().rfis.map((r) => (r.id === id ? { ...r, trade } : r)) });
        get().routeItem("rfi", id);
      },
      logs: [],
      addLog: (l) =>
        set({ logs: [...get().logs, { ...l, id: uid(), createdAt: new Date().toISOString() }] }),
      deleteLog: (id) => set({ logs: get().logs.filter((l) => l.id !== id) }),
      submittals: [],
      addSubmittal: (s) =>
        set({
          submittals: [
            ...get().submittals,
            { ...s, id: uid(), status: "Pending", createdAt: new Date().toISOString() },
          ],
        }),
      approveSubmittal: (id) =>
        set({
          submittals: get().submittals.map((s) =>
            s.id === id ? { ...s, status: "Approved", approvedAt: new Date().toISOString() } : s,
          ),
        }),
      deleteSubmittal: (id) => set({ submittals: get().submittals.filter((s) => s.id !== id) }),
      safety: [],
      addSafety: (s) =>
        set({ safety: [...get().safety, { ...s, id: uid(), createdAt: new Date().toISOString() }] }),
      deleteSafety: (id) => set({ safety: get().safety.filter((s) => s.id !== id) }),
      punch: [],
      addPunch: (p) => {
        const id = uid();
        set({
          punch: [...get().punch, { ...p, id, done: false, createdAt: new Date().toISOString() }],
        });
        get().routeItem("punch", id);
      },
      togglePunch: (id) =>
        set({ punch: get().punch.map((p) => (p.id === id ? { ...p, done: !p.done } : p)) }),
      setPunchTrade: (id, trade) => {
        const current = get().punch.find((p) => p.id === id);
        if (!current || current.trade === trade) return;
        set({ punch: get().punch.map((p) => (p.id === id ? { ...p, trade } : p)) });
        get().routeItem("punch", id);
      },
      deletePunch: (id) => set({ punch: get().punch.filter((p) => p.id !== id) }),
      changes: [],
      addChange: (c) => {
        const id = uid();
        set({
          changes: [
            ...get().changes,
            { ...c, id, status: "Pending", createdAt: new Date().toISOString() },
          ],
        });
        get().routeItem("change", id);
      },
      setChangeStatus: (id, status) =>
        set({ changes: get().changes.map((c) => (c.id === id ? { ...c, status } : c)) }),
      setChangeTrade: (id, trade) => {
        const current = get().changes.find((c) => c.id === id);
        if (!current || current.trade === trade) return;
        set({ changes: get().changes.map((c) => (c.id === id ? { ...c, trade } : c)) });
        get().routeItem("change", id);
      },
      deleteChange: (id) => set({ changes: get().changes.filter((c) => c.id !== id) }),
      trades: [],
      addTrade: (t) =>
        set({
          trades: [
            ...get().trades,
            {
              ...t,
              preferredChannel: t.preferredChannel || "sms",
              siteId: t.siteId || "",
              id: uid(),
            },
          ],
        }),
      deleteTrade: (id) => set({ trades: get().trades.filter((t) => t.id !== id) }),
      sites: [],
      addSite: (s) => set({ sites: [...get().sites, { ...s, id: uid(), active: true }] }),
      deleteSite: (id) => set({ sites: get().sites.filter((s) => s.id !== id) }),
      clockEvents: [],
      logClock: (e) => set({ clockEvents: [...get().clockEvents, { ...e, id: uid() }] }),
      resolveFlag: (id, outIso) => {
        const inEvent = get().clockEvents.find((e) => e.id === id);
        if (!inEvent) return;
        set({
          clockEvents: [
            ...get().clockEvents.map((e) => (e.id === id ? { ...e, flagged: false } : e)),
            {
              id: uid(),
              employeeName: inEvent.employeeName,
              siteId: inEvent.siteId,
              siteName: inEvent.siteName,
              type: "out",
              isManual: true,
              flagged: false,
              timestamp: outIso,
            },
          ],
        });
      },
      walkNotes: [],
      walkActive: false,
      walkStartedAt: null,
      startWalk: () =>
        set((s) =>
          s.walkActive
            ? { view: "walk" }
            : { view: "walk", walkActive: true, walkStartedAt: new Date().toISOString() },
        ),
      endWalk: () => set({ walkActive: false }),
      pipeline: DEFAULT_PIPELINE,
      pipelineQuestions: DEFAULT_PIPELINE_QUESTIONS,
      updatePipeline: (id, patch) =>
        set({
          pipeline: get().pipeline.map((row) => (row.id === id ? { ...row, ...patch } : row)),
        }),
      setPipelineConfirmed: (id, confirmed) =>
        set({
          pipeline: get().pipeline.map((row) =>
            row.id === id ? { ...row, draft: !confirmed } : row,
          ),
        }),
      updatePipelineAnswer: (id, answer) =>
        set({
          pipelineQuestions: (get().pipelineQuestions?.length
            ? get().pipelineQuestions
            : DEFAULT_PIPELINE_QUESTIONS
          ).map((q) => (q.id === id ? { ...q, answer } : q)),
        }),
      resetPipeline: () =>
        set({ pipeline: DEFAULT_PIPELINE, pipelineQuestions: DEFAULT_PIPELINE_QUESTIONS }),
      addWalkNote: (n) =>
        set({
          walkNotes: [...get().walkNotes, { ...n, id: uid(), createdAt: new Date().toISOString() }],
        }),
      updateWalkNote: (id, patch) =>
        set({
          walkNotes: get().walkNotes.map((note) => (note.id === id ? { ...note, ...patch } : note)),
        }),
      deleteWalkNote: (id) => set({ walkNotes: get().walkNotes.filter((n) => n.id !== id) }),
      convertWalkNote: (id) => {
        const note = get().walkNotes.find((n) => n.id === id);
        if (!note) return;
        if (note.tag === "Punch") {
          get().addPunch({ item: note.body, location: "Site walk", trade: "General", photo: note.photo });
        } else if (note.tag === "RFI") {
          get().addRfi({
            question: note.body,
            trade: "General",
            recipient: "",
            photo: note.photo,
          });
        } else if (note.tag === "Safety") {
          get().addSafety({
            type: "Hazard Observed",
            desc: note.body,
            person: "",
            action: "",
            photo: note.photo,
          });
        }
        get().deleteWalkNote(id);
      },
      notifications: [],
      lastRoute: null,
      clearLastRoute: () => set({ lastRoute: null }),
      markNotice: (id, status, error) => {
        const notices = get().notifications.map((n) =>
          n.id === id
            ? { ...n, status, error, retryCount: n.retryCount + (status === "failed" ? 1 : 0) }
            : n,
        );
        const hit = notices.find((n) => n.id === id);
        if (!hit) {
          set({ notifications: notices });
          return;
        }
        const siblings = notices.filter((n) => n.itemId === hit.itemId);
        const itemStatus = siblings.some((n) => n.status === "sent" || n.status === "delivered")
          ? "sent"
          : siblings.every((n) => n.status === "failed")
            ? "failed"
            : siblings.some((n) => n.status === "unrouted")
              ? "unrouted"
              : "queued";
        const notifiedAt = new Date().toISOString();
        if (hit.itemType === "punch") {
          set({
            notifications: notices,
            punch: get().punch.map((p) =>
              p.id === hit.itemId ? { ...p, notificationStatus: itemStatus, notifiedAt } : p,
            ),
          });
        } else if (hit.itemType === "rfi") {
          set({
            notifications: notices,
            rfis: get().rfis.map((r) =>
              r.id === hit.itemId ? { ...r, notificationStatus: itemStatus, notifiedAt } : r,
            ),
          });
        } else {
          set({
            notifications: notices,
            changes: get().changes.map((c) =>
              c.id === hit.itemId ? { ...c, notificationStatus: itemStatus, notifiedAt } : c,
            ),
          });
        }
      },
      routeItem: (kind, id) => {
        const s = get();
        let trade = "";
        let description = "";
        let hasPhoto = false;
        if (kind === "punch") {
          const item = s.punch.find((p) => p.id === id);
          if (!item) return;
          trade = item.trade;
          description = item.item;
          hasPhoto = Boolean(item.photo);
        } else if (kind === "rfi") {
          const item = s.rfis.find((r) => r.id === id);
          if (!item) return;
          trade = item.trade;
          description = item.question;
          hasPhoto = Boolean(item.photo);
        } else {
          const item = s.changes.find((c) => c.id === id);
          if (!item) return;
          trade = item.trade;
          description = item.description;
        }
        const site = s.sites.find((x) => x.active)?.name || s.company || "the job";
        const siteId = s.sites.find((x) => x.active)?.id;
        const built = buildRoute({
          kind,
          itemId: id,
          trade,
          description,
          hasPhoto,
          who: s.employeeName || "the super",
          site,
          siteId,
          trades: s.trades,
        });
        const notices: TradeNotice[] = built.notices.map((n) => ({ ...n, id: uid() }));
        const rest = s.notifications.filter((n) => n.itemId !== id);
        const patch = { notificationStatus: built.status, notifiedAt: new Date().toISOString() };
        const lastRoute = { itemId: id, unrouted: built.status === "unrouted", notices };
        if (kind === "punch") {
          set({
            punch: s.punch.map((p) => (p.id === id ? { ...p, ...patch } : p)),
            notifications: [...rest, ...notices],
            lastRoute,
          });
        } else if (kind === "rfi") {
          set({
            rfis: s.rfis.map((r) => (r.id === id ? { ...r, ...patch } : r)),
            notifications: [...rest, ...notices],
            lastRoute,
          });
        } else {
          set({
            changes: s.changes.map((c) => (c.id === id ? { ...c, ...patch } : c)),
            notifications: [...rest, ...notices],
            lastRoute,
          });
        }
      },
    }),
    {
      name: "sitewalk-v1",
      skipHydration: true,
      partialize: (s) => ({
        company: s.company,
        employeeName: s.employeeName,
        seeded: s.seeded,
        rfis: s.rfis,
        logs: s.logs,
        submittals: s.submittals,
        safety: s.safety,
        punch: s.punch,
        changes: s.changes,
        trades: s.trades,
        sites: s.sites,
        clockEvents: s.clockEvents,
        walkNotes: s.walkNotes,
        walkActive: s.walkActive,
        walkStartedAt: s.walkStartedAt,
        pipeline: s.pipeline,
        pipelineQuestions: s.pipelineQuestions,
        notifications: s.notifications,
      }),
    },
  ),
);
