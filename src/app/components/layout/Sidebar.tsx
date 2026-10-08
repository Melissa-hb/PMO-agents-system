import { useNavigate, useLocation } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FolderKanban, Settings, LogOut, Trash2, Info, Bell, BellOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useSoundManager } from '../../hooks/useSoundManager';
import { CreditsModal } from '../ui/CreditsModal';
import IcesiLogo from '../brand/IcesiLogo';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { icon: <FolderKanban size={19} strokeWidth={1.75} />, label: 'Proyectos', path: '/dashboard' },
  { icon: <Trash2 size={19} strokeWidth={1.75} />, label: 'Papelera', path: '/dashboard/papelera' },
  // El panel solo funciona para administradores (el backend protege /api/admin).
  { icon: <Settings size={19} strokeWidth={1.75} />, label: 'Administración', path: '/dashboard/admin', adminOnly: true },
];

const ROLE_LABEL: Record<string, string> = { admin: 'Administrador', auditor: 'Consultor' };

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useApp();
  const { signOut } = useAuth();
  const { isMuted, toggleMute, isSupported } = useSoundManager();
  const [showCredits, setShowCredits] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/project');
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const items = navItems.filter(item => !item.adminOnly || currentUser.role === 'admin');

  return (
    <aside className="fixed left-0 top-0 h-screen w-[72px] flex flex-col items-center py-5 z-50 border-r border-neutral-200/70 bg-white print:hidden">
      <button
        onClick={() => navigate('/dashboard')}
        className="w-full px-2 mb-8 flex items-center justify-center"
        title="Universidad Icesi"
      >
        <IcesiLogo variant="mark" className="h-9 w-9" />
      </button>

      <nav className="flex flex-col gap-1 flex-1 w-full px-1.5" aria-label="Navegación principal">
        {items.map(item => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={active ? 'page' : undefined}
              className={`w-full py-2 rounded-lg flex flex-col items-center gap-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#5454e9]/40 ${
                active ? 'text-[#5454e9] bg-[#5454e9]/[0.07]' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              {item.icon}
              <span className="text-[10px] leading-none tracking-tight" style={{ fontWeight: active ? 500 : 400 }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Cuenta: avatar con menu (preferencias, creditos y cerrar sesion) */}
      <div ref={menuRef} className="relative w-full px-1.5 flex flex-col items-center">
        <button
          onClick={() => setShowMenu(v => !v)}
          aria-haspopup="menu"
          aria-expanded={showMenu}
          className="w-full py-2 rounded-lg flex flex-col items-center gap-1 text-neutral-500 hover:bg-neutral-100 outline-none focus-visible:ring-2 focus-visible:ring-[#5454e9]/40"
        >
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px]"
            style={{ background: currentUser.color, fontWeight: 500 }}
          >
            {currentUser.initials}
          </span>
          <span className="text-[10px] leading-none">Cuenta</span>
        </button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-full bottom-0 ml-2 w-60 bg-white rounded-xl border border-neutral-200 shadow-lg py-1.5 text-[13px]"
            >
              <div className="px-3.5 py-2.5 border-b border-neutral-100 mb-1">
                <p className="text-neutral-900 truncate" style={{ fontWeight: 500 }}>{currentUser.name}</p>
                <p className="text-neutral-500 text-[12px]">{ROLE_LABEL[currentUser.role] ?? currentUser.role}</p>
              </div>
              {isSupported && (
                <button role="menuitem" onClick={toggleMute} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-neutral-700 hover:bg-neutral-50">
                  {isMuted ? <BellOff size={15} strokeWidth={1.75} /> : <Bell size={15} strokeWidth={1.75} />}
                  <span className="flex-1 text-left">Sonido de notificaciones</span>
                  <span className="text-neutral-400 text-[12px]">{isMuted ? 'No' : 'Sí'}</span>
                </button>
              )}
              <button role="menuitem" onClick={() => { setShowMenu(false); setShowCredits(true); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-neutral-700 hover:bg-neutral-50">
                <Info size={15} strokeWidth={1.75} />
                Créditos
              </button>
              <button role="menuitem" onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-neutral-700 hover:bg-neutral-50 hover:text-red-600">
                <LogOut size={15} strokeWidth={1.75} />
                Cerrar sesión
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CreditsModal isOpen={showCredits} onClose={() => setShowCredits(false)} />
    </aside>
  );
}
