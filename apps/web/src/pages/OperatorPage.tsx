import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { CheckCircle2, LockKeyhole, LogOut, MapPin, Maximize2, RotateCcw, WifiOff, Vote } from "lucide-react";
import { api } from "../lib/api";
import type { AuthUser, Candidate } from "../types";

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

export default function OperatorPage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [data, setData] = useState<KioskPayload | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);

  const load = () => api<KioskPayload>("/api/operator/election").then(setData).catch(err => setError(err.message));
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const candidates = useMemo(() => data?.election.candidates.filter(c => !c.isNoResponse) ?? [], [data]);
  const noResponse = data?.election.candidates.find(c => c.isNoResponse);

  async function choose(candidate: Candidate) {
    if (!data || busy || done || !online || data.election.status !== "ACTIVE") return;
    setError("");
    if (data.election.requireConfirmation) setSelected(candidate);
    else await submitVote(candidate);
  }

  async function submitVote(candidate: Candidate) {
    setBusy(true); setError("");
    try {
      await api<{ ok: true }>("/api/operator/votes", {
        method: "POST",
        body: JSON.stringify({ candidateId: candidate.id, requestId: crypto.randomUUID() })
      });
      setSelected(null); setDone(true);
      window.setTimeout(() => setDone(false), Math.max(1, data?.election.resetDelaySeconds ?? 2) * 1000);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo registrar"); }
    finally { setBusy(false); }
  }

  if (!data) return <div className="kiosk-loading"><div className="brand-mark"><Vote size={25}/></div><p>{error || "Preparando encuesta..."}</p><button className="ghost-btn" onClick={load}><RotateCcw size={16}/>Reintentar</button></div>;

  return (
    <div className="kiosk-page">
      <header className="kiosk-header">
        <div className="kiosk-brand"><div className="brand-mark"><Vote size={23}/></div><div><strong>BOCA DE URNA</strong><span>{data.election.city}</span></div></div>
        <div className="operator-header-actions"><button className="operator-logout" onClick={() => document.documentElement.requestFullscreen?.()} title="Pantalla completa"><Maximize2 size={18}/></button><button className="operator-logout" onClick={() => window.confirm("¿Salir del modo operador?") && onLogout()} title="Salir"><LogOut size={18}/></button></div>
      </header>
      <main className="kiosk-main">
        {!online && <div className="offline-banner"><WifiOff size={16}/> Sin conexión. El registro queda bloqueado hasta recuperar internet.</div>}
        <div className="kiosk-meta-row">
          <div><LockKeyhole size={15}/> Encuesta anónima</div>
          {data.pollingPlace && <div><MapPin size={15}/>{data.pollingPlace.name}</div>}
        </div>
        <section className="kiosk-intro">
          <span className={`status-pill status-${data.election.status.toLowerCase()}`}>{data.election.status === "ACTIVE" ? "Encuesta activa" : data.election.status === "DRAFT" ? "Aún no habilitada" : "Encuesta cerrada"}</span>
          <h1>{data.election.name}</h1>
          <p>Toque la opción correspondiente a su voto.</p>
        </section>

        {data.election.status === "ACTIVE" ? <>
          <div className="candidate-grid">
            {candidates.map(candidate => (
              <button key={candidate.id} className="candidate-card" onClick={() => choose(candidate)} disabled={busy || done || !online} style={{ "--candidate": candidate.colorHex } as CSSProperties}>
                <div className="candidate-number">{candidate.ballotNumber || "•"}</div>
                <div className="candidate-copy"><strong>{candidate.name}</strong>{candidate.listLabel && <span>{candidate.listLabel}</span>}{candidate.party && <small>{candidate.party}</small>}</div>
                <div className="candidate-action">Seleccionar</div>
              </button>
            ))}
          </div>
          {noResponse && <button className="no-response-btn" onClick={() => choose(noResponse)} disabled={busy || done || !online} style={{ "--candidate": noResponse.colorHex } as CSSProperties}>{noResponse.name}</button>}
        </> : <div className="closed-card">El administrador debe {data.election.status === "DRAFT" ? "activar" : "reabrir"} la encuesta para registrar respuestas.</div>}

        {error && <div className="kiosk-error">{error}</div>}
        <div className="privacy-line">No se solicita ni almacena ningún dato personal del votante.</div>
      </main>

      {selected && <div className="modal-backdrop"><div className="confirm-card" style={{ "--candidate": selected.colorHex } as CSSProperties}><span>Confirmar respuesta</span><h2>{selected.name}</h2>{selected.listLabel && <p>{selected.listLabel}</p>}<div className="confirm-actions"><button className="ghost-btn" onClick={() => setSelected(null)} disabled={busy}>Volver</button><button className="primary-btn" onClick={() => submitVote(selected)} disabled={busy}>{busy ? "Registrando..." : "Confirmar"}</button></div></div></div>}
      {done && <div className="modal-backdrop success-backdrop"><div className="success-card"><CheckCircle2 size={54}/><h2>Respuesta registrada</h2><p>Muchas gracias por participar.</p></div></div>}
      <footer className="kiosk-footer">Operador: {user.name}</footer>
    </div>
  );
}
