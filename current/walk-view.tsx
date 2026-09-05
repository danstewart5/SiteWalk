import { useEffect, useRef, useState } from "react";
import { Camera, Mic, Square } from "lucide-react";
import { useDictate } from "@/hooks/use-dictate";
import { useSiteWalk } from "@/lib/store";
import { compressImage, fmtDuration, formatWhen } from "@/lib/utils";
import { Badge, Button, Card, Empty, Select } from "./ui";

type CamStatus =
  | "idle"
  | "requesting"
  | "live"
  | "denied"
  | "iframe"
  | "insecure"
  | "unsupported"
  | "error";

function inIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function camMessage(status: CamStatus) {
  switch (status) {
    case "requesting":
      return "Asking for camera…";
    case "live":
      return "Live camera on. Tap the shutter to save a shot.";
    case "iframe":
      return "This preview blocks the live camera. Walk is still recording — tap the shutter to take photos.";
    case "denied":
      return "Camera permission denied. Tap the shutter to use your phone camera instead.";
    case "insecure":
      return "Live camera needs HTTPS. Tap the shutter to take a photo.";
    case "unsupported":
      return "No live camera on this device. Tap the shutter to take a photo.";
    case "error":
      return "Live camera unavailable. Tap the shutter — photos still save to this walk.";
    default:
      return "Tap the shutter. Photo saves to this walk.";
  }
}

