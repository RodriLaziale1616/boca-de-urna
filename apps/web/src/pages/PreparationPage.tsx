import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import type { Election } from "../types";
import "./preparation.css";

type PreparationStatus = {
  official: boolean;
  officialStartedAt: string | null;
  votes: number;
  operators: number;
};

export default function PreparationPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [electionId, setElectionId] = useState("");
  const [status, setStatus] = useState<PreparationStatus | null>(null);
  const [resetText, setResetText] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [officialText, setOfficialText] = useState("");
  const [officialPassword, setOfficialPassword] = useState("");
  const [busy, setBusy] = useState<"reset" | "official" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const current = useMemo(() => elections.find(e => e.id === electionId) ?? null, [elections, electionId]);

  const loadElections = async (preferred?: string) => {
    const data = await api<{ elections: Election[] }>("/api/admin/elections");
    setElections(data.elections);
    const next = preferred && data.elections.some(e => e.id === preferred)
      ? preferred
      : (data.elections.find(e => e.status === "ACTIVE") ?? data.elections[0])?.id ?? "";
    setElectionId(next);
    if (!next) setStatus(null);
  };

  const loadStatus = async (id: string) => {
    const next = await api<PreparationStatus>(`/api/admin/preparation/elections/${id}/status`);
    setStatus(next);
  };

  useEffect(() => {
    loadElections().catch(err => setError(err instanceof Error ? err.message : "No se pudo cargar"));
  }, []);

  useEffect(() => {
    if (!electionId) return;
    setStatus(null);
    setError("");
    loadStatus(electionId).catch(err => setError(err instanceof Error ? err.message : "No se pudo cargar el estado"));
  }, [electionId]);

  const resetTestData = async () => {
    if (!current || busy) return;
    setBusy("reset"); setError(""); setMessage("");
    try {
      const result = await api<{ ok: true; removed: { votes: number; operators: number; candidates: number; pollingPlaces: number; election: number } }>(
        `/api/admin/preparation/elections/${current.id}/reset-test-data`,
        { method: "POST", body: JSON.stringify({ confirmation: resetText, password: resetPassword }) }
      );
      setMessage(`Datos de prueba eliminados: ${result.removed.votes} votos y ${result.removed.operators} operadores. Tu administrador se conserva.`);
      setResetText(""); setResetPassword(""); setStatus(null);
      await loadElections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo resetear");
    } finally { setBusy(null); }
  };

  const startOfficial = async () => {
    if (!current || busy) return;
    setBusy("official"); setError(""); setMessage("");
    try {
      await api(`/api/admin/preparation/elections/${current.id}/start-official`, {
        method: "POST",
        body: JSON.stringify({ confirmation: officialText, password: officialPassword })
      });
      setMessage("Operación oficial iniciada. El reset de esta elección quedó bloqueado permanentemente.");
      setOfficialText(""); setOfficialPassword("");
      await Promise.all([loadElections(current.id), loadStatus(current.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la operación oficial");
    } finally { setBusy(null); }
  };

  return <div className="stack-lg preparation-page">
    <div className="page-title-row">
      <div><div className="eyebrow">SEGURIDAD OPERATIVA</div><h1>Preparación</h1><p>Probá el sistema libremente y bloqueá el borrado cuando comience la operación real.</p></div>
    </div>

    {(message || error) && <div className={error ? "form-error" : "form-success"}>{error || message}</div>}

    <section className="panel-card preparation-selector">
      <label>Elección
        <select value={electionId} onChange={e => setElectionId(e.target.value)}>
          <option value="">Seleccionar…</option>
          {elections.map(e => <option key={e.id} value={e.id}>{e.name} · {e.city}</option>)}
        </select>
      </label>
      {current && status && <div className={`prep-mode-badge ${status.official ? "official" : "testing"}`}>
        {status.official ? <ShieldCheck size={16}/> : <RotateCcw size={16}/>} 
        <div><strong>{status.official ? "OPERACIÓN OFICIAL" : "MODO PREPARACIÓN"}</strong><span>{status.official ? "Reset bloqueado" : "Datos de prueba reseteables"}</span></div>
      </div>}
    </section>

    {!current && <div className="empty-card">Primero creá una elección desde Configuración.</div>}

    {current && status && <div className="preparation-grid">
      <section className={`panel-card prep-action-card ${status.official ? "disabled-card" : "danger-card"}`}>
        <div className="section-head"><div><h2><RotateCcw size={18}/> Resetear datos de prueba</h2><p>Elimina esta elección, sus votos, candidatos, locales y operadores. El usuario administrador se conserva.</p></div></div>
        {status.official ? <div className="locked-note"><ShieldCheck size={18}/><div><strong>Reset bloqueado</strong><span>Esta elección ya fue iniciada como operación oficial y sus votos no pueden borrarse desde el sistema.</span></div></div> : <>
          <div className="prep-stats"><span><strong>{status.votes}</strong> votos de prueba</span><span><strong>{status.operators}</strong> operadores</span></div>
          <div className="integrity-note">Para evitar un borrado accidental, se exige tu contraseña y una frase de confirmación exacta.</div>
          <div className="compact-form">
            <label>Escribí <b>RESETAR PRUEBAS</b><input value={resetText} onChange={e => setResetText(e.target.value)} autoComplete="off" placeholder="RESETAR PRUEBAS"/></label>
            <label>Contraseña del administrador<input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} autoComplete="current-password"/></label>
            <button className="danger-btn" disabled={busy !== null || resetText !== "RESETAR PRUEBAS" || !resetPassword} onClick={resetTestData}>
              <AlertTriangle size={16}/>{busy === "reset" ? "Reseteando…" : "Resetear datos de prueba"}
            </button>
          </div>
        </>}
      </section>

      <section className={`panel-card prep-action-card ${status.official ? "official-card" : "warning-card"}`}>
        <div className="section-head"><div><h2><ShieldCheck size={18}/> Operación oficial</h2><p>Usá esta acción únicamente cuando terminen las pruebas y comience la boca de urna real.</p></div></div>
        {status.official ? <div className="official-confirmed"><CheckCircle2 size={22}/><div><strong>Operación oficial activa</strong><span>{status.officialStartedAt ? `Iniciada el ${new Date(status.officialStartedAt).toLocaleString("es-PY")}` : "Inicio registrado"}</span></div></div> : <>
          <div className="integrity-note">Esta acción activa la elección y crea un bloqueo permanente del reset para esta elección. Requiere al menos un candidato y un operador activo.</div>
          <div className="compact-form">
            <label>Escribí <b>INICIAR OFICIAL</b><input value={officialText} onChange={e => setOfficialText(e.target.value)} autoComplete="off" placeholder="INICIAR OFICIAL"/></label>
            <label>Contraseña del administrador<input type="password" value={officialPassword} onChange={e => setOfficialPassword(e.target.value)} autoComplete="current-password"/></label>
            <button className="official-btn" disabled={busy !== null || officialText !== "INICIAR OFICIAL" || !officialPassword} onClick={startOfficial}>
              <ShieldCheck size={16}/>{busy === "official" ? "Activando…" : "Iniciar operación oficial"}
            </button>
          </div>
        </>}
      </section>
    </div>}
  </div>;
}
