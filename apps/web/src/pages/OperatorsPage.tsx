import { useEffect, useMemo, useState, type FormEvent } from "react";
import { KeyRound, Plus, Power, Users } from "lucide-react";
import { api } from "../lib/api";
import type { Election, Operator, Place } from "../types";

export default function OperatorsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [electionId, setElectionId] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [form, setForm] = useState({ name: "", username: "", password: "", pollingPlaceId: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { api<{ elections: Election[] }>("/api/admin/elections").then(x => { setElections(x.elections); const e = x.elections.find(v => v.status === "ACTIVE") ?? x.elections[0]; if (e) setElectionId(e.id); }); }, []);

  const load = async (id = electionId) => {
    if (!id) return;
    const [p, o] = await Promise.all([
      api<{ places: Place[] }>(`/api/admin/places?electionId=${encodeURIComponent(id)}`),
      api<{ operators: Operator[] }>(`/api/admin/operators?electionId=${encodeURIComponent(id)}`)
    ]);
    setPlaces(p.places); setOperators(o.operators);
  };
  useEffect(() => { setForm(f => ({ ...f, pollingPlaceId: "" })); load(electionId); }, [electionId]);

  const activePlaces = useMemo(() => places.filter(p => p.active), [places]);

  async function create(e: FormEvent) {
    e.preventDefault(); setError(""); setMessage("");
    try {
      await api("/api/admin/operators", { method: "POST", body: JSON.stringify({ ...form, assignedElectionId: electionId, pollingPlaceId: form.pollingPlaceId || null }) });
      setForm({ name: "", username: "", password: "", pollingPlaceId: "" }); setMessage("Operador creado."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo crear"); }
  }

  async function toggle(operator: Operator) {
    await api(`/api/admin/operators/${operator.id}`, { method: "PATCH", body: JSON.stringify({ active: !operator.active }) }); await load();
  }

  async function resetPassword(operator: Operator) {
    const password = window.prompt(`Nueva contraseña para ${operator.name} (mín. 8 caracteres)`);
    if (!password) return;
    try { await api(`/api/admin/operators/${operator.id}`, { method: "PATCH", body: JSON.stringify({ password }) }); setMessage("Contraseña actualizada y sesiones anteriores cerradas."); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo cambiar"); }
  }

  return <div className="stack-lg"><div className="page-title-row"><div><div className="eyebrow">OPERACIÓN</div><h1>Operadores</h1><p>Usuarios limitados exclusivamente al registro de respuestas.</p></div></div>
    <div className="toolbar-card"><label>Elección<select value={electionId} onChange={e => setElectionId(e.target.value)}>{elections.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label></div>

    <div className="two-col-grid">
      <form className="panel-card compact-form" onSubmit={create}><div className="section-head"><div><h2><Plus size={18}/> Nuevo operador</h2><p>Asignalo a una elección y, de ser posible, a un local.</p></div></div>
        <label>Nombre<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Juan Pérez" required /></label>
        <label>Usuario<input value={form.username} onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="juan.perez" required /></label>
        <label>Contraseña inicial<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={8} required /></label>
        <label>Local<select value={form.pollingPlaceId} onChange={e => setForm({ ...form, pollingPlaceId: e.target.value })}><option value="">Sin local</option>{activePlaces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {error && <div className="form-error">{error}</div>}{message && <div className="form-success">{message}</div>}
        <button className="primary-btn"><Users size={17}/>Crear operador</button>
      </form>

      <section className="panel-card"><div className="section-head"><div><h2>Usuarios habilitados</h2><p>{operators.length} operadores en esta elección.</p></div></div>
        <div className="compact-list">{operators.map(o => <div className="compact-list-row" key={o.id}><div><strong>{o.name}</strong><span>@{o.username} · {o.pollingPlace?.name || "Sin local"}</span></div><div className="row-actions"><span className={`status-pill ${o.active ? "status-active" : "status-closed"}`}>{o.active ? "Activo" : "Bloqueado"}</span><button className="icon-btn" title="Cambiar contraseña" onClick={() => resetPassword(o)}><KeyRound size={16}/></button><button className="icon-btn" title={o.active ? "Bloquear" : "Habilitar"} onClick={() => toggle(o)}><Power size={16}/></button></div></div>)}{!operators.length && <div className="empty-inline">Todavía no hay operadores.</div>}</div>
      </section>
    </div>
  </div>;
}
