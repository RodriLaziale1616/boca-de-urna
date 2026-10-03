import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CheckCircle2, LockKeyhole, LogOut, MapPin, Maximize2, RotateCcw, WifiOff, Vote } from "lucide-react";
import { api, setCsrfToken } from "../lib/api";
import type { AuthUser, Candidate } from "../types";

type PendingVote = {
  candidate: Candidate;
  requestId: string;
  capturedAt: string;
};

type QueuedVote = {
  candidateId: string;
  requestId: string;
  capturedAt: string;
  electionId: string;
};

type KioskPayload = {
  election: {
    id: string;
    name: string;
    city: string;
    electionDate: string;
    status: "DRAFT" | "ACTIVE" | "CLOSED";
    requireConfirmation: boolean;
    resetDelaySeconds: number;
    candidates: Candidate[];
  };
  operator: { id: string; name: string };
  pollingPlace: { id: string; name: string; code: string | null } | null;
};

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

export default function OperatorPage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [data, setData] = useState<KioskPayload | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [pendingVote, setPendingVote] = useState<PendingVote | null>(null);
  const [done, setDone] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);
  const syncingRef = useRef(false);

  const kioskCacheKey = `bdu_kiosk:${user.id}`;
  const queueKey = useCallback((electionId: string) => `bdu_vote_queue:${user.id}:${electionId}`, [user.id]);

  const readQueue = useCallback((electionId: string): QueuedVote[] => {
    try {
      const raw = localStorage.getItem(queueKey(electionId));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as QueuedVote[];
      return Array.isArray(parsed) ? parsed.filter(item =>
        item &&
        typeof item.requestId === "string" &&
        typeof item.candidateId === "string" &&
        typeof item.capturedAt === "string" &&
        item.electionId === electionId
      ) : [];
    } catch {
      return [];
    }
  }, [queueKey]);

  const writeQueue = useCallback((electionId: string, queue: QueuedVote[]) => {
    localStorage.setItem(queueKey(electionId), JSON.stringify(queue));
    setQueuedCount(queue.length);
  }, [queueKey]);

  const load = useCallback(async () => {
    try {
      const next = await api<KioskPayload>("/api/operator/election");
      setData(next);
      setQueuedCount(readQueue(next.election.id).length);
      try { localStorage.setItem(kioskCacheKey, JSON.stringify(next)); } catch { /* best effort cache */ }
      setError("");
    } catch (err) {
      try {
        const cached = localStorage.getItem(kioskCacheKey);
        if (cached) {
          const next = JSON.parse(cached) as KioskPayload;
          setData(next);
          setQueuedCount(readQueue(next.election.id).length);
          return;
        }
      } catch {
        // Fall through to the normal error state.
      }
      setError(err instanceof Error ? err.message : "No se pudo preparar la encuesta");
    }
  }, [kioskCacheKey, readQueue]);

  const syncQueue = useCallback(async () => {
    if (!data || !navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);

    try {
      let queue = readQueue(data.election.id).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

      for (const item of queue) {
        if (!navigator.onLine) break;

        try {
          await api<{ ok: true; duplicate?: boolean }>("/api/operator/votes", {
            method: "POST",
            body: JSON.stringify({
              candidateId: item.candidateId,
              requestId: item.requestId,
              capturedAt: item.capturedAt
            })
          });
        } catch (err) {
          const detail = err instanceof Error ? err.message : "No se pudo sincronizar";
          setError(`${queue.length} registro(s) siguen guardados en este dispositivo. ${detail}`);
          break;
        }

        queue = queue.filter(queued => queued.requestId !== item.requestId);
        writeQueue(data.election.id, queue);
        await sleep(750);
      }

      if (queue.length === 0) setError("");
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [data, readQueue, writeQueue]);

  const refreshSession = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const auth = await api<{ user: AuthUser; csrfToken: string }>("/api/auth/me");
      setCsrfToken(auth.csrfToken);
      await load();
      await syncQueue();
    } catch {
      setError("Volvió internet, pero la sesión necesita validarse. Si no sincroniza, salí e ingresá nuevamente; los registros pendientes quedan guardados.");
    }
  }, [load, syncQueue]);

  useEffect(() => {
    load();
    const id = window.setInterval(() => {
      if (navigator.onLine) {
        load();
        void syncQueue();
      }
    }, 30000);
    return () => window.clearInterval(id);
  }, [load, syncQueue]);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      void refreshSession();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!online || !data) return;
    void syncQueue();
    const id = window.setInterval(() => void syncQueue(), 5000);
    return () => window.clearInterval(id);
  }, [online, data, syncQueue]);

  const candidates = useMemo(() => data?.election.candidates.filter(c => !c.isNoResponse) ?? [], [data]);
  const noResponse = data?.election.candidates.find(c => c.isNoResponse);

  async function choose(candidate: Candidate) {
    if (!data || busy || done || data.election.status !== "ACTIVE") return;
    setError("");

    const nextPending: PendingVote = {
      candidate,
      requestId: crypto.randomUUID(),
      capturedAt: new Date().toISOString()
    };
    setPendingVote(nextPending);

    if (data.election.requireConfirmation) setSelected(candidate);
    else await submitVote(nextPending);
  }

  async function submitVote(pending: PendingVote) {
    if (!data || busy) return;
    setBusy(true);
    setError("");

    try {
      const queue = readQueue(data.election.id);
      if (!queue.some(item => item.requestId === pending.requestId)) {
        queue.push({
          candidateId: pending.candidate.id,
          requestId: pending.requestId,
          capturedAt: pending.capturedAt,
          electionId: data.election.id
        });
        writeQueue(data.election.id, queue);
      }

      setSavedOffline(!navigator.onLine);
      setPendingVote(null);
      setSelected(null);
      setDone(true);
      window.setTimeout(() => setDone(false), Math.max(1, data.election.resetDelaySeconds) * 1000);

      if (navigator.onLine) void syncQueue();
    } catch {
      setError("No se pudo guardar este registro en el dispositivo. No continúes hasta recuperar almacenamiento o conexión.");
    } finally {
      setBusy(false);
    }
  }

  function cancelSelection() {
    if (busy) return;
    setPendingVote(null);
    setSelected(null);
  }

  if (!data) return <div className="kiosk-loading"><div className="brand-mark"><Vote size={25}/></div><p>{error || "Preparando encuesta..."}</p><button className="ghost-btn" onClick={load}><RotateCcw size={16}/>Reintentar</button></div>;

  return (
    <div className="kiosk-page">
      <header className="kiosk-header">
        <div className="kiosk-brand"><div className="brand-mark"><Vote size={23}/></div><div><strong>BOCA DE URNA</strong><span>{data.election.city}</span></div></div>
        <div className="operator-header-actions"><button className="operator-logout" onClick={() => document.documentElement.requestFullscreen?.()} title="Pantalla completa"><Maximize2 size={18}/></button><button className="operator-logout" onClick={() => window.confirm(queuedCount ? `Hay ${queuedCount} registro(s) pendiente(s) de sincronizar. ¿Salir igualmente?` : "¿Salir del modo operador?") && onLogout()} title="Salir"><LogOut size={18}/></button></div>
      </header>
      <main className="kiosk-main">
        {!online && <div className="offline-banner"><WifiOff size={16}/> Sin conexión. Podés seguir registrando; los datos quedan guardados en este dispositivo y se enviarán automáticamente al volver internet.</div>}
        {online && queuedCount > 0 && <div className="offline-banner"><RotateCcw size={16}/> {syncing ? "Sincronizando" : "Pendientes de sincronizar"}: {queuedCount}</div>}
        <div className="kiosk-meta-row">
          <div><LockKeyhole size={15}/> Encuesta anónima</div>
          {data.pollingPlace && <div><MapPin size={15}/>{data.pollingPlace.name}</div>}
          {queuedCount > 0 && <div><RotateCcw size={15}/>{queuedCount} pendiente{queuedCount === 1 ? "" : "s"}</div>}
        </div>
        <section className="kiosk-intro">
          <span className={`status-pill status-${data.election.status.toLowerCase()}`}>{data.election.status === "ACTIVE" ? "Encuesta activa" : data.election.status === "DRAFT" ? "Aún no habilitada" : "Encuesta cerrada"}</span>
          <h1>{data.election.name}</h1>
          <p>Toque la opción correspondiente a su voto.</p>
        </section>

        {data.election.status === "ACTIVE" ? <>
          <div className="candidate-grid">
            {candidates.map(candidate => (
              <button key={candidate.id} className="candidate-card" onClick={() => choose(candidate)} disabled={busy || done} style={{ "--candidate": candidate.colorHex } as CSSProperties}>
                <div className="candidate-number">{candidate.ballotNumber || "•"}</div>
                <div className="candidate-copy"><strong>{candidate.name}</strong>{candidate.listLabel && <span>{candidate.listLabel}</span>}{candidate.party && <small>{candidate.party}</small>}</div>
                <div className="candidate-action">Seleccionar</div>
              </button>
            ))}
          </div>
          {noResponse && <button className="no-response-btn" onClick={() => choose(noResponse)} disabled={busy || done} style={{ "--candidate": noResponse.colorHex } as CSSProperties}>{noResponse.name}</button>}
        </> : <div className="closed-card">El administrador debe {data.election.status === "DRAFT" ? "activar" : "reabrir"} la encuesta para registrar respuestas.</div>}

        {error && <div className="kiosk-error">{error}</div>}
        <div className="privacy-line">No se solicita ni almacena ningún dato personal del votante.</div>
      </main>

      {selected && <div className="modal-backdrop"><div className="confirm-card" style={{ "--candidate": selected.colorHex } as CSSProperties}><span>Confirmar respuesta</span><h2>{selected.name}</h2>{selected.listLabel && <p>{selected.listLabel}</p>}<div className="confirm-actions"><button className="ghost-btn" onClick={cancelSelection} disabled={busy}>Volver</button><button className="primary-btn" onClick={() => pendingVote && submitVote(pendingVote)} disabled={busy || !pendingVote}>{busy ? "Guardando..." : "Confirmar"}</button></div></div></div>}
      {done && <div className="modal-backdrop success-backdrop"><div className="success-card"><CheckCircle2 size={54}/><h2>Respuesta registrada</h2><p>{savedOffline ? "Guardada en este dispositivo. Se sincronizará al recuperar internet." : "Muchas gracias por participar."}</p></div></div>}
      <footer className="kiosk-footer">Operador: {user.name}{queuedCount > 0 ? ` · ${queuedCount} pendiente${queuedCount === 1 ? "" : "s"}` : ""}</footer>
    </div>
  );
}
