import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Download, FileImage, Image as ImageIcon, Printer, Upload } from "lucide-react";
import { api } from "../lib/api";
import type { Candidate, Election, TransmissionConfig } from "../types";
import "./flyer.css";

type Overview = {
  election: Election | null;
  total: number;
  candidates: (Candidate & { votes: number; percentage: number })[];
  hourly: { hourLabel: string; total: number; candidates: { candidateId: string; votes: number }[] }[];
};

type FormatKey = "square" | "portrait" | "story" | "landscape" | "a4p" | "a4l";

const formats: Record<FormatKey, { label: string; width: number; height: number }> = {
  square: { label: "Post cuadrado · 1080×1080", width: 1080, height: 1080 },
  portrait: { label: "Post vertical · 1080×1350", width: 1080, height: 1350 },
  story: { label: "Story / estado · 1080×1920", width: 1080, height: 1920 },
  landscape: { label: "Horizontal · 1920×1080", width: 1920, height: 1080 },
  a4p: { label: "A4 vertical", width: 1240, height: 1754 },
  a4l: { label: "A4 horizontal", width: 1754, height: 1240 }
};

const aliasKey = (electionId: string) => `bdu_flyer_aliases:${electionId}`;

function pct(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function FlyerPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [electionId, setElectionId] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [brand, setBrand] = useState<TransmissionConfig | null>(null);
  const [format, setFormat] = useState<FormatKey>("portrait");
  const [title, setTitle] = useState("BOCA DE URNA");
  const [subtitle, setSubtitle] = useState("Resultados parciales");
  const [footer, setFooter] = useState("Resultados de boca de urna · Datos no oficiales");
  const [showVotes, setShowVotes] = useState(false);
  const [showTotal, setShowTotal] = useState(true);
  const [showCuts, setShowCuts] = useState(true);
  const [showNoResponse, setShowNoResponse] = useState(false);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [localLogo, setLocalLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api<{ elections: Election[] }>("/api/admin/elections").then(({ elections }) => {
      setElections(elections);
      const preferred = elections.find(e => e.status === "ACTIVE") ?? elections[0];
      if (preferred) setElectionId(preferred.id);
    });
  }, []);

  useEffect(() => {
    if (!electionId) return;
    try {
      const stored = JSON.parse(localStorage.getItem(aliasKey(electionId)) || "{}");
      setAliases(stored);
    } catch {
      setAliases({});
    }
    Promise.all([
      api<Overview>(`/api/admin/overview?electionId=${encodeURIComponent(electionId)}`),
      api<{ config: TransmissionConfig }>(`/api/admin/transmission/${encodeURIComponent(electionId)}`)
    ]).then(([overview, transmission]) => {
      setData(overview);
      setBrand(transmission.config);
      setUpdatedAt(new Date());
    });
  }, [electionId]);

  useEffect(() => {
    if (!electionId) return;
    localStorage.setItem(aliasKey(electionId), JSON.stringify(aliases));
  }, [aliases, electionId]);

  const candidates = useMemo(() =>
    (data?.candidates ?? [])
      .filter(c => (showNoResponse || !c.isNoResponse) && (c.active || c.votes > 0))
      .sort((a, b) => b.percentage - a.percentage),
    [data, showNoResponse]
  );

  const logo = localLogo || brand?.brandLogoData || null;
  const primary = brand?.brandPrimaryColor || "#d71920";
  const secondary = brand?.brandSecondaryColor || "#0a2e66";
  const currentFormat = formats[format];

  const setAlias = (candidateId: string, value: string) => {
    setAliases(current => ({ ...current, [candidateId]: value }));
  };

  const publicName = (candidate: Candidate) => {
    const alias = aliases[candidate.id]?.trim();
    return alias || `Candidato ${candidate.ballotNumber || candidates.findIndex(c => c.id === candidate.id) + 1}`;
  };

  const onLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return;
    if (file.size > 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setLocalLogo(String(reader.result));
    reader.readAsDataURL(file);
  };

  async function renderCanvas() {
    if (!data?.election) throw new Error("No hay elección");
    const { width, height } = currentFormat;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible");

    const scale = width / 1080;
    const pad = 64 * scale;
    const topBand = 190 * scale;
    const footerH = 84 * scale;
    ctx.fillStyle = "#f6f7f9";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = secondary;
    ctx.fillRect(0, 0, width, topBand);
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, 18 * scale, topBand);

    if (logo) {
      try {
        const img = await loadImage(logo);
        const maxW = 180 * scale;
        const maxH = 118 * scale;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        ctx.drawImage(img, pad, 34 * scale, img.width * ratio, img.height * ratio);
      } catch { /* logo opcional */ }
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${44 * scale}px Arial`;
    ctx.textAlign = "right";
    ctx.fillText(title, width - pad, 72 * scale);
    ctx.font = `700 ${23 * scale}px Arial`;
    ctx.fillStyle = "#d9e4f4";
    ctx.fillText(subtitle, width - pad, 112 * scale);
    ctx.font = `700 ${18 * scale}px Arial`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${data.election.city} · ${updatedAt.toLocaleString("es-PY", { dateStyle: "short", timeStyle: "short" })}`, width - pad, 151 * scale);

    let y = topBand + 46 * scale;
    if (showTotal) {
      ctx.fillStyle = "#172033";
      ctx.font = `800 ${22 * scale}px Arial`;
      ctx.textAlign = "left";
      ctx.fillText("TOTAL ENCUESTADOS", pad, y);
      ctx.textAlign = "right";
      ctx.font = `900 ${40 * scale}px Arial`;
      ctx.fillText(data.total.toLocaleString("es-PY"), width - pad, y + 6 * scale);
      y += 64 * scale;
    }

    const cutsSpace = showCuts && data.hourly.length ? Math.min(350 * scale, height * 0.25) : 0;
    const available = height - y - footerH - cutsSpace - 42 * scale;
    const rowH = Math.max(82 * scale, Math.min(150 * scale, available / Math.max(1, candidates.length)));

    candidates.forEach((candidate, index) => {
      const cy = y + index * rowH;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#d8dde6";
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.roundRect(pad, cy, width - pad * 2, rowH - 12 * scale, 18 * scale);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = candidate.colorHex;
      ctx.beginPath();
      ctx.roundRect(pad, cy, 12 * scale, rowH - 12 * scale, 8 * scale);
      ctx.fill();

      ctx.fillStyle = "#111827";
      ctx.textAlign = "left";
      ctx.font = `900 ${Math.min(34, 28 + candidates.length) * scale}px Arial`;
      ctx.fillText(publicName(candidate), pad + 36 * scale, cy + 44 * scale);

      if (showVotes) {
        ctx.fillStyle = "#667085";
        ctx.font = `700 ${16 * scale}px Arial`;
        ctx.fillText(`${candidate.votes.toLocaleString("es-PY")} respuestas`, pad + 36 * scale, cy + 70 * scale);
      }

      ctx.textAlign = "right";
      ctx.fillStyle = candidate.colorHex;
      ctx.font = `900 ${46 * scale}px Arial`;
      ctx.fillText(pct(candidate.percentage), width - pad - 22 * scale, cy + 54 * scale);
    });

    y += candidates.length * rowH + 22 * scale;

    if (showCuts && data.hourly.length) {
      ctx.fillStyle = "#172033";
      ctx.textAlign = "left";
      ctx.font = `900 ${22 * scale}px Arial`;
      ctx.fillText("CORTES HORARIOS", pad, y);
      y += 26 * scale;

      const cellW = (width - pad * 2) / data.hourly.length;
      data.hourly.forEach((cut, i) => {
        const x = pad + i * cellW;
        ctx.fillStyle = i % 2 ? "#edf1f6" : "#e4e9f0";
        ctx.fillRect(x, y, cellW - 4 * scale, 92 * scale);
        ctx.fillStyle = secondary;
        ctx.textAlign = "center";
        ctx.font = `900 ${17 * scale}px Arial`;
        ctx.fillText(cut.hourLabel, x + (cellW - 4 * scale) / 2, y + 28 * scale);
        ctx.fillStyle = "#172033";
        ctx.font = `900 ${26 * scale}px Arial`;
        ctx.fillText(cut.total.toLocaleString("es-PY"), x + (cellW - 4 * scale) / 2, y + 64 * scale);
        ctx.font = `700 ${12 * scale}px Arial`;
        ctx.fillStyle = "#667085";
        ctx.fillText("encuestas", x + (cellW - 4 * scale) / 2, y + 82 * scale);
      });
    }

    ctx.fillStyle = secondary;
    ctx.fillRect(0, height - footerH, width, footerH);
    ctx.fillStyle = primary;
    ctx.fillRect(0, height - footerH, 18 * scale, footerH);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = `700 ${17 * scale}px Arial`;
    ctx.fillText(footer, width / 2, height - footerH / 2 + 6 * scale);

    return canvas;
  }

  async function download(type: "png" | "jpeg") {
    setBusy(true);
    try {
      const canvas = await renderCanvas();
      const link = document.createElement("a");
      link.download = `boca-de-urna-${format}-${new Date().toISOString().slice(0,10)}.${type === "png" ? "png" : "jpg"}`;
      link.href = canvas.toDataURL(`image/${type}`, type === "jpeg" ? 0.94 : undefined);
      link.click();
    } finally {
      setBusy(false);
    }
  }

  async function printPdf() {
    setBusy(true);
    try {
      const canvas = await renderCanvas();
      const image = canvas.toDataURL("image/png");
      const popup = window.open("", "_blank");
      if (!popup) return;
      popup.opener = null;
      popup.document.write(`<!doctype html><html><head><title>Flyer Boca de Urna</title><style>@page{margin:0}body{margin:0;display:grid;place-items:center;background:white}img{max-width:100vw;max-height:100vh;object-fit:contain}</style></head><body><img src="${image}" onload="setTimeout(()=>window.print(),200)"></body></html>`);
      popup.document.close();
    } finally {
      setBusy(false);
    }
  }

  return <div className="stack-lg flyer-page">
    <div className="page-title-row">
      <div><div className="eyebrow">PUBLICACIÓN</div><h1>Generador de flyers</h1><p>Los alias se usan únicamente en la pieza pública. La pantalla de los operadores no cambia.</p></div>
      <div className="live-badge"><FileImage size={15}/>LISTO PARA PUBLICAR</div>
    </div>

    <section className="toolbar-card">
      <label>Elección<select value={electionId} onChange={e => setElectionId(e.target.value)}>{elections.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <label>Formato<select value={format} onChange={e => setFormat(e.target.value as FormatKey)}>{Object.entries(formats).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
      <div className="toolbar-update">{currentFormat.width} × {currentFormat.height}px</div>
    </section>

    {data?.election && <div className="flyer-layout">
      <div className="stack-lg">
        <section className="panel-card">
          <div className="section-head"><div><h2>Texto y marca</h2><p>La configuración del flyer no modifica la elección ni los operadores.</p></div></div>
          <div className="compact-form">
            <label>Título<input value={title} onChange={e => setTitle(e.target.value)} maxLength={50}/></label>
            <label>Subtítulo<input value={subtitle} onChange={e => setSubtitle(e.target.value)} maxLength={80}/></label>
            <label>Pie / aclaración<input value={footer} onChange={e => setFooter(e.target.value)} maxLength={120}/></label>
            <div className="brand-upload-row">
              <div className="brand-upload-preview">{logo ? <img src={logo} alt="Logo"/> : <ImageIcon size={28}/>}</div>
              <div className="brand-upload-actions">
                <label className="ghost-btn file-button"><Upload size={15}/>Usar otro logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={onLogo}/></label>
                {localLogo && <button className="ghost-btn" onClick={() => setLocalLogo(null)}>Volver al logo guardado</button>}
                <span>El logo cargado acá se usa solo en este navegador.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel-card">
          <div className="section-head"><div><h2>Alias públicos</h2><p>El nombre real permanece interno. Definí aquí cómo aparece cada candidato en el flyer.</p></div></div>
          <div className="flyer-alias-list">
            {data.candidates.filter(c => !c.isNoResponse).map((candidate, index) => <label key={candidate.id}>
              <span className="alias-internal"><i style={{ background: candidate.colorHex }}/><b>{candidate.name}</b><small>interno</small></span>
              <input value={aliases[candidate.id] ?? ""} onChange={e => setAlias(candidate.id, e.target.value)} placeholder={`Candidato ${candidate.ballotNumber || index + 1}`} maxLength={45}/>
            </label>)}
          </div>
        </section>

        <section className="panel-card">
          <div className="section-head"><div><h2>Contenido</h2><p>Elegí qué información se incluye.</p></div></div>
          <div className="flyer-toggles">
            <label><input type="checkbox" checked={showTotal} onChange={e => setShowTotal(e.target.checked)}/><span>Total encuestados</span></label>
            <label><input type="checkbox" checked={showVotes} onChange={e => setShowVotes(e.target.checked)}/><span>Cantidad de respuestas</span></label>
            <label><input type="checkbox" checked={showCuts} onChange={e => setShowCuts(e.target.checked)}/><span>Cortes horarios</span></label>
            <label><input type="checkbox" checked={showNoResponse} onChange={e => setShowNoResponse(e.target.checked)}/><span>No responde</span></label>
          </div>
        </section>

        <div className="flyer-actions">
          <button className="primary-btn" disabled={busy} onClick={() => download("png")}><Download size={16}/>Descargar PNG</button>
          <button className="ghost-btn" disabled={busy} onClick={() => download("jpeg")}><Download size={16}/>Descargar JPG</button>
          <button className="ghost-btn" disabled={busy} onClick={printPdf}><Printer size={16}/>Imprimir / PDF</button>
        </div>
      </div>

      <section className="panel-card flyer-preview-panel">
        <div className="section-head"><div><h2>Vista previa</h2><p>La exportación usa la resolución real seleccionada.</p></div></div>
        <div className="flyer-preview-shell">
          <div ref={previewRef} className={`flyer-preview flyer-preview-${format}`} style={{ "--flyer-primary": primary, "--flyer-secondary": secondary } as React.CSSProperties}>
            <header>
              <div className="flyer-logo">{logo ? <img src={logo} alt="Logo"/> : <span>LOGO</span>}</div>
              <div className="flyer-heading"><strong>{title}</strong><span>{subtitle}</span><small>{data.election.city} · {updatedAt.toLocaleString("es-PY", { dateStyle: "short", timeStyle: "short" })}</small></div>
            </header>
            <main>
              {showTotal && <div className="flyer-total"><span>Total encuestados</span><strong>{data.total.toLocaleString("es-PY")}</strong></div>}
              <div className="flyer-candidates">
                {candidates.map(candidate => <div className="flyer-candidate" key={candidate.id} style={{ "--candidate": candidate.colorHex } as React.CSSProperties}>
                  <div><strong>{publicName(candidate)}</strong>{showVotes && <span>{candidate.votes.toLocaleString("es-PY")} respuestas</span>}</div>
                  <b>{pct(candidate.percentage)}</b>
                </div>)}
              </div>
              {showCuts && <div className="flyer-cuts"><h3>Cortes horarios</h3><div>{data.hourly.map(cut => <article key={cut.hourLabel}><strong>{cut.hourLabel}</strong><span>{cut.total.toLocaleString("es-PY")}</span><small>encuestas</small></article>)}</div></div>}
            </main>
            <footer>{footer}</footer>
          </div>
        </div>
      </section>
    </div>}
  </div>;
}