function snapFromVideo(video: HTMLVideoElement) {
  if (!video.videoWidth) return null;
  const max = 960;
  const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export function WalkView() {
  const walkActive = useSiteWalk((s) => s.walkActive);
  const walkStartedAt = useSiteWalk((s) => s.walkStartedAt);
  const startWalk = useSiteWalk((s) => s.startWalk);
  const endWalk = useSiteWalk((s) => s.endWalk);
  const notes = useSiteWalk((s) => s.walkNotes);
  const addWalkNote = useSiteWalk((s) => s.addWalkNote);
  const updateWalkNote = useSiteWalk((s) => s.updateWalkNote);
  const convertWalkNote = useSiteWalk((s) => s.convertWalkNote);
  const deleteWalkNote = useSiteWalk((s) => s.deleteWalkNote);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [live, setLive] = useState(false);
  const [camStatus, setCamStatus] = useState<CamStatus>("idle");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [gpsLabel, setGpsLabel] = useState("Waiting for GPS…");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!walkActive) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [walkActive]);

  useEffect(() => {
    if (!walkActive) {
      setLive(false);
      setCamStatus("idle");
      return;
    }
    if (!window.isSecureContext) {
      setLive(false);
      setCamStatus("insecure");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setLive(false);
      setCamStatus(inIframe() ? "iframe" : "unsupported");
      return;
    }

    let stream: MediaStream | null = null;
    let cancelled = false;
    setCamStatus("requesting");
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          void video.play();
        }
        setLive(true);
        setCamStatus("live");
      })
      .catch((err: unknown) => {
        setLive(false);
        const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
        if (inIframe()) setCamStatus("iframe");
        else if (name === "NotAllowedError" || name === "PermissionDeniedError") setCamStatus("denied");
        else if (name === "NotFoundError" || name === "OverconstrainedError") setCamStatus("unsupported");
        else setCamStatus("error");
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [walkActive]);

  useEffect(() => {
    if (!walkActive || !navigator.geolocation) {
      setGpsLabel("GPS off");
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsLabel(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      (err) => setGpsLabel(err.message || "GPS unavailable"),
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 12000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [walkActive]);

  async function saveShot(dataUrl: string) {
    const n = useSiteWalk.getState().walkNotes.length + 1;
    addWalkNote({
      body: `Photo ${n}`,
      tag: "Note",
      photo: dataUrl,
      lat: coordsRef.current?.lat ?? null,
      lng: coordsRef.current?.lng ?? null,
    });
  }

  async function onShutter() {
    if (busy) return;
    const fromLive = live && videoRef.current ? snapFromVideo(videoRef.current) : null;
    if (fromLive) {
      setBusy(true);
      try {
        await saveShot(fromLive);
      } finally {
        setBusy(false);
      }
      return;
    }
    fileRef.current?.click();
  }

  const elapsed =
    walkActive && walkStartedAt ? Date.now() - new Date(walkStartedAt).getTime() + tick * 0 : 0;
  const shotCount = notes.filter((n) => n.photo).length;
  const selectedNote = notes.find((n) => n.id === selected);

  if (!walkActive) {
    return (
      <div>
        <h2 className="mb-3 text-lg font-medium tracking-tight text-ink">Site walk</h2>
        <Card>
          <p className="text-sm text-muted">
            Start a walk to record. The camera stays ready — tap the shutter for each photo. Shots
            save immediately with time and GPS.
          </p>
          <Button className="mt-4 w-full" onClick={() => startWalk()}>
            Start recording walk
          </Button>
        </Card>
        <ShotList
          notes={notes}
          selected={selected}
          onSelect={setSelected}
          onDelete={deleteWalkNote}
          onConvert={convertWalkNote}
        />
        {selectedNote ? (
          <CaptionEditor
            note={selectedNote}
            onChange={(patch) => updateWalkNote(selectedNote.id, patch)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rec-dot inline-block size-2.5 rounded-full bg-danger" />
          <div>
            <p className="text-sm font-medium">Recording</p>
            <p className="font-mono text-xs tabular-nums text-muted">
              {fmtDuration(elapsed)} · {shotCount} photo{shotCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <Button variant="danger" onClick={() => endWalk()}>
          End walk
        </Button>
      </div>

      {camStatus !== "live" && camStatus !== "requesting" && camStatus !== "idle" ? (
        <Card className="mb-3 border-warn bg-warn-bg">
          <p className="text-sm text-warn">{camMessage(camStatus)}</p>
        </Card>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-ink">
        <video
          ref={videoRef}
          className={live ? "aspect-[3/4] w-full object-cover" : "hidden"}
          playsInline
          muted
          autoPlay
        />
        {!live ? (
          <label
            htmlFor="walk-camera"
            className="flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center gap-3 text-navy-fg"
          >
            <Camera className="size-12" />
            <span className="text-sm font-medium">Tap to open camera</span>
            <span className="px-6 text-center text-xs text-faint">{camMessage(camStatus)}</span>
          </label>
        ) : null}
      </div>
      <p className="mt-2 font-mono text-[11px] text-faint">{gpsLabel}</p>

      <input
        id="walk-camera"
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            await saveShot(await compressImage(file));
          } finally {
            setBusy(false);
          }
        }}
      />

      <div className="mt-4 flex items-center justify-center">
        {live ? (
          <button
            type="button"
            aria-label="Take photo"
            disabled={busy}
            onClick={() => void onShutter()}
            className="flex size-20 items-center justify-center rounded-full border-4 border-ink bg-surface text-ink transition-transform duration-150 ease-out active:not-disabled:scale-[0.96] disabled:opacity-50"
          >
            <Camera className="size-8" />
          </button>
        ) : (
          <label
            htmlFor="walk-camera"
            className="flex size-20 cursor-pointer items-center justify-center rounded-full border-4 border-ink bg-surface text-ink transition-transform duration-150 ease-out active:scale-[0.96]"
            aria-label="Take photo"
          >
            <Camera className="size-8" />
          </label>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        {busy ? "Saving photo…" : camMessage(camStatus)}
      </p>

      {notes.length > 0 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {[...notes].reverse().map((n) =>
            n.photo ? (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelected(n.id)}
                className={`h-20 w-20 shrink-0 overflow-hidden rounded-sm border ${
                  selected === n.id ? "border-navy" : "border-line"
                }`}
              >
                <img src={n.photo} alt="" className="h-full w-full object-cover" />
              </button>
            ) : null,
          )}
        </div>
      ) : (
        <Empty>Walk is recording. Hit the camera to save the first shot.</Empty>
      )}

      {selectedNote ? (
        <CaptionEditor
          note={selectedNote}
          onChange={(patch) => updateWalkNote(selectedNote.id, patch)}
        />
      ) : null}

      <ShotList
        notes={notes}
        selected={selected}
        onSelect={setSelected}
        onDelete={deleteWalkNote}
        onConvert={convertWalkNote}
      />
    </div>
  );
}

function CaptionEditor({
  note,
  onChange,
}: {
  note: { id: string; body: string; tag: "Note" | "Punch" | "RFI" | "Safety" };
  onChange: (patch: { body?: string; tag?: "Note" | "Punch" | "RFI" | "Safety" }) => void;
}) {
  const dictate = useDictate((text) => onChange({ body: text }));
  return (
    <Card className="mt-4 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Caption this shot</p>
      <textarea
        className="min-h-20 w-full rounded-sm border border-line bg-surface px-3 py-2 text-sm"
        value={note.body}
        onChange={(e) => onChange({ body: e.target.value })}
      />
      {dictate.supported ? (
        <Button
          type="button"
          variant={dictate.listening ? "danger" : "mic"}
          onClick={() => dictate.toggle(note.body)}
        >
          {dictate.listening ? <Square className="size-4" /> : <Mic className="size-4" />}
          {dictate.listening ? "Stop" : "Dictate"}
        </Button>
      ) : null}
      <Select
        value={note.tag}
        onChange={(e) => onChange({ tag: e.target.value as typeof note.tag })}
      >
        <option>Note</option>
        <option>Punch</option>
        <option>RFI</option>
        <option>Safety</option>
      </Select>
    </Card>
  );
}

function ShotList({
  notes,
  selected,
  onSelect,
  onDelete,
  onConvert,
}: {
  notes: {
    id: string;
    body: string;
    tag: "Note" | "Punch" | "RFI" | "Safety";
    photo: string | null;
    lat?: number | null;
    lng?: number | null;
    createdAt: string;
  }[];
  selected: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onConvert: (id: string) => void;
}) {
  if (notes.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {[...notes].reverse().map((n) => (
        <Card key={n.id} className={selected === n.id ? "border-navy" : ""}>
          <button type="button" className="w-full text-left" onClick={() => onSelect(n.id)}>
            <div className="flex items-center justify-between gap-2">
              <Badge tone={n.tag === "Safety" ? "warn" : n.tag === "RFI" ? "open" : "neutral"}>
                {n.tag}
              </Badge>
              <span className="text-xs text-muted">{formatWhen(n.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm">{n.body}</p>
            {n.photo ? (
              <img src={n.photo} alt="" className="mt-2 h-28 w-full rounded-sm object-cover" />
            ) : null}
            {n.lat != null && n.lng != null ? (
              <p className="mt-1 font-mono text-[11px] text-faint">
                {n.lat.toFixed(5)}, {n.lng.toFixed(5)}
              </p>
            ) : null}
          </button>
          <div className="mt-2 flex gap-2">
            {n.tag !== "Note" ? (
              <Button variant="secondary" className="min-h-9" onClick={() => onConvert(n.id)}>
                File into {n.tag}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="min-h-9 px-2 text-danger"
              onClick={() => onDelete(n.id)}
            >
              Delete
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
