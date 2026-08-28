import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api, setCsrfToken } from "./lib/api";
import type { AuthUser } from "./types";
import LoginPage from "./pages/LoginPage";
import OperatorPage from "./pages/OperatorPage";
import DashboardPage from "./pages/DashboardPage";
import OperatorsPage from "./pages/OperatorsPage";
import SettingsPage from "./pages/SettingsPage";
import AdminShell from "./components/AdminShell";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: AuthUser; csrfToken: string }>("/api/auth/me")
      .then(data => {
        setCsrfToken(data.csrfToken);
        setUser(data.user);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="splash"><div className="brand-mark">BU</div><span>Cargando...</span></div>;

  if (!user) {
    return <LoginPage onLogin={(nextUser, token) => { setCsrfToken(token); setUser(nextUser); }} />;
  }

  const logout = async () => {
    try { await api<void>("/api/auth/logout", { method: "POST" }); } finally { setUser(null); setCsrfToken(""); }
  };

  if (user.role === "OPERATOR") return <OperatorPage user={user} onLogout={logout} />;

  return (
    <AdminShell user={user} onLogout={logout}>
      <Routes>
        <Route path="/admin" element={<DashboardPage />} />
        <Route path="/admin/operators" element={<OperatorsPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminShell>
  );
}
