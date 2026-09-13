import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutGrid, Boxes, Users, PackageCheck, History, LogOut, Factory } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/stock', label: 'Stock', icon: Boxes },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/packing', label: 'Packing', icon: PackageCheck },
  { to: '/history', label: 'History', icon: History },
];

function pageTitle(pathname) {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/stock')) return 'Stock';
  if (pathname.startsWith('/clients')) return 'Clients';
  if (pathname.startsWith('/packing')) return 'Packing';
  if (pathname.startsWith('/history')) return 'History';
  return '';
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the mobile account menu on an outside tap/click, or on
  // navigation, rather than logging out on a single accidental tap.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-surface-soft">
      {/* ---------- Desktop / tablet sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-white md:flex">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-control bg-accent text-white">
            <Factory size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-ink">Plastic Manager</p>
            <p className="text-xs text-ink-faint">Stock &amp; Packing</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent-soft text-accent-dark' : 'text-ink-soft hover:bg-black/5'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + logout: padding/left-alignment matches the nav
            items above (px-3) so the icon columns line up, and the
            whole row reads as one intentional list item rather than
            a stray button hugging the sidebar edge. */}
        <div className="space-y-3 border-t border-border p-3">
          <div className="flex items-center gap-2.5 px-3 pt-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-dark">
              {user?.displayName?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{user?.displayName}</p>
              <p className="truncate text-xs text-ink-faint">@{user?.username}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-danger/5 hover:text-danger"
          >
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      {/* ---------- Mobile compact header ---------- */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-white px-4 py-3.5 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-control bg-accent text-white">
            <Factory size={16} />
          </div>
          <span className="text-base font-semibold text-ink">{pageTitle(location.pathname)}</span>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-dark"
            aria-label="Account menu"
            aria-expanded={menuOpen}
          >
            {user?.displayName?.[0]?.toUpperCase()}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 z-30 w-52 overflow-hidden rounded-card border border-border bg-white shadow-card">
              <div className="border-b border-border px-4 py-3">
                <p className="truncate text-sm font-medium text-ink">{user?.displayName}</p>
                <p className="truncate text-xs text-ink-faint">@{user?.username}</p>
              </div>
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-danger active:bg-danger/5"
              >
                <LogOut size={16} /> Log out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ---------- Main content ---------- */}
      <main className="pb-24 md:ml-60 md:pb-10">
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>

      {/* ---------- Mobile bottom navigation ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-white/95 backdrop-blur md:hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-accent' : 'text-ink-faint'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
