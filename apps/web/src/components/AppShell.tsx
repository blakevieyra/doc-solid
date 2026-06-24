"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useProfile } from "./ProfileProvider";
import { useNotifications } from "./NotificationProvider";
import { BrandLogo } from "./BrandLogo";

export function AppShell({
  title,
  children,
  wide,
}: {
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { user, logout } = useAuth();
  const { profile } = useProfile();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  const logo = profile.business.logo ?? profile.organization.logo;
  const displayName = user?.name?.split(" ")[0] ?? "User";

  useEffect(() => {
    function close(e: MouseEvent | TouchEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container app-header-inner" ref={headerRef}>
          <BrandLogo href="/documents" size="xs" />

          <nav className={`app-nav${menuOpen ? " open" : ""}`} aria-label="Main">
            <Link href="/documents" onClick={() => setMenuOpen(false)}>Documents</Link>
            <Link href="/packets" onClick={() => setMenuOpen(false)}>Packets</Link>
            <Link href="/portal" onClick={() => setMenuOpen(false)}>My Files</Link>
            <Link href="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
            <Link href="/team" onClick={() => setMenuOpen(false)}>Team</Link>
            <Link href="/help" onClick={() => setMenuOpen(false)}>Help</Link>
            {menuOpen && (
              <div className="mobile-nav-footer">
                <Link href="/profile?tab=security" className="btn btn-secondary btn-block" onClick={() => setMenuOpen(false)}>
                  Security Center
                </Link>
              </div>
            )}
          </nav>

          {menuOpen && <button type="button" className="mobile-nav-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

          <div className="app-header-actions">
            <div className="notif-wrap">
              <button
                type="button"
                className="icon-btn"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={(e) => { e.stopPropagation(); setNotifOpen(!notifOpen); setUserOpen(false); }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-header">
                    <strong>Notifications</strong>
                    {unreadCount > 0 && (
                      <button type="button" className="notif-mark-all" onClick={markAllAsRead}>Mark all read</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="notif-empty">No notifications yet</p>
                  ) : (
                    <ul className="notif-list">
                      {notifications.slice(0, 8).map((n) => (
                        <li key={n.id} className={`notif-item${n.read ? "" : " unread"}`}>
                          <button type="button" onClick={() => { markAsRead(n.id); if (n.link) router.push(n.link); setNotifOpen(false); }}>
                            <strong>{n.title}</strong>
                            <span>{n.message}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="user-menu-wrap">
              <button
                type="button"
                className="user-menu-btn"
                aria-expanded={userOpen}
                aria-label="Account menu"
                onClick={(e) => { e.stopPropagation(); setUserOpen(!userOpen); setNotifOpen(false); }}
              >
                {logo ? (
                  <img src={logo} alt="" className="user-logo-avatar" />
                ) : (
                  <span className="user-avatar">{(user?.name ?? "U")[0].toUpperCase()}</span>
                )}
                <span className="user-name-label">{displayName}</span>
              </button>
              {userOpen && (
                <div className="user-dropdown">
                  <div className="user-dropdown-info">
                    <div className="user-dropdown-brand">
                      {logo && <img src={logo} alt="" className="user-dropdown-logo" />}
                      <div>
                        <strong>{user?.name}</strong>
                        <span>{user?.email}</span>
                      </div>
                    </div>
                  </div>
                  <Link href="/profile?tab=account" onClick={() => setUserOpen(false)}>Manage Account</Link>
                  <Link href="/profile?tab=security" onClick={() => setUserOpen(false)}>Security</Link>
                  <Link href="/profile?tab=billing" onClick={() => setUserOpen(false)}>Billing</Link>
                  <button type="button" onClick={handleLogout}>Sign Out</button>
                </div>
              )}
            </div>

            <button
              type="button"
              className={`mobile-menu-btn${menuOpen ? " open" : ""}`}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      <main className={`container app-main app-main-wide${wide ? " app-main-full" : ""}`}>
        {title && <h1 className="page-title">{title}</h1>}
        {children}
      </main>

      <footer className="app-footer">
        <div className="container app-footer-inner">
          <span>© {new Date().getFullYear()} Doc Solid</span>
          <nav className="app-footer-nav">
            <Link href="/help">Help</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/profile?tab=support">Support</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
