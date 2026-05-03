import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

export const Notifications: React.FC = () => {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/api/notifications`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setNotifications(data);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/api/notifications/run-sync`, {
                method: 'POST',
            });
            const data = await res.json();
            alert(`Sincronização concluída! ${data.processed} novas notificações enviadas.`);
            fetchNotifications();
        } catch (error) {
            console.error('Error syncing notifications:', error);
            alert('Erro ao sincronizar notificações.');
        } finally {
            setSyncing(false);
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'training': return 'school';
            case 'epi': return 'construction';
            case 'action_plan': return 'report_problem';
            case 'visit': return 'event';
            default: return 'notifications';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white lg:text-3xl">Notificações e Alertas</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Histórico de comunicações e alertas automáticos enviados.</p>
                </div>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className={`flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-background-dark shadow-sm hover:bg-green-400 transition-all ${syncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <span className="material-symbols-outlined text-[18px]">{syncing ? 'sync' : 'notifications_active'}</span>
                    {syncing ? 'Sincronizando...' : 'Verificar e Enviar Alertas'}
                </button>
            </div>

            <div className="rounded-xl border border-gray-100 bg-surface-light p-1 dark:border-gray-800 dark:bg-surface-dark overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="font-bold text-gray-900 dark:text-white">Histórico Recente</h2>
                </div>

                {loading ? (
                    <div className="p-10 text-center text-gray-500 animate-pulse">Carregando histórico...</div>
                ) : notifications.length === 0 ? (
                    <div className="p-20 text-center">
                        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">notifications_off</span>
                        <p className="text-gray-500">Nenhuma notificação enviada ainda.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {notifications.map((n) => (
                            <div key={n.id} className="p-4 flex items-start gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${n.category === 'training' ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/20' :
                                    n.category === 'epi' ? 'bg-orange-50 text-orange-500 dark:bg-orange-900/20' :
                                        n.category === 'action_plan' ? 'bg-red-50 text-red-500 dark:bg-red-900/20' :
                                            'bg-green-50 text-green-500 dark:bg-green-900/20'
                                    }`}>
                                    <span className="material-symbols-outlined">{getCategoryIcon(n.category)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{n.subject}</p>
                                        <span className="text-[10px] whitespace-nowrap text-gray-400 font-bold uppercase tracking-wider">
                                            {new Date(n.sent_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2" dangerouslySetInnerHTML={{ __html: n.content }}></p>
                                    <div className="mt-2 flex items-center gap-4">
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                            <span className="material-symbols-outlined text-[14px]">
                                                {n.type === 'email' ? 'alternate_email' : 'chat'}
                                            </span>
                                            {n.recipient}
                                        </span>
                                        <span className={`flex items-center gap-1 text-[10px] font-bold ${n.status === 'simulated' ? 'text-orange-400' : 'text-primary'}`}>
                                            <span className="material-symbols-outlined text-[14px]">
                                                {n.status === 'simulated' ? 'visibility_off' : 'check_circle'}
                                            </span>
                                            {n.status.toUpperCase()}
                                        </span>
                                        {n.type === 'whatsapp' && (
                                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 text-[9px] font-bold uppercase tracking-tight">
                                                WhatsApp
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl p-6 bg-primary/5 border border-primary/20">
                    <h3 className="flex items-center gap-2 font-bold text-primary mb-2">
                        <span className="material-symbols-outlined">info</span>
                        Como funciona?
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        O sistema verifica automaticamente pendências e vencimentos. Alertas são enviados por e-mail para evitar multas e garantir a segurança dos colaboradores.
                        Uma notificação da mesma categoria para o mesmo destinatário só é repetida após um intervalo de segurança (ex: 7 dias para treinamentos).
                    </p>
                </div>
                <div className="rounded-xl p-6 bg-surface-light border border-gray-100 dark:bg-surface-dark dark:border-gray-800">
                    <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white mb-2">
                        <span className="material-symbols-outlined">settings</span>
                        Configuração
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        As notificações são enviadas via e-mail e WhatsApp para os contatos cadastrados de cada empresa.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">mail</span> E-mail Ativo
                        </span>
                        <span className="px-2 py-1 rounded-md bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-green-500/20">
                            <span className="material-symbols-outlined text-[12px]">chat</span> WhatsApp Pronto
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
