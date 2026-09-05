import { useEffect, useRef, useState } from "react";

type Rec = SpeechRecognition;

export function useWalkListen(active: boolean, onUtterance: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [paused, setPaused] = useState(false);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState("");
  const recRef = useRef<Rec | null>(null);
  const restartRef = useRef<number | null>(null);
  const onUtteranceRef = useRef(onUtterance);
  const pausedRef = useRef(paused);
  const activeRef = useRef(active);
  onUtteranceRef.current = onUtterance;
  pausedRef.current = paused;
  activeRef.current = active;

  function clearRestart() {
    if (restartRef.current != null) {
      window.clearTimeout(restartRef.current);
      restartRef.current = null;
    }
  }

  function stopRec() {
    clearRestart();
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
    setInterim("");
  }

  function startRec() {
    if (recRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event: SpeechRecognitionEvent) => {
      let live = "";
      const start = event.resultIndex ?? 0;
      for (let i = start; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript.trim();
        if (!piece) continue;
        if (event.results[i].isFinal) onUtteranceRef.current(piece);
        else live += `${piece} `;
      }
      setInterim(live.trim());
    };
    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const err = event.error;
      if (err === "not-allowed" || err === "service-not-allowed") {
        setMicError("Mic permission denied. Voice is off — camera and GPS still run.");
        setPaused(true);
        return;
      }
      if (err === "no-speech" || err === "aborted" || err === "network") return;
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim("");
      if (!activeRef.current || pausedRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      clearRestart();
      restartRef.current = window.setTimeout(() => {
        if (activeRef.current && !pausedRef.current) startRec();
      }, 280);
    };
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
      setMicError("");
    } catch {
      recRef.current = null;
    }
  }

  useEffect(() => {
    const Ctor =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    if (!Ctor) setSupported(false);
  }, []);

  useEffect(() => {
    if (!active) {
      setPaused(false);
      setMicError("");
      stopRec();
      return;
    }
    const onVis = () => {
      if (document.hidden) stopRec();
      else if (!pausedRef.current) startRec();
    };
    document.addEventListener("visibilitychange", onVis);
    if (!paused) startRec();
    else stopRec();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stopRec();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start/stop are stable enough via refs
  }, [active, paused]);

  return {
    listening,
    supported,
    paused,
    interim,
    micError,
    pause: () => setPaused(true),
    resume: () => setPaused(false),
  };
}
