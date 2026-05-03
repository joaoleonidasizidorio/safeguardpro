import React, { useState, useEffect } from 'react';
import { View } from '../types';
import { API_BASE_URL } from '../config';

interface SidebarProps {
  currentView: View;
  onChangeView: (view: View) => void;
  isOpen: boolean;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, isOpen, onLogout }) => {
  console.log("Sidebar Refreshed - HMR Check");
  const userRole = localStorage.getItem('safeguard_user_type');
  const getFullAvatarUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${API_BASE_URL}${path}`;
  };

  const [avatarUrl, setAvatarUrl] = useState(() => {
    const stored = localStorage.getItem('safeguard_user_avatar');
    console.log('Sidebar Initial Avatar Load:', stored);
    if (stored) return getFullAvatarUrl(stored);
    return `https://i.pravatar.cc/150?u=${localStorage.getItem('safeguard_user_email')}`;
  });

  useEffect(() => {
    const handleProfileUpdate = () => {
      const stored = localStorage.getItem('safeguard_user_avatar');
      console.log('Sidebar Update Event Triggered. Stored:', stored);
      if (stored) {
        setAvatarUrl(getFullAvatarUrl(stored));
      } else {
        const email = localStorage.getItem('safeguard_user_email');
        setAvatarUrl(`https://i.pravatar.cc/150?u=${email}`);
      }
    };

    window.addEventListener('user-profile-update', handleProfileUpdate);
    return () => window.removeEventListener('user-profile-update', handleProfileUpdate);
  }, []);

  const getLinkClass = (view: View) => {
    const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ";
    if (currentView === view) {
      return base + "bg-primary/10 text-green-700 dark:text-primary";
    }
    return base + "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-surface-dark dark:hover:text-gray-200";
  };

  const containerClass = `fixed inset-y-0 left-0 z-50 w-64 bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-200 lg:translate-x-0 lg:static lg:flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`;

  return (
    <aside className={containerClass}>
      <div className="flex h-16 items-center px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-background-dark">
            <span className="material-symbols-outlined text-[20px]">shield</span>
          </span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">Portal SST</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mb-2">
          <p className="mb-2 px-2 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Menu Principal</p>
          <div className="flex flex-col gap-1">
            <a onClick={() => onChangeView(View.DASHBOARD)} className={getLinkClass(View.DASHBOARD)}>
              <span className="material-symbols-outlined">dashboard</span>
              Visão Geral
            </a>
            <a onClick={() => onChangeView(View.ALERTS)} className={getLinkClass(View.ALERTS)}>
              <span className="material-symbols-outlined">warning</span>
              Não Conformidades
            </a>
            <a onClick={() => onChangeView(View.AUDIT)} className={getLinkClass(View.AUDIT)}>
              <span className="material-symbols-outlined">fact_check</span>
              Auditorias & Vistorias
            </a>
            <a onClick={() => onChangeView(View.EVIDENCES)} className={getLinkClass(View.EVIDENCES)}>
              <span className="material-symbols-outlined">photo_library</span>
              Registro Fotográfico
            </a>
            <a onClick={() => onChangeView(View.RISKS)} className={getLinkClass(View.RISKS)}>
              <span className="material-symbols-outlined">emergency</span>
              Gestão de Riscos
            </a>

            {(userRole === 'admin' || userRole === 'technician') && (
              <a onClick={() => onChangeView(View.COMPANIES)} className={getLinkClass(View.COMPANIES)}>
                <span className="material-symbols-outlined">domain</span>
                Empresas
              </a>
            )}
            {(userRole === 'admin' || userRole === 'technician') && (
              <a onClick={() => onChangeView(View.VISITS)} className={getLinkClass(View.VISITS)}>
                <span className="material-symbols-outlined">event</span>
                Visitas
              </a>
            )}
            <a onClick={() => onChangeView(View.TRAININGS)} className={getLinkClass(View.TRAININGS)}>
              <span className="material-symbols-outlined">school</span>
              Treinamentos
            </a>
            {(userRole === 'admin' || userRole === 'technician' || userRole === 'manager') && (
              <a onClick={() => onChangeView(View.LEGAL_DOCUMENTS)} className={getLinkClass(View.LEGAL_DOCUMENTS)}>
                <span className="material-symbols-outlined">folder_managed</span>
                Documentos Legais
              </a>
            )}
            <a onClick={() => onChangeView(View.INCIDENT_MANAGEMENT)} className={getLinkClass(View.INCIDENT_MANAGEMENT)}>
              <span className="material-symbols-outlined">notification_important</span>
              Incidentes (CAT)
            </a>
            <a onClick={() => onChangeView(View.ASO_MANAGEMENT)} className={getLinkClass(View.ASO_MANAGEMENT)}>
              <span className="material-symbols-outlined">clinical_notes</span>
              Gestão de ASO
            </a>
            <a onClick={() => onChangeView(View.NOTIFICATIONS)} className={getLinkClass(View.NOTIFICATIONS)}>
              <span className="material-symbols-outlined">notifications_active</span>
              Notificações e Alertas
            </a>
            <a onClick={() => onChangeView(View.EPI_MANAGEMENT)} className={getLinkClass(View.EPI_MANAGEMENT)}>
              <span className="material-symbols-outlined">construction</span>
              Gestão de EPIs
            </a>
          </div>
        </div>

        <div className="mt-8">
          <p className="mb-2 px-2 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">Suporte</p>
          <div className="flex flex-col gap-1">
            {localStorage.getItem('safeguard_user_type') === 'admin' && (
              <a onClick={() => onChangeView(View.ADMIN)} className={getLinkClass(View.ADMIN)}>
                <span className="material-symbols-outlined">admin_panel_settings</span>
                Administração
              </a>
            )}
            <a onClick={() => onChangeView(View.SETTINGS)} className={getLinkClass(View.SETTINGS)}>
              <span className="material-symbols-outlined">settings</span>
              Configurações
            </a>
            {(userRole === 'admin' || userRole === 'technician') && (
              <a onClick={() => onChangeView(View.SUBSCRIPTION)} className={getLinkClass(View.SUBSCRIPTION)}>
                <span className="material-symbols-outlined">credit_card</span>
                Assinatura e Uso
              </a>
            )}
            <a onClick={() => onChangeView(View.HELP)} className={getLinkClass(View.HELP)}>
              <span className="material-symbols-outlined">help</span>
              Central de Ajuda
            </a>
          </div>
        </div>
      </nav>

      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 mb-3 transition-colors"
        >
          <span className="material-symbols-outlined">logout</span>
          Sair do Sistema
        </button>

        <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-2 dark:bg-gray-800/50">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200">
            <img src={avatarUrl} alt="User Avatar" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col overflow-hidden text-left">
            <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {localStorage.getItem('safeguard_user_name') || 'Usuário'}
            </span>
            <span className="truncate text-xs text-text-secondary uppercase">
              {userRole === 'admin' ? 'Administrador SaaS' :
                userRole === 'technician' ? 'Técnico de Segurança' :
                  userRole === 'manager' ? 'Gestor de Empresa' :
                    userRole === 'employee' ? 'Colaborador' : 'Cliente'}
            </span>
          </div>
        </div>
      </div>
    </aside >
  );
};