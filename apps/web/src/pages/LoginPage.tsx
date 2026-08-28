import { useState, type FormEvent } from "react";
import { LockKeyhole, Vote } from "lucide-react";
import { api } from "../lib/api";
import type { AuthUser } from "../types";

export default function LoginPage({ onLogin }: { onLogin: (user: AuthUser, csrfToken: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const data = await api<{ user: AuthUser; csrfToken: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      onLogin(data.user, data.csrfToken);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo iniciar sesión"); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><div className="brand-mark"><Vote size={26}/></div><div><h1>Boca de Urna</h1><p>Acceso seguro</p></div></div>
        <label>Usuario<input autoCapitalize="none" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario" /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-btn" disabled={busy}><LockKeyhole size={17}/>{busy ? "Ingresando..." : "Ingresar"}</button>
        <div className="security-note">Sesión protegida · acceso según rol</div>
      </form>
    </div>
  );
}
