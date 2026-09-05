import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardList,
  Clock3,
  FileText,
  FolderOpen,
  HardHat,
  MapPin,
  NotebookPen,
  Users,
  Wrench,
} from "lucide-react";
import { generateDailyReport } from "@/lib/report";
import { pendingReviewItems } from "@/lib/review";
import { sendPendingToTrades } from "@/lib/send-batch";
import { useSiteWalk } from "@/lib/store";
import { TRADES, type View, type Weather } from "@/lib/types";
import { fmtDuration, formatDate, formatWhen, haversineMeters, todayISO } from "@/lib/utils";
import { DictateButton } from "./dictate";
import { PhotoInput } from "./photo-input";
import { Badge, Button, Card, Empty, Field, Input, Select, Textarea } from "./ui";
import { WalkView } from "./walk-view";
import { ItemRoute, RouteBadge, RouteBanner } from "./route-status";
import { PipelineView } from "./pipeline-view";
import { ReviewView } from "./review-view";

const WEATHER: Weather[] = [
  "Clear",
  "Cloudy",
  "Rain",
  "Snow",
  "High Wind",
  "Extreme Heat/Cold",
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-lg font-medium tracking-tight text-ink">{children}</h2>;
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" className="min-h-9 px-2 text-danger" onClick={onClick}>
      Delete
    </Button>
  );
}

export function AppViews() {
  const view = useSiteWalk((s) => s.view);
  const wanted = useSiteWalk((s) => s.reportWantedAt);
  const reportAt = useSiteWalk((s) => s.reportAt);
  const reportBusy = useSiteWalk((s) => s.reportBusy);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);
  useEffect(() => {
    if (!wanted || reportAt === wanted || reportBusy) return;
    void generateDailyReport();
  }, [wanted, reportAt, reportBusy]);
  switch (view) {
    case "home":
      return <HomeView />;
    case "more":
      return <MoreView />;
    case "walk":
      return <WalkView />;
    case "rfis":
      return <RfiView />;
    case "logs":
      return <LogView />;
    case "submittals":
      return <SubmittalView />;
    case "safety":
      return <SafetyView />;
    case "punch":
      return <PunchView />;
    case "changes":
      return <ChangeView />;
    case "clock":
      return <ClockView />;
    case "trades":
      return <TradeView />;
    case "report":
      return <ReportView />;
    case "pipeline":
      return <PipelineView />;
    case "review":
      return <ReviewView />;
    default:
      return <HomeView />;
  }
}

