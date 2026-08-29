import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Clock3, Radio, Users } from "lucide-react";
import type { TvData } from "../types";
import "./tv.css";

function pct(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export default function TvStage({ data, preview = false }: { data: TvData; preview?: boolean }) {
  const [now, setNow] = useState(new Date());
  const election = data.election;

  useEffect(() => {
    if (!election.tvShowClock) return;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [election.tvShowClock]);

  const lastCuts = useMemo(() => data.hourly.slice(-5).reverse(), [data.hourly]);
  const topCandidates = useMemo(() => data.candidates.filter(c => !c.isNoResponse).slice(0, 6), [data.candidates]);
  const noResponse = data.candidates.find(c => c.isNoResponse);

  const style = {
    "--tv-primary": election.brandPrimaryColor,
    "--tv-secondary": election.brandSecondaryColor,
    "--tv-bg": election.brandBackgroundColor,
    "--tv-surface": election.brandSurfaceColor,
    "--tv-text": election.brandTextColor
  } as CSSProperties;

  return <div className={`tv-stage ${preview ? "tv-stage-preview" : ""}`} style={style}>
    <div className="tv-glow tv-glow-a"/><div className="tv-glow tv-glow-b"/>
    <header className="tv-header">
      <div className="tv-brand">
        {election.brandLogoData ? <img src={election.brandLogoData} alt="Logo"/> : <div className="tv-brand-fallback"><Radio size={26}/></div>}
        <div><strong>{election.brandName || "Boca de Urna"}</strong><span>{election.brandSubtitle || "Resultados en tiempo real"}</span></div>
      </div>
      <div className="tv-header-center">
        <span className="tv-kicker">BOCA DE URNA</span>
        <strong>{election.city}</strong>
      </div>
      <div className="tv-live-cluster">
        <div className="tv-live-pill"><span/>EN VIVO</div>
        {election.tvShowClock && <div className="tv-clock"><Clock3 size={15}/>{now.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>}
      </div>
    </header>

    <main className="tv-main">
      <section className="tv-results-panel">
        <div className="tv-section-title"><div><span>RESULTADO ACUMULADO</span><strong>{election.name}</strong></div>{election.tvShowTotal && <div className="tv-total"><Users size={20}/><div><strong>{data.total.toLocaleString("es-PY")}</strong><span>encuestados</span></div></div>}</div>
        <div className={`tv-candidates tv-candidates-${Math.min(topCandidates.length, 6)}`}>
          {topCandidates.map((candidate, index) => <article className="tv-candidate" key={candidate.id}>
            <div className="tv-candidate-id" style={{ background: candidate.colorHex }}>{candidate.ballotNumber || index + 1}</div>
            <div className="tv-candidate-content">
              <div className="tv-candidate-top"><div><strong>{candidate.name}</strong><span>{candidate.listLabel || candidate.party || ""}</span></div><div className="tv-candidate-numbers"><strong>{pct(candidate.percentage)}</strong><span>{candidate.votes.toLocaleString("es-PY")} votos</span></div></div>
              <div className="tv-progress"><div style={{ width: `${Math.min(100, candidate.percentage)}%`, background: candidate.colorHex }}/></div>
            </div>
          </article>)}
        </div>
        {noResponse && <div className="tv-no-response"><span>No responde</span><strong>{noResponse.votes?.toLocaleString("es-PY") ?? 0}</strong><b>{pct(noResponse.percentage ?? 0)}</b></div>}
      </section>

      <aside className="tv-cuts-panel">
        <div className="tv-cuts-head"><span>CORTES POR HORA</span><strong>Últimos cortes</strong></div>
        <div className="tv-cuts-list">
          {lastCuts.length ? lastCuts.map((cut, cutIndex) => <div className={`tv-cut ${cutIndex === 0 ? "latest" : ""}`} key={cut.hourLabel}>
            <div className="tv-cut-hour"><strong>{cut.hourLabel.slice(-5)}</strong><span>{cutIndex === 0 ? "ÚLTIMO" : "CORTE"}</span></div>
            <div className="tv-cut-values">
              {topCandidates.slice(0, 3).map(candidate => <div key={candidate.id}><span style={{ background: candidate.colorHex }}/><b>{cut.candidates.find(x => x.candidateId === candidate.id)?.votes ?? 0}</b></div>)}
            </div>
            <strong className="tv-cut-total">{cut.total}</strong>
          </div>) : <div className="tv-waiting">Esperando los primeros registros…</div>}
        </div>
        <div className="tv-source-note"><span>Datos actualizados automáticamente</span>{election.tvShowUpdatedAt && <strong>{new Date(data.updatedAt).toLocaleTimeString("es-PY")}</strong>}</div>
      </aside>
    </main>

    <footer className="tv-ticker">
      <div className="tv-ticker-label">EN VIVO</div>
      <div className="tv-ticker-text">{election.tvTickerText || `${election.name} · ${election.city} · Resultados de boca de urna en tiempo real`}</div>
      <div className="tv-ticker-mark">{election.brandName || "Boca de Urna"}</div>
    </footer>
  </div>;
}
