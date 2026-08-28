import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Clock3, MapPinned, RefreshCw, Users, Vote } from "lucide-react";
import { api } from "../lib/api";
import type { Candidate, Election, Place } from "../types";

type Overview = {
  election: Election | null;
  total: number;
  candidates: (Candidate & { votes: number; percentage: number })[];
  hourly: { hourLabel: string; total: number; candidates: { candidateId: string; votes: number }[] }[];
  operators: { id: string; name: string; username: string; active: boolean; pollingPlace: string | null; votes: number; percentageOfTotal: number; lastVoteAt: string | null; activity: string }[];
};

export default function DashboardPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [electionId, setElectionId] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [placeId, setPlaceId] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    api<{ elections: Election[] }>("/api/admin/elections").then(({ elections }) => {
      setElections(elections);
      const preferred = elections.find(e => e.status === "ACTIVE") ?? elections[0];
      if (preferred) setElectionId(preferred.id);
    });
  }, []);

  useEffect(() => {
    setPlaceId("");
    if (!electionId) return setPlaces([]);
    api<{ places: Place[] }>(`/api/admin/places?electionId=${encodeURIComponent(electionId)}`).then(x => setPlaces(x.places));
  }, [electionId]);

  const refresh = useCallback(async () => {
    if (!electionId) return;
    setLoading(true);
    try {
      const suffix = placeId ? `&pollingPlaceId=${encodeURIComponent(placeId)}` : "";
      const overview = await api<Overview>(`/api/admin/overview?electionId=${encodeURIComponent(electionId)}${suffix}`);
      setData(overview); setUpdatedAt(new Date());
    } finally { setLoading(false); }
  }, [electionId, placeId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!electionId) return;
    const source = new EventSource(`/api/admin/stream?electionId=${encodeURIComponent(electionId)}`, { withCredentials: true });
    source.addEventListener("vote", refresh);
    const fallback = window.setInterval(refresh, 15000);
    return () => { source.close(); window.clearInterval(fallback); };
  }, [electionId, refresh]);

  const visibleCandidates = useMemo(() => data?.candidates.filter(c => c.active || c.votes > 0) ?? [], [data]);
  const operatorActive = data?.operators.filter(o => o.activity === "ACTIVE").length ?? 0;

  return <div className="stack-lg">
    <div className="page-title-row"><div><div className="eyebrow">CENTRO DE CONTROL</div><h1>Resultados en tiempo real</h1><p>Acumulado, cortes por hora y rendimiento de operadores.</p></div><div className="live-badge"><span></span>EN VIVO</div></div>

    <div className="toolbar-card">
      <label>Elección<select value={electionId} onChange={e => setElectionId(e.target.value)}>{elections.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <label>Local<select value={placeId} onChange={e => setPlaceId(e.target.value)}><option value="">Todos los locales</option>{places.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <button className="ghost-btn" onClick={refresh} disabled={loading}><RefreshCw size={16}/>{loading ? "Actualizando" : "Actualizar"}</button>
      <div className="toolbar-update">{updatedAt ? `Actualizado ${updatedAt.toLocaleTimeString("es-PY")}` : ""}</div>
    </div>

    {!data?.election ? <div className="empty-card">Creá una elección desde Configuración para comenzar.</div> : <>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon"><Vote size={18}/></div><div><span>Total encuestados</span><strong>{data.total.toLocaleString("es-PY")}</strong></div></div>
        <div className="stat-card"><div className="stat-icon"><Users size={18}/></div><div><span>Operadores</span><strong>{data.operators.length}</strong></div></div>
        <div className="stat-card"><div className="stat-icon"><Activity size={18}/></div><div><span>Con actividad reciente</span><strong>{operatorActive}</strong></div></div>
        <div className="stat-card"><div className="stat-icon"><MapPinned size={18}/></div><div><span>Filtro actual</span><strong className="stat-small">{placeId ? places.find(p => p.id === placeId)?.name : "General"}</strong></div></div>
      </div>

      <section className="panel-card"><div className="section-head"><div><h2>Resultado acumulado</h2><p>{data.election.name}</p></div><span className={`status-pill status-${data.election.status.toLowerCase()}`}>{data.election.status}</span></div>
        <div className="results-list">{visibleCandidates.map(c => <div className="result-row" key={c.id}><div className="result-id" style={{ background: c.colorHex }}>{c.ballotNumber || (c.isNoResponse ? "—" : "•")}</div><div className="result-main"><div className="result-top"><div><strong>{c.name}</strong><span>{c.listLabel || c.party || ""}</span></div><div className="result-count"><strong>{c.votes.toLocaleString("es-PY")}</strong><span>{c.percentage.toFixed(1).replace(".", ",")}%</span></div></div><div className="progress-track"><div style={{ width: `${Math.min(100, c.percentage)}%`, background: c.colorHex }}/></div></div></div>)}</div>
      </section>

      <section className="panel-card"><div className="section-head"><div><h2><Clock3 size={18}/> Cortes por hora</h2><p>Acumulado automático según hora local de la elección.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Hora</th>{visibleCandidates.map(c => <th key={c.id}>{c.ballotNumber ? `Lista ${c.ballotNumber}` : c.name}</th>)}<th>Total</th></tr></thead><tbody>{data.hourly.length ? data.hourly.map(row => <tr key={row.hourLabel}><td>{row.hourLabel.slice(-5)}</td>{visibleCandidates.map(c => <td key={c.id}>{row.candidates.find(x => x.candidateId === c.id)?.votes ?? 0}</td>)}<td><strong>{row.total}</strong></td></tr>) : <tr><td colSpan={visibleCandidates.length + 2}>Todavía no hay registros.</td></tr>}</tbody></table></div>
      </section>

      <section className="panel-card"><div className="section-head"><div><h2>Rendimiento de operadores</h2><p>Ordenado por cantidad de respuestas registradas.</p></div></div>
        <div className="operator-list">{data.operators.map((o, index) => <div className="operator-row" key={o.id}><div className="rank">{index + 1}</div><div className="operator-name"><strong>{o.name}</strong><span>{o.pollingPlace || "Sin local"} · @{o.username}</span></div><span className={`activity-tag activity-${o.activity.toLowerCase()}`}>{o.activity === "ACTIVE" ? "Activo" : o.activity === "LOW" ? "Sin actividad reciente" : o.activity === "NO_ACTIVITY" ? "Sin registros" : "Deshabilitado"}</span><div className="operator-votes"><strong>{o.votes}</strong><span>encuestas</span></div></div>)}</div>
      </section>
    </>}
  </div>;
}
