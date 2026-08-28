import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MapPin, Plus, Settings2, Vote } from "lucide-react";
import { api } from "../lib/api";
import type { Candidate, Election, Place } from "../types";

function CandidateEditor({ candidate, onSave, onToggle, locked }: { candidate: Candidate; onSave: (id: string, patch: Partial<Candidate>) => Promise<void>; onToggle: (id: string, active: boolean) => Promise<void>; locked: boolean }) {
  const [draft, setDraft] = useState({
    name: candidate.name,
    listLabel: candidate.listLabel ?? "",
    party: candidate.party ?? "",
    ballotNumber: candidate.ballotNumber ?? "",
    colorHex: candidate.colorHex
  });

  useEffect(() => {
    setDraft({
      name: candidate.name,
      listLabel: candidate.listLabel ?? "",
      party: candidate.party ?? "",
      ballotNumber: candidate.ballotNumber ?? "",
      colorHex: candidate.colorHex
    });
  }, [candidate.id, candidate.name, candidate.listLabel, candidate.party, candidate.ballotNumber, candidate.colorHex]);

  const save = async () => {
    await onSave(candidate.id, {
      name: draft.name.trim() || candidate.name,
      listLabel: draft.listLabel.trim() || null,
      party: draft.party.trim() || null,
      ballotNumber: draft.ballotNumber.trim() || null,
      colorHex: draft.colorHex
    });
  };

  return <details className="candidate-editor">
    <summary className="candidate-config-row">
      <span className="candidate-color-dot" style={{ background: candidate.colorHex }} />
      <div><strong>{candidate.name}</strong><span>{candidate.isNoResponse ? "Opción especial" : [candidate.ballotNumber && `Lista ${candidate.ballotNumber}`, candidate.party].filter(Boolean).join(" · ") || "Sin datos adicionales"}</span></div>
      {!candidate.isNoResponse && <span className={`mini-toggle ${candidate.active ? "on" : ""}`}>{candidate.active ? "Visible" : "Oculto"}</span>}
    </summary>
    <div className="candidate-editor-body">
      <label>Nombre<input value={draft.name} disabled={locked} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
      {!candidate.isNoResponse && <div className="form-row-2"><label>Número<input value={draft.ballotNumber} disabled={locked} onChange={e => setDraft({ ...draft, ballotNumber: e.target.value })}/></label><label>Lista / etiqueta<input value={draft.listLabel} disabled={locked} onChange={e => setDraft({ ...draft, listLabel: e.target.value })}/></label></div>}
      {!candidate.isNoResponse && <label>Partido<input value={draft.party} disabled={locked} onChange={e => setDraft({ ...draft, party: e.target.value })}/></label>}
      <label>Color<input type="color" value={draft.colorHex} disabled={locked} onChange={e => setDraft({ ...draft, colorHex: e.target.value })}/></label>
      <div className="row-actions">
        <button className="ghost-btn" type="button" disabled={locked} onClick={save}>Guardar cambios</button>
        {!candidate.isNoResponse && <button className={`mini-toggle ${candidate.active ? "on" : ""}`} type="button" disabled={locked} onClick={() => onToggle(candidate.id, !candidate.active)}>{candidate.active ? "Ocultar" : "Mostrar"}</button>}
      </div>
    </div>
  </details>;
}

