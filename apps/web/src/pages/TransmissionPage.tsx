import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Copy, ExternalLink, MonitorUp, Palette, Radio, RefreshCw, Save, Upload } from "lucide-react";
import TvStage from "../components/TvStage";
import { api } from "../lib/api";
import type { Election, TransmissionConfig, TvData } from "../types";
import "./transmission.css";

const defaultConfig: TransmissionConfig = {
  brandName: "",
  brandSubtitle: "",
  brandLogoData: null,
  brandPrimaryColor: "#C4161C",
  brandSecondaryColor: "#111318",
  brandBackgroundColor: "#080A0D",
  brandSurfaceColor: "#15181E",
  brandTextColor: "#FFFFFF",
  tvTickerText: "",
  tvPublicEnabled: false,
  tvAccessToken: null,
  tvShowClock: true,
  tvShowTotal: true,
  tvShowUpdatedAt: true
};

const presets = [
  { name: "Rojo editorial", colors: ["#C4161C", "#111318", "#080A0D", "#15181E", "#FFFFFF"] },
  { name: "Azul noche", colors: ["#31568B", "#17253A", "#101B2D", "#1D2D45", "#F8FBFF"] },
  { name: "Grafito", colors: ["#E15B64", "#20242C", "#111318", "#252A33", "#FFFFFF"] }
];

