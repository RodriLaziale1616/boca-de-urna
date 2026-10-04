import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api, setCsrfToken } from "./lib/api";
import type { AuthUser } from "./types";
import LoginPage from "./pages/LoginPage";
import OperatorPage from "./pages/OperatorPage";
import DashboardPage from "./pages/DashboardPage";
import OperatorsPage from "./pages/OperatorsPage";
import SettingsPage from "./pages/SettingsPage";
import PreparationPage from "./pages/PreparationPage";
import FlyerPage from "./pages/FlyerPage";
import TvPage from "./pages/TvPage";
import AdminShell from "./components/AdminShell";

const OPERATOR_CACHE_KEY = "bdu_last_operator_user";

function cacheOperator(user: AuthUser | null) {
  try {
    if (user?.role === "OPERATOR") localStorage.setItem(OPERATOR_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(OPERATOR_CACHE_KEY);
  } catch {
    // Storage can be unavailable in strict/private browser modes.
  }
}

function readCachedOperator(): AuthUser | null {
  try {
    const raw = localStorage.getItem(OPERATOR_CACHE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as AuthUser;
    return user?.role === "OPERATOR" ? user : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: AuthUser; csrfToken: string }>("/api/auth/me")
      .then(data => {
        setCsrfToken(data.csrfToken);
        setUser(data.user);
        cacheOperator(data.user);
      })
      .catch(() => {
        if (!navigator.onLine) setUser(readCachedOperator());
        else setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const tvMatch = window.location.pathname.match(/^\/tv\/([^/]+)\/?$/);
  if (tvMatch) return <TvPage token={decodeURIComponent(tvMatch[1])}/>;

  if (loading) return <div className="splash"><div className="brand-mark">BU</div><span>Cargando...</span></div>;

  if (!user) {
    return <LoginPage onLogin={(nextUser, token) => { setCsrfToken(token); setUser(nextUser); cacheOperator(nextUser); }} />;
  }

  const logout = async () => {
    try { await api<void>("/api/auth/logout", { method: "POST" }); } finally { cacheOperator(null); setUser(null); setCsrfToken(""); }
  };

  if (user.role === "OPERATOR") return <OperatorPage user={user} onLogout={logout} />;

  return (
    <AdminShell user={user} onLogout={logout}>
      <Routes>
        <Route path="/admin" element={<DashboardPage />} />
        <Route path="/admin/operators" element={<OperatorsPage />} />
        <Route path="/admin/flyers" element={<FlyerPage />} />
        <Route path="/admin/transmission" element={<Navigate to="/admin/flyers" replace />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
        <Route path="/admin/preparation" element={<PreparationPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminShell>
  );
}
