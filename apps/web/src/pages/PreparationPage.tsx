import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import type { Election } from "../types";
import "./preparation.css";

type PreparationStatus = {
  official: boolean;
  officialStartedAt: string | null;
  resetLocked: boolean;
  resetLockedAt: string | null;
  votes: number;
  operators: number;
};

export default function PreparationPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [electionId, setElectionId] = useState("");
  const [status, setStatus] = useState<PreparationStatus | null>(null);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [officialText, setOfficialText] = useState("");
  const [officialPassword, setOfficialPassword] = useState("");
  const [lockText, setLockText] = useState("");
  const [lockPassword, setLockPassword] = useState("");
  const [busy, setBusy] = useState<"reset" | "official" | "lock" | null>(null);
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
    setMessage("");
    setResetConfirmed(false);
    setResetPassword("");
    loadStatus(electionId).catch(err => setError(err instanceof Error ? err.message : "No se pudo cargar el estado"));
  }, [electionId]);

  const resetTestData = async () => {
    if (!current || busy || !resetConfirmed || !resetPassword) return;
    setBusy("reset"); setError(""); setMessage("");
    try {
      const result = await api<{ ok: true; removed: { votes: number; operators: number; candidates: number; pollingPlaces: number; election: number } }>(
        `/api/admin/preparation/elections/${current.id}/reset-test-data`,
        { method: "POST", body: JSON.stringify({ confirmation: "RESETAR PRUEBAS", password: resetPassword }) }
      );
      setMessage(`Datos de prueba eliminados: ${result.removed.votes} votos y ${result.removed.operators} operadores. Tu administrador se conserva.`);
      setResetConfirmed(false); setResetPassword(""); setStatus(null);
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
        body: JSON.stringify({ confirmation: officialText.trim().toUpperCase(), password: officialPassword })
      });
      setMessage("Operación oficial iniciada. El reset de pruebas sigue disponible hasta que actives el bloqueo definitivo de producción.");
      setOfficialText(""); setOfficialPassword("");
      await Promise.all([loadElections(current.id), loadStatus(current.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la operación oficial");
    } finally { setBusy(null); }
  };

  const lockProduction = async () => {
    if (!current || busy) return;
    setBusy("lock"); setError(""); setMessage("");
    try {
      await api(`/api/admin/preparation/elections/${current.id}/lock-production`, {
        method: "POST",
        body: JSON.stringify({ confirmation: lockText.trim().toUpperCase(), password: lockPassword })
      });
      setMessage("Protección de producción activada. Desde ahora el reset quedó bloqueado para esta elección.");
      setLockText(""); setLockPassword("");
      await loadStatus(current.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar el bloqueo de producción");
    } finally { setBusy(null); }
  };

  return <div className="stack-lg preparation-page">
    <div className="page-title-row">
      <div><div className="eyebrow">SEGURIDAD OPERATIVA</div><h1>Preparación</h1><p>Probá y limpiá datos libremente; el bloqueo irreversible se activa por separado cuando realmente vayas a producción.</p></div>
    </div>

    {(message || error) && <div className={error ? "form-error" : "form-success"}>{error || message}</div>}

    <section className="panel-card preparation-selector">
      <label>Elección
        <select value={electionId} onChange={e => setElectionId(e.target.value)}>
          <option value="">Seleccionar…</option>
          {elections.map(e => <option key={e.id} value={e.id}>{e.name} · {e.city}</option>)}
        </select>
      </label>
      {current && status && <div className={`prep-mode-badge ${status.resetLocked ? "official" : "testing"}`}>
        {status.resetLocked ? <ShieldCheck size={16}/> : <RotateCcw size={16}/>} 
        <div>
          <strong>{status.resetLocked ? "PRODUCCIÓN BLOQUEADA" : status.official ? "OFICIAL · AÚN RESETEABLE" : "MODO PREPARACIÓN"}</strong>
          <span>{status.resetLocked ? "Reset deshabilitado" : "Los datos todavía pueden limpiarse"}</span>
        </div>
      </div>}
    </section>

    {!current && <div className="empty-card">Primero creá una elección desde Configuración.</div>}

    {current && status && <div className="preparation-grid">
      <section className={`panel-card prep-action-card ${status.resetLocked ? "disabled-card" : "danger-card"}`}>
        <div className="section-head"><div><h2><RotateCcw size={18}/> Resetear datos de prueba</h2><p>Elimina esta elección, sus votos, candidatos, locales y operadores. El usuario administrador se conserva.</p></div></div>
        {status.resetLocked ? <div className="locked-note"><ShieldCheck size={18}/><div><strong>Reset bloqueado</strong><span>Esta elección ya tiene activada la protección definitiva de producción.</span></div></div> : <>
          <div className="prep-stats"><span><strong>{status.votes}</strong> votos</span><span><strong>{status.operators}</strong> operadores</span></div>
          {status.official && <div className="integrity-note">La operación fue marcada como oficial, pero todavía estás en etapa reseteable porque no activaste el bloqueo definitivo.</div>}
          <div className="compact-form">
            <label className="toggle-label"><input type="checkbox" checked={resetConfirmed} onChange={e => setResetConfirmed(e.target.checked)}/><span>Entiendo que se borrarán todos los datos de esta elección de prueba.</span></label>
            <label>Contraseña del administrador<input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} autoComplete="current-password"/></label>
            <button className="danger-btn" disabled={busy !== null || !resetConfirmed || !resetPassword} onClick={resetTestData}>
              <AlertTriangle size={16}/>{busy === "reset" ? "Reseteando…" : "Resetear datos de prueba"}
            </button>
          </div>
        </>}
      </section>

      <section className={`panel-card prep-action-card ${status.official ? "official-card" : "warning-card"}`}>
        <div className="section-head"><div><h2><ShieldCheck size={18}/> Operación oficial</h2><p>Activa la elección para trabajar en vivo, pero ya no bloquea el reset por sí sola.</p></div></div>
        {status.official ? <div className="official-confirmed"><CheckCircle2 size={22}/><div><strong>Operación oficial activa</strong><span>{status.officialStartedAt ? `Iniciada el ${new Date(status.officialStartedAt).toLocaleString("es-PY")}` : "Inicio registrado"}</span></div></div> : <>
          <div className="integrity-note">Requiere al menos un candidato y un operador activo. Mientras no actives la protección definitiva de producción, todavía podrás resetear datos si estás probando.</div>
          <div className="compact-form">
            <label>Escribí <b>INICIAR OFICIAL</b><input value={officialText} onChange={e => setOfficialText(e.target.value)} autoComplete="off" placeholder="INICIAR OFICIAL"/></label>
            <label>Contraseña del administrador<input type="password" value={officialPassword} onChange={e => setOfficialPassword(e.target.value)} autoComplete="current-password"/></label>
            <button className="official-btn" disabled={busy !== null || officialText.trim().toUpperCase() !== "INICIAR OFICIAL" || !officialPassword} onClick={startOfficial}>
              <ShieldCheck size={16}/>{busy === "official" ? "Activando…" : "Iniciar operación oficial"}
            </button>
          </div>
        </>}
      </section>

      {status.official && <section className={`panel-card prep-action-card ${status.resetLocked ? "disabled-card" : "warning-card"}`}>
        <div className="section-head"><div><h2><AlertTriangle size={18}/> Bloqueo definitivo de producción</h2><p>Este es el paso irreversible. Hacelo solo cuando hayan terminado todas las pruebas.</p></div></div>
        {status.resetLocked ? <div className="official-confirmed"><CheckCircle2 size={22}/><div><strong>Protección definitiva activa</strong><span>{status.resetLockedAt ? `Activada el ${new Date(status.resetLockedAt).toLocaleString("es-PY")}` : "Reset bloqueado"}</span></div></div> : <>
          <div className="integrity-note">Después de confirmar esto, el administrador ya no podrá borrar los votos de esta elección desde la aplicación.</div>
          <div className="compact-form">
            <label>Escribí <b>BLOQUEAR PRODUCCION</b><input value={lockText} onChange={e => setLockText(e.target.value)} autoComplete="off" placeholder="BLOQUEAR PRODUCCION"/></label>
            <label>Contraseña del administrador<input type="password" value={lockPassword} onChange={e => setLockPassword(e.target.value)} autoComplete="current-password"/></label>
            <button className="danger-btn" disabled={busy !== null || lockText.trim().toUpperCase() !== "BLOQUEAR PRODUCCION" || !lockPassword} onClick={lockProduction}>
              <AlertTriangle size={16}/>{busy === "lock" ? "Bloqueando…" : "Bloquear definitivamente"}
            </button>
          </div>
        </>}
      </section>}
    </div>}
  </div>;
}
