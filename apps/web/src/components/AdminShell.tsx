import { useState, type ReactNode } from "react";
import { BarChart3, LogOut, Menu, Settings, Users, Vote, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { AuthUser } from "../types";

export default function AdminShell({ user, onLogout, children }: { user: AuthUser; onLogout: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const nav = [
    { to: "/admin", label: "Resultados", icon: BarChart3 },
    { to: "/admin/operators", label: "Operadores", icon: Users },
    { to: "/admin/settings", label: "Configuración", icon: Settings }
  ];

  return (
    <div className="admin-layout">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-head">
          <div className="brand-mark"><Vote size={22} /></div>
          <div><strong>Boca de Urna</strong><span>Centro de control</span></div>
          <button className="icon-btn mobile-only" onClick={() => setOpen(false)}><X size={20}/></button>
        </div>
        <div className="user-chip"><strong>{user.name}</strong><span>Administrador</span></div>
        <nav>
          {nav.map(item => <NavLink key={item.to} to={item.to} end={item.to === "/admin"} onClick={() => setOpen(false)}><item.icon size={17}/>{item.label}</NavLink>)}
        </nav>
        <button className="sidebar-logout" onClick={onLogout}><LogOut size={17}/>Salir</button>
      </aside>
      <div className="admin-content">
        <header className="mobile-header">
          <button className="icon-btn" onClick={() => setOpen(true)}><Menu size={21}/></button>
          <strong>Boca de Urna</strong>
          <span className="live-dot">Admin</span>
        </header>
        <main className="page-wrap">{children}</main>
      </div>
      {open && <button aria-label="Cerrar menú" className="sidebar-backdrop" onClick={() => setOpen(false)} />}
    </div>
  );
}
