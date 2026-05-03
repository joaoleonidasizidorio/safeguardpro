import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export const PortalDashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const companyId = localStorage.getItem('safeguard_company_id');

    useEffect(() => {
        if (companyId) {
            fetchDashboardData();
        }
    }, [companyId]);

    const fetchDashboardData = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/company/${companyId}/dashboard`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Carregando dados...</div>;
    if (!data) return <div className="p-8 text-center text-red-500">Erro ao carregar dados.</div>;

    const { company, recentVisits, pendingActions, openInspections } = data;

    return (
        <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-2">Bem-vindo, {company.name}</h2>
                    <p className="opacity-90 max-w-xl">Acompanhe aqui o status de segurança da sua empresa, documentos e ações pendentes.</p>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                    <span className="material-symbols-outlined text-[200px]">business</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                        <span className="material-symbols-outlined text-2xl">pending_actions</span>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Inspeções Abertas</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{openInspections.length}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                        <span className="material-symbols-outlined text-2xl">warning</span>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Ações Pendentes</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingActions.length}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                        <span className="material-symbols-outlined text-2xl">event_available</span>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Próxima Visita</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{company.next_visit || 'Não agendada'}</p>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Recent Visits */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 font-bold text-gray-900 dark:text-white flex justify-between items-center">
                        <span>Últimas Visitas</span>
                        <button className="text-xs text-primary font-bold">Ver Todas</button>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {recentVisits.length === 0 ? <p className="p-4 text-gray-500 text-sm">Nenhuma visita recente.</p> : recentVisits.map((visit: any) => (
                            <div key={visit.id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <div>
                                    <p className="font-bold text-gray-800 dark:text-gray-200">{new Date(visit.scheduled_at).toLocaleDateString()}</p>
                                    <p className="text-xs text-gray-500 uppercase">{visit.visit_type}</p>
                                </div>
                                <div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${visit.status === 'Concluído' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {visit.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Plans */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 font-bold text-gray-900 dark:text-white flex justify-between items-center">
                        <span>Ações Prioritárias</span>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {pendingActions.length === 0 ? <p className="p-4 text-gray-500 text-sm">Nenhuma ação pendente.</p> : pendingActions.map((action: any) => (
                            <div key={action.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <p className="font-medium text-gray-800 dark:text-gray-200">{action.measure}</p>
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-xs text-red-500 font-bold">Risco: {action.risk_desc}</span>
                                    <span className="text-xs text-gray-500">Prazo: {new Date(action.deadline).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