export default function TransmissionPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [electionId, setElectionId] = useState("");
  const [config, setConfig] = useState<TransmissionConfig>(defaultConfig);
  const [preview, setPreview] = useState<TvData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ elections: Election[] }>("/api/admin/elections").then(({ elections }) => {
      setElections(elections);
      const preferred = elections.find(e => e.status === "ACTIVE") ?? elections[0];
      if (preferred) setElectionId(preferred.id);
    }).catch(err => setError(err instanceof Error ? err.message : "No se pudieron cargar las elecciones"));
  }, []);

  const load = async (id: string) => {
    const result = await api<{ config: TransmissionConfig; preview: TvData }>(`/api/admin/transmission/${id}`);
    setConfig({ ...defaultConfig, ...result.config });
    setPreview(result.preview);
  };

  useEffect(() => {
    if (!electionId) return;
    setMessage(""); setError("");
    load(electionId).catch(err => setError(err instanceof Error ? err.message : "No se pudo cargar la transmisión"));
  }, [electionId]);

  const livePreview = useMemo<TvData | null>(() => {
    if (!preview) return null;
    return {
      ...preview,
      election: {
        ...preview.election,
        brandName: config.brandName || null,
        brandSubtitle: config.brandSubtitle || null,
        brandLogoData: config.brandLogoData,
        brandPrimaryColor: config.brandPrimaryColor,
        brandSecondaryColor: config.brandSecondaryColor,
        brandBackgroundColor: config.brandBackgroundColor,
        brandSurfaceColor: config.brandSurfaceColor,
        brandTextColor: config.brandTextColor,
        tvTickerText: config.tvTickerText || null,
        tvShowClock: config.tvShowClock,
        tvShowTotal: config.tvShowTotal,
        tvShowUpdatedAt: config.tvShowUpdatedAt
      }
    };
  }, [preview, config]);

  const save = async () => {
    if (!electionId || busy) return;
    setBusy(true); setMessage(""); setError("");
    try {
      await api(`/api/admin/transmission/${electionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          brandName: config.brandName?.trim() || null,
          brandSubtitle: config.brandSubtitle?.trim() || null,
          brandLogoData: config.brandLogoData,
          brandPrimaryColor: config.brandPrimaryColor,
          brandSecondaryColor: config.brandSecondaryColor,
          brandBackgroundColor: config.brandBackgroundColor,
          brandSurfaceColor: config.brandSurfaceColor,
          brandTextColor: config.brandTextColor,
          tvTickerText: config.tvTickerText?.trim() || null,
          tvShowClock: config.tvShowClock,
          tvShowTotal: config.tvShowTotal,
          tvShowUpdatedAt: config.tvShowUpdatedAt
        })
      });
      setMessage("Diseño de transmisión guardado.");
      await load(electionId);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!electionId) return;
    const result = await api<{ enabled: true; token: string }>(`/api/admin/transmission/${electionId}/publish`, { method: "POST" });
    setConfig(value => ({ ...value, tvPublicEnabled: true, tvAccessToken: result.token }));
    setMessage("Enlace de transmisión habilitado.");
  };

  const unpublish = async () => {
    if (!electionId) return;
    await api(`/api/admin/transmission/${electionId}/unpublish`, { method: "POST" });
    setConfig(value => ({ ...value, tvPublicEnabled: false }));
    setMessage("Transmisión pública pausada.");
  };

  const rotate = async () => {
    if (!electionId) return;
    const result = await api<{ enabled: true; token: string }>(`/api/admin/transmission/${electionId}/rotate-link`, { method: "POST" });
    setConfig(value => ({ ...value, tvPublicEnabled: true, tvAccessToken: result.token }));
    setMessage("Se generó un nuevo enlace. El anterior dejó de funcionar.");
  };

  const tvUrl = config.tvAccessToken ? `${window.location.origin}/tv/${config.tvAccessToken}` : "";

  const onLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setError("Usá un logo PNG, JPG o WebP.");
    if (file.size > 180 * 1024) return setError("El logo debe pesar menos de 180 KB.");
    const reader = new FileReader();
    reader.onload = () => setConfig(value => ({ ...value, brandLogoData: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const applyPreset = (colors: string[]) => setConfig(value => ({
    ...value,
    brandPrimaryColor: colors[0], brandSecondaryColor: colors[1], brandBackgroundColor: colors[2], brandSurfaceColor: colors[3], brandTextColor: colors[4]
  }));

  return <div className="stack-lg transmission-page">
    <div className="page-title-row"><div><div className="eyebrow">SALIDA AL AIRE</div><h1>Transmisión</h1><p>Branding, visualización 16:9 y enlace limpio para TV, streaming u OBS.</p></div><div className="live-badge"><span/>TV READY</div></div>
    {(message || error) && <div className={error ? "form-error" : "form-success"}>{error || message}</div>}

    <section className="toolbar-card transmission-toolbar">
      <label>Elección<select value={electionId} onChange={e => setElectionId(e.target.value)}><option value="">Seleccionar…</option>{elections.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <div className="toolbar-update">{config.tvPublicEnabled ? "Transmisión habilitada" : "Vista pública pausada"}</div>
    </section>

    {electionId && <div className="transmission-config-grid">
      <section className="panel-card">
        <div className="section-head"><div><h2><Palette size={18}/> Identidad visual</h2><p>La vista de TV usa estos tokens de marca sin alterar la legibilidad.</p></div></div>
        <div className="brand-upload-row">
          <div className="brand-upload-preview">{config.brandLogoData ? <img src={config.brandLogoData} alt="Logo configurado"/> : <Radio size={27}/>}</div>
          <div className="brand-upload-actions"><label className="ghost-btn file-button"><Upload size={15}/>Cargar logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogo}/></label>{config.brandLogoData && <button className="ghost-btn" onClick={() => setConfig(v => ({ ...v, brandLogoData: null }))}>Quitar</button>}<span>PNG/JPG/WebP · máx. 180 KB</span></div>
        </div>
        <div className="compact-form transmission-form">
          <label>Nombre del medio / cliente<input value={config.brandName ?? ""} onChange={e => setConfig(v => ({ ...v, brandName: e.target.value }))} placeholder="Radio Transcontinental"/></label>
          <label>Bajada institucional<input value={config.brandSubtitle ?? ""} onChange={e => setConfig(v => ({ ...v, brandSubtitle: e.target.value }))} placeholder="98.1 FM · Resultados en vivo"/></label>
          <div className="palette-presets">{presets.map(p => <button key={p.name} type="button" className="palette-preset" onClick={() => applyPreset(p.colors)}><span className="preset-dots">{p.colors.slice(0,4).map(c => <i key={c} style={{ background: c }}/>)}</span><b>{p.name}</b></button>)}</div>
          <div className="color-token-grid">
            {[
              ["Primario", "brandPrimaryColor"], ["Secundario", "brandSecondaryColor"], ["Fondo", "brandBackgroundColor"], ["Tarjetas", "brandSurfaceColor"], ["Texto", "brandTextColor"]
            ].map(([label, key]) => <label key={key}>{label}<div className="color-input"><input type="color" value={String(config[key as keyof TransmissionConfig])} onChange={e => setConfig(v => ({ ...v, [key]: e.target.value }))}/><code>{String(config[key as keyof TransmissionConfig])}</code></div></label>)}
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-head"><div><h2><MonitorUp size={18}/> Salida de transmisión</h2><p>Elegí qué información queda visible en la señal.</p></div></div>
        <div className="broadcast-toggles">
          <label><input type="checkbox" checked={config.tvShowClock} onChange={e => setConfig(v => ({ ...v, tvShowClock: e.target.checked }))}/><span>Reloj en vivo</span></label>
          <label><input type="checkbox" checked={config.tvShowTotal} onChange={e => setConfig(v => ({ ...v, tvShowTotal: e.target.checked }))}/><span>Total encuestados</span></label>
          <label><input type="checkbox" checked={config.tvShowUpdatedAt} onChange={e => setConfig(v => ({ ...v, tvShowUpdatedAt: e.target.checked }))}/><span>Hora de actualización</span></label>
        </div>
        <label className="ticker-field">Zócalo / ticker<input value={config.tvTickerText ?? ""} onChange={e => setConfig(v => ({ ...v, tvTickerText: e.target.value }))} maxLength={180} placeholder="Resultados de boca de urna en tiempo real…"/></label>
        <button className="primary-btn transmission-save" onClick={save} disabled={busy}><Save size={16}/>{busy ? "Guardando…" : "Guardar diseño"}</button>

        <div className="public-link-box">
          <div><strong>Enlace para TV / OBS</strong><span>La URL no muestra menú ni controles administrativos.</span></div>
          {!config.tvPublicEnabled ? <button className="primary-btn" onClick={publish}><Radio size={16}/>Habilitar transmisión</button> : <>
            <div className="tv-url-row"><input readOnly value={tvUrl}/><button className="icon-btn" title="Copiar" onClick={() => navigator.clipboard.writeText(tvUrl)}><Copy size={16}/></button><button className="icon-btn" title="Abrir" onClick={() => window.open(tvUrl, "_blank", "noopener,noreferrer")}><ExternalLink size={16}/></button></div>
            <div className="row-actions"><button className="ghost-btn" onClick={unpublish}>Pausar enlace</button><button className="ghost-btn" onClick={rotate}><RefreshCw size={15}/>Generar nuevo enlace</button></div>
          </>}
        </div>
      </section>
    </div>}

    {livePreview && <section className="panel-card transmission-preview-card">
      <div className="section-head"><div><h2>Vista previa 16:9</h2><p>Los cambios de color se previsualizan antes de guardar.</p></div>{tvUrl && config.tvPublicEnabled && <button className="ghost-btn" onClick={() => window.open(tvUrl, "_blank", "noopener,noreferrer")}><ExternalLink size={15}/>Abrir pantalla completa</button>}</div>
      <TvStage data={livePreview} preview/>
    </section>}
  </div>;
}
