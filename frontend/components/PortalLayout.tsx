import React, { ReactNode, useState, useEffect } from 'react';
import { View } from '../types';

interface PortalLayoutProps {
    children: ReactNode;
    currentView: View;
    onChangeView: (view: View) => void;
    onLogout: () => void;
    companyName: string;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({ children, currentView, onChangeView, onLogout, companyName }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            setIsDarkMode(true);
        } else {
            document.documentElement.classList.remove('dark');
            setIsDarkMode(false);
        }
    }, []);

    const toggleTheme = () => {
        if (isDarkMode) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
            setIsDarkMode(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
            setIsDarkMode(true);
        }
    };

    const navItems = [
        { view: View.DASHBOARD, label: 'Visão Geral', icon: 'dashboard' },
        { view: View.REPORTS, label: 'Meus Relatórios', icon: 'description' },
        { view: View.RISKS, label: 'Gestão de Riscos', icon: 'warning' },
        { view: View.SETTINGS, label: 'Configurações', icon: 'settings' },
    ];

    return (
        <div className="flex h-screen w-full bg-background-light dark:bg-background-dark transition-colors duration-300">
            {/* Sidebar */}
            <aside className="w-64 bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-gray-800 flex flex-col hidden md:flex">
                <div className="p-6">
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <span className="material-symbols-outlined text-3xl">shield</span>
                        <span className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">Portal Cliente</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate" title={companyName}>{companyName}</p>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    {navItems.map((item) => (
                        <button
                            key={item.view}
                            onClick={() => onChangeView(item.view)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${currentView === item.view
                                    ? 'bg-primary text-white shadow-lg shadow-green-500/20'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                        >
                            <span className={`material-symbols-outlined ${currentView === item.view ? 'text-white' : 'text-gray-500 group-hover:text-primary'}`}>
                                {item.icon}
                            </span>
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        Sair
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="flex items-center justify-between p-4 px-8 border-b border-gray-200 dark:border-gray-800 bg-surface-light dark:bg-surface-dark">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        {navItems.find(i => i.view === currentView)?.label || 'Portal'}
                    </h1>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="p-2 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"
                        >
                            <span className="material-symbols-outlined icon-filled">
                                {isDarkMode ? 'light_mode' : 'dark_mode'}
                            </span>
                        </button>
                        <div className="md:hidden">
                            {/* Mobile Menu Trigger would go here */}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    {children}
                </main>
            </div>
        </div>
    );
};
