import { useCallback, useEffect, useState } from "react";
import TvStage from "../components/TvStage";
import { api } from "../lib/api";
import type { TvData } from "../types";

export default function TvPage({ token }: { token: string }) {
  const [data, setData] = useState<TvData | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await api<TvData>(`/api/tv/${encodeURIComponent(token)}`);
      setData(next);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transmisión no disponible");
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const source = new EventSource(`/api/tv/${encodeURIComponent(token)}/stream`);
    source.addEventListener("vote", refresh);
    const fallback = window.setInterval(refresh, 10000);
    return () => { source.close(); window.clearInterval(fallback); };
  }, [token, refresh]);

  if (error && !data) return <div className="tv-public-error"><div className="brand-mark">BU</div><h1>Transmisión no disponible</h1><p>{error}</p></div>;
  if (!data) return <div className="kiosk-loading"><div className="brand-mark">BU</div><span>Preparando transmisión…</span></div>;

  return <TvStage data={data}/>;
}