export default function SettingsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [electionId, setElectionId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [newElection, setNewElection] = useState({ name: "", city: "Hernandarias", electionDate: new Date().toISOString().slice(0,10), timezone: "America/Asuncion" });
  const [newCandidate, setNewCandidate] = useState({ name: "", listLabel: "", party: "", ballotNumber: "", colorHex: "#D96570", sortOrder: 0 });
  const [newPlace, setNewPlace] = useState({ name: "", code: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const current = useMemo(() => elections.find(e => e.id === electionId) ?? null, [elections, electionId]);

  const loadElections = async (preferred?: string) => {
    const { elections } = await api<{ elections: Election[] }>("/api/admin/elections");
    setElections(elections);
    if (preferred) setElectionId(preferred);
    else if (!electionId && elections.length) setElectionId((elections.find(e => e.status === "ACTIVE") ?? elections[0]).id);
  };
  useEffect(() => { loadElections(); }, []);
  useEffect(() => {
    if (!electionId) { setCandidates([]); setPlaces([]); return; }
    Promise.all([
      api<{ candidates: Candidate[] }>(`/api/admin/candidates?electionId=${electionId}`),
      api<{ places: Place[] }>(`/api/admin/places?electionId=${electionId}`)
    ]).then(([c, p]) => { setCandidates(c.candidates); setPlaces(p.places); });
  }, [electionId]);

  const reloadCurrent = async () => {
    if (!electionId) return;
    const [c, p] = await Promise.all([
      api<{ candidates: Candidate[] }>(`/api/admin/candidates?electionId=${electionId}`),
      api<{ places: Place[] }>(`/api/admin/places?electionId=${electionId}`)
    ]);
    setCandidates(c.candidates); setPlaces(p.places); await loadElections(electionId);
  };

  async function createElection(e: FormEvent) {
    e.preventDefault(); setError(""); setMessage("");
    try {
      const result = await api<{ election: Election }>("/api/admin/elections", { method: "POST", body: JSON.stringify({ ...newElection, electionDate: `${newElection.electionDate}T12:00:00.000Z` }) });
      setNewElection(v => ({ ...v, name: "" })); setMessage("Elección creada."); await loadElections(result.election.id);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  async function updateElection(patch: Partial<Election>) {
    if (!current) return;
    try { await api(`/api/admin/elections/${current.id}`, { method: "PATCH", body: JSON.stringify(patch) }); setMessage("Configuración actualizada."); await reloadCurrent(); }
    catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  async function addCandidate(e: FormEvent) {
    e.preventDefault(); if (!current) return;
    try { await api("/api/admin/candidates", { method: "POST", body: JSON.stringify({ ...newCandidate, electionId: current.id, listLabel: newCandidate.listLabel || null, party: newCandidate.party || null, ballotNumber: newCandidate.ballotNumber || null }) }); setNewCandidate({ name: "", listLabel: "", party: "", ballotNumber: "", colorHex: "#D96570", sortOrder: candidates.length }); setMessage("Candidato agregado."); await reloadCurrent(); }
    catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  async function patchCandidate(id: string, patch: Partial<Candidate>) { await api(`/api/admin/candidates/${id}`, { method: "PATCH", body: JSON.stringify(patch) }); await reloadCurrent(); }
  async function addPlace(e: FormEvent) { e.preventDefault(); if (!current) return; await api("/api/admin/places", { method: "POST", body: JSON.stringify({ electionId: current.id, name: newPlace.name, code: newPlace.code || null }) }); setNewPlace({ name: "", code: "" }); await reloadCurrent(); }
  async function togglePlace(p: Place) { await api(`/api/admin/places/${p.id}`, { method: "PATCH", body: JSON.stringify({ active: !p.active }) }); await reloadCurrent(); }

  return <div className="stack-lg"><div className="page-title-row"><div><div className="eyebrow">SISTEMA</div><h1>Configuración</h1><p>Elecciones, candidatos, colores, locales y reglas de la pantalla del operador.</p></div></div>
    {(message || error) && <div className={error ? "form-error" : "form-success"}>{error || message}</div>}

    <section className="panel-card"><div className="section-head"><div><h2><Vote size={18}/> Elección</h2><p>Podés reutilizar el sistema para futuras elecciones sin tocar código.</p></div></div>
      <div className="settings-election-row"><label>Seleccionar<select value={electionId} onChange={e => setElectionId(e.target.value)}><option value="">—</option>{elections.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>{current && <div className="status-control"><span>Estado</span><div className="segmented"><button className={current.status === "DRAFT" ? "selected" : ""} onClick={() => updateElection({ status: "DRAFT" })}>Borrador</button><button className={current.status === "ACTIVE" ? "selected" : ""} onClick={() => updateElection({ status: "ACTIVE" })}>Activa</button><button className={current.status === "CLOSED" ? "selected" : ""} onClick={() => updateElection({ status: "CLOSED" })}>Cerrada</button></div></div>}</div>
      {current && <div className="settings-grid"><label>Nombre<input value={current.name} onChange={e => setElections(xs => xs.map(x => x.id === current.id ? { ...x, name: e.target.value } : x))} onBlur={() => updateElection({ name: current.name })}/></label><label>Ciudad<input value={current.city} onChange={e => setElections(xs => xs.map(x => x.id === current.id ? { ...x, city: e.target.value } : x))} onBlur={() => updateElection({ city: current.city })}/></label><label>Fecha<input type="date" value={current.electionDate.slice(0,10)} onChange={e => updateElection({ electionDate: `${e.target.value}T12:00:00.000Z` })}/></label><label>Zona horaria<input value={current.timezone} onChange={e => setElections(xs => xs.map(x => x.id === current.id ? { ...x, timezone: e.target.value } : x))} onBlur={() => updateElection({ timezone: current.timezone })}/></label><label className="toggle-label"><input type="checkbox" checked={current.requireConfirmation} onChange={e => updateElection({ requireConfirmation: e.target.checked })}/><span>Confirmar antes de guardar</span></label><label>Retorno automático<select value={current.resetDelaySeconds} onChange={e => updateElection({ resetDelaySeconds: Number(e.target.value) })}>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n} segundos</option>)}</select></label></div>}
      {!current && <form className="inline-create-grid" onSubmit={createElection}><input placeholder="Nombre de la elección" value={newElection.name} onChange={e => setNewElection({ ...newElection, name: e.target.value })} required/><input placeholder="Ciudad" value={newElection.city} onChange={e => setNewElection({ ...newElection, city: e.target.value })} required/><input type="date" value={newElection.electionDate} onChange={e => setNewElection({ ...newElection, electionDate: e.target.value })} required/><button className="primary-btn"><Plus size={16}/>Crear elección</button></form>}
      {current && <details className="new-election-details"><summary>Crear otra elección</summary><form className="inline-create-grid" onSubmit={createElection}><input placeholder="Nombre" value={newElection.name} onChange={e => setNewElection({ ...newElection, name: e.target.value })} required/><input placeholder="Ciudad" value={newElection.city} onChange={e => setNewElection({ ...newElection, city: e.target.value })} required/><input type="date" value={newElection.electionDate} onChange={e => setNewElection({ ...newElection, electionDate: e.target.value })} required/><button className="ghost-btn"><Plus size={16}/>Crear</button></form></details>}
    </section>

    {current && <div className="two-col-grid">
      <section className="panel-card"><div className="section-head"><div><h2><Settings2 size={18}/> Candidatos</h2><p>Nombre, lista y color visibles en el kiosco.</p></div></div>
        {current.status !== "DRAFT" && <div className="integrity-note">Configuración bloqueada para preservar la integridad. Los candidatos solo se editan antes de activar la elección.</div>}
        <div className="candidate-config-list">{candidates.map(c => <CandidateEditor key={c.id} candidate={c} locked={current.status !== "DRAFT"} onSave={patchCandidate} onToggle={(id, active) => patchCandidate(id, { active })}/>)}</div>
        <form className="compact-form inset-form" onSubmit={addCandidate} aria-disabled={current.status !== "DRAFT"}><div className="form-row-2"><label>Nombre<input value={newCandidate.name} onChange={e => setNewCandidate({ ...newCandidate, name: e.target.value })} required/></label><label>Número<input value={newCandidate.ballotNumber} onChange={e => setNewCandidate({ ...newCandidate, ballotNumber: e.target.value })}/></label></div><label>Lista / etiqueta<input value={newCandidate.listLabel} onChange={e => setNewCandidate({ ...newCandidate, listLabel: e.target.value })} placeholder="Lista 1"/></label><label>Partido<input value={newCandidate.party} onChange={e => setNewCandidate({ ...newCandidate, party: e.target.value })}/></label><div className="form-row-2"><label>Color<input type="color" value={newCandidate.colorHex} onChange={e => setNewCandidate({ ...newCandidate, colorHex: e.target.value })}/></label><label>Orden<input type="number" value={newCandidate.sortOrder} onChange={e => setNewCandidate({ ...newCandidate, sortOrder: Number(e.target.value) })}/></label></div><button className="primary-btn" disabled={current.status !== "DRAFT"}><Plus size={16}/>Agregar candidato</button></form>
      </section>

      <section className="panel-card"><div className="section-head"><div><h2><MapPin size={18}/> Locales</h2><p>Permiten segmentar resultados y controlar actividad de campo.</p></div></div>
        <div className="compact-list">{places.map(p => <div className="compact-list-row" key={p.id}><div><strong>{p.name}</strong><span>{p.code || "Sin código"}</span></div><button className={`mini-toggle ${p.active ? "on" : ""}`} onClick={() => togglePlace(p)}>{p.active ? "Activo" : "Inactivo"}</button></div>)}</div>
        <form className="compact-form inset-form" onSubmit={addPlace}><label>Nombre<input value={newPlace.name} onChange={e => setNewPlace({ ...newPlace, name: e.target.value })} placeholder="Colegio Nacional" required/></label><label>Código opcional<input value={newPlace.code} onChange={e => setNewPlace({ ...newPlace, code: e.target.value })} placeholder="LOC-01"/></label><button className="primary-btn"><Plus size={16}/>Agregar local</button></form>
      </section>
    </div>}
  </div>;
}
