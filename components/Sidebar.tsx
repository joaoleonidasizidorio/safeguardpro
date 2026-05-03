import React, { useState, useEffect } from 'react';
import { View } from '../types';
import { API_BASE_URL } from '../config';

interface SidebarProps {
  currentView: View;
  onChangeView: (view: View) => void;
  isOpen: boolean;
  onLogout: () => void;
}

interface MenuCategory {
  id: string;
  label: string;
  icon: string;
  items: MenuItem[];
}

interface MenuItem {
  view: View;
  label: string;
  icon: string;
  roles?: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, isOpen, onLogout }) => {
  const userRole = localStorage.getItem('safeguard_user_type');

  // Estado para categorias expandidas
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('safeguard_menu_state');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return { painel: true, gestao: true, sst: true, capacitacao: true, docs: true, sistema: true };
  });

  // Salvar estado no localStorage
  useEffect(() => {
    localStorage.setItem('safeguard_menu_state', JSON.stringify(expandedCategories));
  }, [expandedCategories]);

  const getFullAvatarUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${API_BASE_URL}${path}`;
  };

  const [avatarUrl, setAvatarUrl] = useState(() => {
    const stored = localStorage.getItem('safeguard_user_avatar');
    if (stored) return getFullAvatarUrl(stored);
    return `https://i.pravatar.cc/150?u=${localStorage.getItem('safeguard_user_email')}`;
  });

  useEffect(() => {
    const handleProfileUpdate = () => {
      const stored = localStorage.getItem('safeguard_user_avatar');
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

  const [brandInfo, setBrandInfo] = useState({
    name: localStorage.getItem('safeguard_brand_name') || 'Portal SST',
    logo: localStorage.getItem('safeguard_brand_logo') || null
  });

  useEffect(() => {
    const updateBrand = () => {
      setBrandInfo({
        name: localStorage.getItem('safeguard_brand_name') || 'Portal SST',
        logo: localStorage.getItem('safeguard_brand_logo') || null
      });
    };
    window.addEventListener('white-label-update', updateBrand);
    return () => window.removeEventListener('white-label-update', updateBrand);
  }, []);

  // Definição das categorias do menu
  const menuCategories: MenuCategory[] = [
    {
      id: 'painel',
      label: 'Painel',
      icon: 'dashboard',
      items: [
        { view: View.DASHBOARD, label: 'Visão Geral', icon: 'home' },
        { view: View.NOTIFICATIONS, label: 'Notificações', icon: 'notifications_active' },
      ]
    },
    {
      id: 'gestao',
      label: 'Gestão Empresarial',
      icon: 'domain',
      items: [
        { view: View.COMPANIES, label: 'Empresas', icon: 'business', roles: ['admin', 'technician'] },
        { view: View.VISITS, label: 'Visitas Técnicas', icon: 'event', roles: ['admin', 'technician'] },
        { view: View.AUDIT, label: 'Auditorias & Vistorias', icon: 'fact_check' },
      ]
    },
    {
      id: 'sst',
      label: 'Saúde e Segurança',
      icon: 'health_and_safety',
      items: [
        { view: View.RISKS, label: 'Gestão de Riscos', icon: 'emergency' },
        { view: View.INCIDENT_MANAGEMENT, label: 'Incidentes (CAT)', icon: 'notification_important' },
        { view: View.ASO_MANAGEMENT, label: 'Gestão de ASO', icon: 'clinical_notes' },
        { view: View.EPI_MANAGEMENT, label: 'Gestão de EPIs', icon: 'construction' },
      ]
    },
    {
      id: 'capacitacao',
      label: 'Capacitação',
      icon: 'school',
      items: [
        { view: View.TRAININGS, label: 'Treinamentos', icon: 'menu_book' },
        { view: View.ALERTS, label: 'Não Conformidades', icon: 'warning' },
      ]
    },
    {
      id: 'docs',
      label: 'Documentação',
      icon: 'folder_open',
      items: [
        { view: View.LEGAL_DOCUMENTS, label: 'Documentos Legais', icon: 'folder_managed', roles: ['admin', 'technician', 'manager'] },
        { view: View.EVIDENCES, label: 'Registro Fotográfico', icon: 'photo_library' },
      ]
    },
    {
      id: 'sistema',
      label: 'Sistema',
      icon: 'settings',
      items: [
        { view: View.ADMIN, label: 'Administração', icon: 'admin_panel_settings', roles: ['admin'] },
        { view: View.SUBSCRIPTION, label: 'Assinatura e Uso', icon: 'credit_card', roles: ['admin', 'technician'] },
        { view: View.SETTINGS, label: 'Configurações', icon: 'tune' },
        { view: View.HELP, label: 'Central de Ajuda', icon: 'help' },
      ]
    },
  ];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const canViewItem = (item: MenuItem) => {
    if (!item.roles) return true;
    return item.roles.includes(userRole || '');
  };

  const getLinkClass = (view: View) => {
    const base = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer ";
    if (currentView === view) {
      return base + "bg-primary/10 text-green-700 dark:text-primary";
    }
    return base + "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-surface-dark dark:hover:text-gray-200";
  };

  const getCategoryClass = (categoryId: string) => {
    const base = "flex items-center justify-between w-full px-2 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg cursor-pointer transition-all ";
    const isExpanded = expandedCategories[categoryId];
    return base + (isExpanded
      ? "text-green-700 dark:text-primary bg-primary/5"
      : "text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800");
  };

  const containerClass = `fixed inset-y-0 left-0 z-50 w-64 bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-200 lg:translate-x-0 lg:static lg:flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`;

  // Filtrar categorias que têm pelo menos um item visível
  const visibleCategories = menuCategories.map(category => ({
    ...category,
    items: category.items.filter(canViewItem)
  })).filter(category => category.items.length > 0);

  return (
    <aside className={containerClass}>
      <div className="flex h-16 items-center px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {brandInfo.logo ? (
            <img src={`${API_BASE_URL}${brandInfo.logo}`} alt="Logo" className="h-8 w-auto object-contain" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-background-dark">
              <span className="material-symbols-outlined text-[20px]">shield</span>
            </span>
          )}
          <span className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[160px]">{brandInfo.name}</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          {visibleCategories.map((category) => (
            <div key={category.id} className="flex flex-col">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className={getCategoryClass(category.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">{category.icon}</span>
                  <span>{category.label}</span>
                </div>
                <span
                  className={`material-symbols-outlined text-[16px] transition-transform duration-200 ${expandedCategories[category.id] ? 'rotate-180' : ''
                    }`}
                >
                  expand_more
                </span>
              </button>

              {/* Category Items */}
              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${expandedCategories[category.id]
                    ? 'max-h-96 opacity-100 mt-1'
                    : 'max-h-0 opacity-0'
                  }`}
              >
                <div className="flex flex-col gap-0.5 pl-2">
                  {category.items.map((item) => (
                    <a
                      key={item.view}
                      onClick={() => onChangeView(item.view)}
                      className={getLinkClass(item.view)}
                    >
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
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
            <img src={avatarUrl || ''} alt="User Avatar" className="h-full w-full object-cover" />
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
    </aside>
  );
};