function HomeView() {
  const s = useSiteWalk();
  const openRfis = s.rfis.filter((r) => r.status === "Open").length;
  const pendingSubs = s.submittals.filter((x) => x.status === "Pending").length;
  const openPunch = s.punch.filter((p) => !p.done).length;
  const openCos = s.changes.filter((c) => c.status === "Pending").length;
  const unrouted =
    s.punch.filter((p) => p.notificationStatus === "unrouted" && !p.done).length +
    s.rfis.filter((r) => r.notificationStatus === "unrouted" && r.status === "Open").length +
    s.changes.filter((c) => c.notificationStatus === "unrouted" && c.status === "Pending").length;
  const pendingSend = pendingReviewItems(s).length;
  const tiles: { view: View; label: string; count: number; icon: typeof FileText }[] = [
    { view: "rfis", label: "Open RFIs", count: openRfis, icon: FileText },
    { view: "punch", label: "Punch items", count: openPunch, icon: Wrench },
    { view: "submittals", label: "Submittals", count: pendingSubs, icon: FolderOpen },
    { view: "changes", label: "Change orders", count: openCos, icon: NotebookPen },
    { view: "safety", label: "Safety logs", count: s.safety.length, icon: AlertTriangle },
    { view: "trades", label: "Unrouted", count: unrouted, icon: Users },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-muted">Open items across the job.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.view}
                type="button"
                onClick={() => s.setView(t.view)}
                className="flex min-h-20 flex-col items-start justify-between rounded-lg border border-line bg-bg p-3 text-left"
              >
                <Icon className="size-4 text-muted" />
                <div>
                  <div className="font-mono text-2xl tabular-nums leading-none">{t.count}</div>
                  <div className="mt-1 text-xs text-muted">{t.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {pendingSend > 0 ? (
        <Card className="space-y-2">
          <p className="text-sm">
            <span className="font-mono tabular-nums">{pendingSend}</span> pending, ready for trades.
          </p>
          <Button
            className="w-full"
            onClick={() => void sendPendingToTrades()}
          >
            {pendingSend} pending, Send to trades
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => s.setView("review")}>
            Review first
          </Button>
        </Card>
      ) : null}

      {s.dailyReport || s.reportBusy || s.reportError ? (
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Latest report</p>
          {s.reportBusy ? <p className="mt-2 text-sm text-muted">Drafting from this walk…</p> : null}
          {s.reportError ? <p className="mt-2 text-sm text-danger">{s.reportError}</p> : null}
          {s.dailyReport ? (
            <p className="mt-2 line-clamp-4 text-sm">{s.dailyReport}</p>
          ) : null}
          <Button variant="secondary" className="mt-3 w-full" onClick={() => s.setView("report")}>
            Open report
          </Button>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => s.startWalk()}>Start site walk</Button>
        <Button variant="secondary" onClick={() => s.requestReport()}>
          {s.dailyReport ? "Regenerate report" : "Draft report"}
        </Button>
      </div>

      {!s.seeded ? (
        <Button variant="secondary" className="w-full" onClick={() => s.seedDemo()}>
          Load sample job
        </Button>
      ) : null}

      <Card>
        <Field label="Superintendent">
          <Input
            value={s.employeeName}
            placeholder="Your name"
            onChange={(e) => s.setProfile({ employeeName: e.target.value })}
          />
        </Field>
        <div className="mt-3">
          <Field label="Company / job">
            <Input
              value={s.company}
              onChange={(e) => s.setProfile({ company: e.target.value })}
            />
          </Field>
        </div>
      </Card>
    </div>
  );
}

function MoreView() {
  const setView = useSiteWalk((s) => s.setView);
  const items: { view: View; label: string; icon: typeof FileText }[] = [
    { view: "rfis", label: "RFIs", icon: FileText },
    { view: "logs", label: "Daily log", icon: ClipboardList },
    { view: "submittals", label: "Submittals", icon: FolderOpen },
    { view: "punch", label: "Punch list", icon: Wrench },
    { view: "changes", label: "Change orders", icon: NotebookPen },
    { view: "trades", label: "Trade directory", icon: Users },
    { view: "report", label: "AI site report", icon: FileText },
    { view: "pipeline", label: "Land-to-closing map", icon: NotebookPen },
    { view: "review", label: "Review before send", icon: Users },
    { view: "clock", label: "GPS clock-in", icon: MapPin },
    { view: "safety", label: "Safety", icon: HardHat },
  ];
  return (
    <div>
      <SectionTitle>All modules</SectionTitle>
      <div className="grid grid-cols-1 gap-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.view}
              type="button"
              onClick={() => setView(it.view)}
              className="flex min-h-14 items-center justify-between rounded-lg border border-line bg-surface px-4"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <Icon className="size-4 text-muted" />
                {it.label}
              </span>
              <ArrowRight className="size-4 text-faint" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RfiView() {
  const rfis = useSiteWalk((s) => s.rfis);
  const addRfi = useSiteWalk((s) => s.addRfi);
  const answerRfi = useSiteWalk((s) => s.answerRfi);
  const deleteRfi = useSiteWalk((s) => s.deleteRfi);
  const [question, setQuestion] = useState("");
  const [trade, setTrade] = useState("General");
  const [recipient, setRecipient] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  return (
    <div>
      <SectionTitle>RFIs</SectionTitle>
      <RouteBanner />
      <Card className="space-y-3">
        <Field label="Question / issue">
          <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} />
        </Field>
        <DictateButton value={question} onChange={setQuestion} />
        <Field label="Trade">
          <Select value={trade} onChange={(e) => setTrade(e.target.value)}>
            {TRADES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Sent to">
          <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Email or phone" />
        </Field>
        <PhotoInput value={photo} onChange={setPhoto} />
        <Button
          className="w-full"
          onClick={() => {
            if (!question.trim()) return;
            addRfi({ question: question.trim(), trade, recipient: recipient.trim(), photo });
            setQuestion("");
            setRecipient("");
            setPhoto(null);
          }}
        >
          Submit RFI
        </Button>
      </Card>
      <div className="mt-4 space-y-2">
        {rfis.length === 0 ? <Empty>No RFIs yet.</Empty> : null}
        {[...rfis].reverse().map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm">{r.trade}</strong>
              <div className="flex items-center gap-2">
                <RouteBadge status={r.notificationStatus} />
                <Badge tone={r.status === "Open" ? "open" : "ok"}>{r.status}</Badge>
              </div>
            </div>
            <p className="mt-2 text-sm">{r.question}</p>
            {r.recipient ? <p className="mt-1 text-xs text-muted">To {r.recipient}</p> : null}
            {r.answer ? <p className="mt-2 text-sm text-ok">Answer: {r.answer}</p> : null}
            {r.photo ? <img src={r.photo} alt="" className="mt-2 h-20 w-20 rounded-sm object-cover" /> : null}
            <p className="mt-2 text-xs text-muted">{formatWhen(r.createdAt)}</p>
            {answerFor === r.id ? (
              <div className="mt-2 space-y-2">
                <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer received" />
                <Button
                  onClick={() => {
                    if (!answer.trim()) return;
                    answerRfi(r.id, answer.trim());
                    setAnswerFor(null);
                    setAnswer("");
                  }}
                >
                  Save answer
                </Button>
              </div>
            ) : r.status === "Open" ? (
              <Button variant="secondary" className="mt-2" onClick={() => setAnswerFor(r.id)}>
                Mark answered
              </Button>
            ) : null}
            <ItemRoute
              itemId={r.id}
              kind="rfi"
              trade={r.trade}
              status={r.notificationStatus}
              onTrade={(t) => useSiteWalk.getState().setRfiTrade(r.id, t)}
            />
            <DeleteBtn onClick={() => deleteRfi(r.id)} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function LogView() {
  const logs = useSiteWalk((s) => s.logs);
  const addLog = useSiteWalk((s) => s.addLog);
  const deleteLog = useSiteWalk((s) => s.deleteLog);
  const [date, setDate] = useState(todayISO());
  const [weather, setWeather] = useState<Weather>("Clear");
  const [crewCount, setCrewCount] = useState("");
  const [trades, setTrades] = useState("");
  const [delays, setDelays] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div>
      <SectionTitle>Daily log</SectionTitle>
      <Card className="space-y-3">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Weather">
          <Select value={weather} onChange={(e) => setWeather(e.target.value as Weather)}>
            {WEATHER.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </Select>
        </Field>
        <Field label="Crew present">
          <Input type="number" min={0} value={crewCount} onChange={(e) => setCrewCount(e.target.value)} />
        </Field>
        <Field label="Trades on site">
          <Input value={trades} onChange={(e) => setTrades(e.target.value)} placeholder="Framing, Electrical" />
        </Field>
        <Field label="Delays / issues">
          <Textarea value={delays} onChange={(e) => setDelays(e.target.value)} />
        </Field>
        <DictateButton value={delays} onChange={setDelays} />
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button
          className="w-full"
          onClick={() => {
            addLog({ date: date || todayISO(), weather, crewCount, trades, delays, notes });
            setCrewCount("");
            setTrades("");
            setDelays("");
            setNotes("");
          }}
        >
          Save daily log
        </Button>
      </Card>
      <div className="mt-4 space-y-2">
        {logs.length === 0 ? <Empty>No daily logs yet.</Empty> : null}
        {[...logs].reverse().map((l) => (
          <Card key={l.id}>
            <div className="font-medium">
              {formatDate(l.date)} — {l.weather}
            </div>
            <p className="text-sm text-muted">Crew {l.crewCount || "n/a"}</p>
            {l.trades ? <p className="text-sm">Trades: {l.trades}</p> : null}
            {l.delays ? <p className="text-sm">Delays: {l.delays}</p> : null}
            {l.notes ? <p className="text-sm text-muted">{l.notes}</p> : null}
            <DeleteBtn onClick={() => deleteLog(l.id)} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function SubmittalView() {
  const items = useSiteWalk((s) => s.submittals);
  const addSubmittal = useSiteWalk((s) => s.addSubmittal);
  const approveSubmittal = useSiteWalk((s) => s.approveSubmittal);
  const deleteSubmittal = useSiteWalk((s) => s.deleteSubmittal);
  const [item, setItem] = useState("");
  const [trade, setTrade] = useState("");
  const [recipient, setRecipient] = useState("");
  const [dueDate, setDueDate] = useState("");

  return (
    <div>
      <SectionTitle>Submittals</SectionTitle>
      <Card className="space-y-3">
        <Field label="Item">
          <Textarea value={item} onChange={(e) => setItem(e.target.value)} />
        </Field>
        <DictateButton value={item} onChange={setItem} />
        <Field label="Trade / supplier">
          <Input value={trade} onChange={(e) => setTrade(e.target.value)} />
        </Field>
        <Field label="Sent to">
          <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        </Field>
        <Field label="Due date">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Button
          className="w-full"
          onClick={() => {
            if (!item.trim()) return;
            addSubmittal({ item: item.trim(), trade, recipient, dueDate });
            setItem("");
            setTrade("");
            setRecipient("");
            setDueDate("");
          }}
        >
          Submit
        </Button>
      </Card>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? <Empty>No submittals yet.</Empty> : null}
        {[...items].reverse().map((s) => (
          <Card key={s.id}>
            <div className="flex items-center justify-between">
              <strong className="text-sm">{s.trade || "General"}</strong>
              <Badge tone={s.status === "Approved" ? "ok" : "warn"}>{s.status}</Badge>
            </div>
            <p className="mt-2 text-sm">{s.item}</p>
            {s.dueDate ? <p className="text-xs text-muted">Due {s.dueDate}</p> : null}
            {s.status === "Pending" ? (
              <Button variant="secondary" className="mt-2" onClick={() => approveSubmittal(s.id)}>
                Mark approved
              </Button>
            ) : null}
            <DeleteBtn onClick={() => deleteSubmittal(s.id)} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function SafetyView() {
  const items = useSiteWalk((s) => s.safety);
  const addSafety = useSiteWalk((s) => s.addSafety);
  const deleteSafety = useSiteWalk((s) => s.deleteSafety);
  const [type, setType] = useState("Near-Miss");
  const [desc, setDesc] = useState("");
  const [person, setPerson] = useState("");
  const [action, setAction] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  return (
    <div>
      <SectionTitle>Safety log</SectionTitle>
      <Card className="space-y-3">
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option>Near-Miss</option>
            <option>Minor Incident</option>
            <option>Injury</option>
            <option>Equipment/Property Damage</option>
            <option>Hazard Observed</option>
          </Select>
        </Field>
        <Field label="Description">
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <DictateButton value={desc} onChange={setDesc} />
        <Field label="Person(s) involved">
          <Input value={person} onChange={(e) => setPerson(e.target.value)} />
        </Field>
        <Field label="Corrective action">
          <Textarea value={action} onChange={(e) => setAction(e.target.value)} />
        </Field>
        <PhotoInput value={photo} onChange={setPhoto} />
        <Button
          className="w-full"
          onClick={() => {
            if (!desc.trim()) return;
            addSafety({
              type: type as "Near-Miss",
              desc: desc.trim(),
              person,
              action,
              photo,
            });
            setDesc("");
            setPerson("");
            setAction("");
            setPhoto(null);
          }}
        >
          Log incident
        </Button>
      </Card>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? <Empty>No safety entries yet.</Empty> : null}
        {[...items].reverse().map((x) => (
          <Card key={x.id}>
            <Badge tone="warn">{x.type}</Badge>
            <p className="mt-2 text-sm">{x.desc}</p>
            {x.person ? <p className="text-xs text-muted">Involved: {x.person}</p> : null}
            {x.action ? <p className="text-sm">Action: {x.action}</p> : null}
            {x.photo ? <img src={x.photo} alt="" className="mt-2 h-20 w-20 rounded-sm object-cover" /> : null}
            <p className="mt-2 text-xs text-muted">{formatWhen(x.createdAt)}</p>
            <DeleteBtn onClick={() => deleteSafety(x.id)} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function PunchView() {
  const items = useSiteWalk((s) => s.punch);
  const addPunch = useSiteWalk((s) => s.addPunch);
  const togglePunch = useSiteWalk((s) => s.togglePunch);
  const deletePunch = useSiteWalk((s) => s.deletePunch);
  const [item, setItem] = useState("");
  const [location, setLocation] = useState("");
  const [trade, setTrade] = useState("General");
  const [photo, setPhoto] = useState<string | null>(null);

  return (
    <div>
      <SectionTitle>Punch list</SectionTitle>
      <RouteBanner />
      <Card className="space-y-3">
        <Field label="Item">
          <Textarea value={item} onChange={(e) => setItem(e.target.value)} />
        </Field>
        <DictateButton value={item} onChange={setItem} />
        <Field label="Location">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <Field label="Trade">
          <Select value={trade} onChange={(e) => setTrade(e.target.value)}>
            {TRADES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <PhotoInput value={photo} onChange={setPhoto} />
        <Button
          className="w-full"
          onClick={() => {
            if (!item.trim()) return;
            addPunch({ item: item.trim(), location, trade, photo });
            setItem("");
            setLocation("");
            setPhoto(null);
          }}
        >
          Add punch item
        </Button>
      </Card>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? <Empty>No punch items.</Empty> : null}
        {[...items].reverse().map((p) => (
          <Card key={p.id} className={p.done ? "opacity-60" : ""}>
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => togglePunch(p.id)}
                className="mt-0.5 flex size-6 items-center justify-center rounded-sm border border-line"
                aria-label={p.done ? "Reopen" : "Complete"}
              >
                {p.done ? <Check className="size-4 text-ok" /> : null}
              </button>
              <div className="flex-1">
                <p className="text-sm">{p.item}</p>
                <p className="text-xs text-muted">
                  {p.location || "No location"} · {p.trade}
                </p>
                <RouteBadge status={p.notificationStatus} />
                {p.photo ? <img src={p.photo} alt="" className="mt-2 h-16 w-16 rounded-sm object-cover" /> : null}
                <ItemRoute
                  itemId={p.id}
                  kind="punch"
                  trade={p.trade}
                  status={p.notificationStatus}
                  onTrade={(t) => useSiteWalk.getState().setPunchTrade(p.id, t)}
                />
              </div>
            </div>
            <DeleteBtn onClick={() => deletePunch(p.id)} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function ChangeView() {
  const items = useSiteWalk((s) => s.changes);
  const addChange = useSiteWalk((s) => s.addChange);
  const setChangeStatus = useSiteWalk((s) => s.setChangeStatus);
  const deleteChange = useSiteWalk((s) => s.deleteChange);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [trade, setTrade] = useState("General");

  return (
    <div>
      <SectionTitle>Change orders</SectionTitle>
      <RouteBanner />
      <Card className="space-y-3">
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Amount">
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Trade">
          <Select value={trade} onChange={(e) => setTrade(e.target.value)}>
            {TRADES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Button
          className="w-full"
          onClick={() => {
            if (!description.trim()) return;
            addChange({ description: description.trim(), amount, trade });
            setDescription("");
            setAmount("");
          }}
        >
          Add change order
        </Button>
      </Card>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? <Empty>No change orders.</Empty> : null}
        {[...items].reverse().map((c) => (
          <Card key={c.id}>
            <div className="flex items-center justify-between">
              <strong className="text-sm">{c.trade}</strong>
              <div className="flex items-center gap-2">
                <RouteBadge status={c.notificationStatus} />
                <Badge tone={c.status === "Approved" ? "ok" : c.status === "Rejected" ? "danger" : "warn"}>
                  {c.status}
                </Badge>
              </div>
            </div>
            <p className="mt-2 text-sm">{c.description}</p>
            {c.amount ? (
              <p className="font-mono text-sm tabular-nums">${Number(c.amount).toLocaleString()}</p>
            ) : null}
            {c.status === "Pending" ? (
              <div className="mt-2 flex gap-2">
                <Button variant="ok" onClick={() => setChangeStatus(c.id, "Approved")}>
                  Approve
                </Button>
                <Button variant="secondary" onClick={() => setChangeStatus(c.id, "Rejected")}>
                  Reject
                </Button>
              </div>
            ) : null}
            <ItemRoute
              itemId={c.id}
              kind="change"
              trade={c.trade}
              status={c.notificationStatus}
              onTrade={(t) => useSiteWalk.getState().setChangeTrade(c.id, t)}
            />
            <DeleteBtn onClick={() => deleteChange(c.id)} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function TradeView() {
  const items = useSiteWalk((s) => s.trades);
  const addTrade = useSiteWalk((s) => s.addTrade);
  const deleteTrade = useSiteWalk((s) => s.deleteTrade);
  const sites = useSiteWalk((s) => s.sites);
  const [company, setCompany] = useState("");
  const [trade, setTrade] = useState("General");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [preferredChannel, setPreferredChannel] = useState<"sms" | "email" | "both">("sms");
  const [siteId, setSiteId] = useState("");

  return (
    <div>
      <SectionTitle>Trade directory</SectionTitle>
      <Card className="space-y-3">
        <Field label="Company">
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </Field>
        <Field label="Trade">
          <Select value={trade} onChange={(e) => setTrade(e.target.value)}>
            {TRADES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Contact">
          <Input value={contact} onChange={(e) => setContact(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Preferred channel">
          <Select
            value={preferredChannel}
            onChange={(e) => setPreferredChannel(e.target.value as "sms" | "email" | "both")}
          >
            <option value="sms">SMS</option>
            <option value="email">Email</option>
            <option value="both">SMS and email</option>
          </Select>
        </Field>
        <Field label="Job site">
          <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">All jobs</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button
          className="w-full"
          onClick={() => {
            if (!company.trim()) return;
            addTrade({
              company: company.trim(),
              trade,
              contact,
              phone,
              email,
              notes,
              preferredChannel,
              siteId,
            });
            setCompany("");
            setContact("");
            setPhone("");
            setEmail("");
            setNotes("");
            setPreferredChannel("sms");
            setSiteId("");
          }}
        >
          Save contact
        </Button>
      </Card>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? <Empty>No trades yet.</Empty> : null}
        {items.map((t) => (
          <Card key={t.id}>
            <div className="font-medium">{t.company}</div>
            <p className="text-sm text-muted">
              {t.trade}
              {t.contact ? ` · ${t.contact}` : ""}
              {` · ${(t.preferredChannel || "sms").toUpperCase()}`}
            </p>
            {t.phone ? (
              <a className="block text-sm text-navy" href={`tel:${t.phone}`}>
                {t.phone}
              </a>
            ) : null}
            {t.email ? <p className="text-sm">{t.email}</p> : null}
            {t.notes ? <p className="text-xs text-muted">{t.notes}</p> : null}
            <DeleteBtn onClick={() => deleteTrade(t.id)} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function ClockView() {
  const sites = useSiteWalk((s) => s.sites);
  const addSite = useSiteWalk((s) => s.addSite);
  const deleteSite = useSiteWalk((s) => s.deleteSite);
  const events = useSiteWalk((s) => s.clockEvents);
  const logClock = useSiteWalk((s) => s.logClock);
  const resolveFlag = useSiteWalk((s) => s.resolveFlag);
  const employeeName = useSiteWalk((s) => s.employeeName);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("Waiting for GPS…");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [gpsError, setGpsError] = useState("");
  const insideRef = useMemo(() => new Map<string, { inside: boolean; timer: number | null }>(), []);
  const lastEvent = events[events.length - 1];
  const isIn = lastEvent?.type === "in";
  const clockedAt = isIn ? new Date(lastEvent.timestamp).getTime() : 0;

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const MAX = 16 * 60 * 60 * 1000;
    const store = useSiteWalk.getState();
    const byEmp: Record<string, typeof events> = {};
    store.clockEvents.forEach((e) => {
      (byEmp[e.employeeName] ||= []).push(e);
    });
    Object.values(byEmp).forEach((list) => {
      const sorted = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].type !== "in") continue;
        const nextOut = sorted.slice(i + 1).find((e) => e.type === "out");
        const elapsed = Date.now() - new Date(sorted[i].timestamp).getTime();
        if (!nextOut && elapsed > MAX && !sorted[i].flagged) {
          useSiteWalk.setState({
            clockEvents: useSiteWalk
              .getState()
              .clockEvents.map((e) => (e.id === sorted[i].id ? { ...e, flagged: true } : e)),
          });
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("This browser cannot read GPS. Use manual clock-in.");
      setStatus("GPS unavailable");
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setGpsError("");
        const liveSites = useSiteWalk.getState().sites.filter((s) => s.active);
        let insideAny = false;
        liveSites.forEach((site) => {
          const dist = haversineMeters(lat, lng, site.lat, site.lng);
          const st = insideRef.get(site.id) ?? { inside: false, timer: null };
          const isInside = dist <= 100;
          if (isInside) insideAny = true;
          if (isInside && !st.inside) {
            st.inside = true;
            if (st.timer) window.clearTimeout(st.timer);
            st.timer = null;
            const emp = useSiteWalk.getState().employeeName || "Crew";
            logClock({
              employeeName: emp,
              siteId: site.id,
              siteName: site.name,
              type: "in",
              isManual: false,
              flagged: false,
              timestamp: new Date().toISOString(),
            });
            setStatus(`Clocked in at ${site.name}`);
          } else if (!isInside && st.inside && !st.timer) {
            st.timer = window.setTimeout(() => {
              st.inside = false;
              st.timer = null;
              const emp = useSiteWalk.getState().employeeName || "Crew";
              logClock({
                employeeName: emp,
                siteId: site.id,
                siteName: site.name,
                type: "out",
                isManual: false,
                flagged: false,
                timestamp: new Date().toISOString(),
              });
              setStatus(`Clocked out of ${site.name}`);
            }, 5 * 60 * 1000);
          } else if (isInside && st.inside && st.timer) {
            window.clearTimeout(st.timer);
            st.timer = null;
          }
          insideRef.set(site.id, st);
        });
        if (!insideAny && liveSites.length) {
          setStatus("Outside all 100m job radii.");
        } else if (!liveSites.length) {
          setStatus("No job sites yet. Pin your location.");
        }
      },
      (err) => {
        setGpsError(err.message);
        setStatus("GPS error — use manual clock-in.");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [insideRef, logClock]);

  const nearest = coords
    ? sites
        .map((site) => ({ site, dist: haversineMeters(coords.lat, coords.lng, site.lat, site.lng) }))
        .sort((a, b) => a.dist - b.dist)
    : [];

  function addNamedSite(useGps: boolean) {
    if (!name.trim()) return;
    if (useGps && !coords) {
      setGpsError("Need a GPS fix to pin this site.");
      return;
    }
    addSite({
      name: name.trim(),
      address: address.trim() || (useGps ? "Pinned from GPS" : "Manual site"),
      lat: useGps && coords ? coords.lat : coords?.lat ?? 0,
      lng: useGps && coords ? coords.lng : coords?.lng ?? 0,
    });
    setName("");
    setAddress("");
    setGpsError("");
  }

  function manual(type: "in" | "out") {
    const site = sites[0];
    if (!site) {
      setGpsError("Add a job site first.");
      return;
    }
    const emp = employeeName || "Crew";
    logClock({
      employeeName: emp,
      siteId: site.id,
      siteName: site.name,
      type,
      isManual: true,
      flagged: false,
      timestamp: new Date().toISOString(),
    });
    if (type === "in") setStatus(`Manual clock in at ${site.name}`);
    else setStatus(`Manual clock out at ${site.name}`);
  }

  return (
    <div>
      <SectionTitle>GPS clock-in</SectionTitle>
      <Card>
        <Badge tone={isIn ? "ok" : "neutral"}>{isIn ? "Clocked in" : "Clocked out"}</Badge>
        <div className="mt-2 font-mono text-3xl tabular-nums">
          {isIn ? fmtDuration(Date.now() - clockedAt + tick * 0) : "00:00:00"}
        </div>
        <p className="mt-2 text-sm text-muted">{status}</p>
        {coords ? (
          <p className="mt-1 font-mono text-xs text-faint">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        ) : null}
        {gpsError ? <p className="mt-2 text-sm text-danger">{gpsError}</p> : null}
        <p className="mt-3 text-xs text-muted">
          Auto clock uses a 100m radius and a 5-minute exit buffer. Background tracking needs the phone to keep
          this tab open — wrap later in a native shell for true always-on GPS.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="ok" onClick={() => manual("in")}>
            Manual in
          </Button>
          <Button variant="danger" onClick={() => manual("out")}>
            Manual out
          </Button>
        </div>
      </Card>

      <h3 className="mb-2 mt-5 text-sm font-medium">Job sites</h3>
      <Card className="space-y-3">
        <Field label="Site name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="123 Main St" />
        </Field>
        <Field label="Address note">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Button className="w-full" onClick={() => addNamedSite(true)}>
            Pin current GPS
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => addNamedSite(false)}>
            Save site
          </Button>
        </div>
      </Card>
      <div className="mt-2 space-y-2">
        {sites.length === 0 ? <Empty>No job sites yet.</Empty> : null}
        {(nearest.length ? nearest : sites.map((site) => ({ site, dist: null as number | null }))).map((row) => (
          <Card key={row.site.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{row.site.name}</div>
                <p className="text-xs text-muted">{row.site.address}</p>
                {row.dist != null ? (
                  <p className="font-mono text-xs tabular-nums text-muted">{Math.round(row.dist)}m away</p>
                ) : null}
              </div>
              <DeleteBtn onClick={() => deleteSite(row.site.id)} />
            </div>
          </Card>
        ))}
      </div>

      <h3 className="mb-2 mt-5 text-sm font-medium">Needs review</h3>
      {events.filter((e) => e.flagged).length === 0 ? (
        <Empty>No missed clock-outs.</Empty>
      ) : (
        events
          .filter((e) => e.flagged)
          .map((e) => (
            <Card key={e.id} className="mb-2">
              <Badge tone="warn">Needs review</Badge>
              <p className="mt-1 text-sm">
                {e.employeeName} — {e.siteName}
              </p>
              <p className="text-xs text-muted">In {formatWhen(e.timestamp)}</p>
              <Button
                className="mt-2"
                onClick={() => {
                  const v = window.prompt("Clock-out time (YYYY-MM-DDTHH:MM)");
                  if (!v) return;
                  const iso = new Date(v).toISOString();
                  if (Number.isNaN(new Date(iso).getTime())) return;
                  resolveFlag(e.id, iso);
                }}
              >
                Set clock-out
              </Button>
            </Card>
          ))
      )}

      <h3 className="mb-2 mt-5 text-sm font-medium">Event log</h3>
      {[...events]
        .reverse()
        .slice(0, 30)
        .map((e) => (
          <Card key={e.id} className="mb-2">
            <div className="flex gap-2">
              <Badge tone={e.type === "in" ? "ok" : "neutral"}>{e.type}</Badge>
              {e.isManual ? <Badge>Manual</Badge> : null}
              {e.flagged ? <Badge tone="warn">Flagged</Badge> : null}
            </div>
            <p className="mt-1 text-sm">
              {e.employeeName} — {e.siteName}
            </p>
            <p className="text-xs text-muted">{formatWhen(e.timestamp)}</p>
          </Card>
        ))}
    </div>
  );
}

function ReportView() {
  const text = useSiteWalk((s) => s.dailyReport);
  const error = useSiteWalk((s) => s.reportError);
  const busy = useSiteWalk((s) => s.reportBusy);
  const at = useSiteWalk((s) => s.reportAt);
  const requestReport = useSiteWalk((s) => s.requestReport);

  return (
    <div>
      <SectionTitle>AI site report</SectionTitle>
      <p className="mb-3 text-sm text-muted">
        Drafts itself when you end a walk, from that walk plus today’s logs, RFIs, punch, and safety.
      </p>
      <Button className="w-full" onClick={() => requestReport()} disabled={busy}>
        {busy ? "Drafting…" : text ? "Regenerate report" : "Draft today's report"}
      </Button>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {at ? <p className="mt-2 text-xs text-muted">{formatWhen(at)}</p> : null}
      {text ? (
        <Card className="mt-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{text}</pre>
        </Card>
      ) : !busy ? (
        <Empty>No report yet. End a walk or tap draft.</Empty>
      ) : null}
    </div>
  );
}
