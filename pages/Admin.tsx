import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export const Admin: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'lgpd' | 'backup' | 'financial'>('users');
    const [users, setUsers] = useState<any[]>([]);
    const [financialData, setFinancialData] = useState<any>(null);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [backups, setBackups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // User Form State
    const [showUserModal, setShowUserModal] = useState(false);

    const [editingUser, setEditingUser] = useState<any>(null);
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'technician', active: true });

    // Backup Restore Modal State
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [backupToRestore, setBackupToRestore] = useState<string | null>(null);
    const [restoreConfirmation, setRestoreConfirmation] = useState('');

    // Get auth token from localStorage (set after login)
    const getAuthToken = () => localStorage.getItem('authToken') || '';

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/users`, {
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = editingUser
                ? `${API_BASE_URL}/api/users/${editingUser.id}`
                : `${API_BASE_URL}/api/users`;

            const method = editingUser ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                alert(editingUser ? 'Usuário atualizado!' : 'Usuário criado!');
                setShowUserModal(false);
                setEditingUser(null);
                setFormData({ name: '', email: '', password: '', role: 'technician', active: true });
                fetchUsers();
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao salvar usuário');
            }
        } catch (error) {
            console.error(error);
            alert('Erro de conexão');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });
            if (res.ok) {
                alert('Usuário excluído!');
                fetchUsers();
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAuditLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/audit-logs?limit=50`, {
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAuditLogs(data);
            }
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBackups = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/backup/list`, {
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setBackups(data);
            }
        } catch (error) {
            console.error('Error fetching backups:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFinancialData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/financial/dashboard`, {
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFinancialData(data);
            }
        } catch (error) {
            console.error('Error fetching financial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const createBackup = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/backup/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            if (res.ok) {
                alert('Backup criado com sucesso! (Modo simulação)');
                fetchBackups();
            }
        } catch (error) {
            console.error('Error creating backup:', error);
            alert('Erro ao criar backup.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBackup = async (filename: string) => {
        if (!confirm('Tem certeza que deseja excluir este backup permanentemente?')) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/backup/${filename}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });
            if (res.ok) {
                alert('Backup excluído com sucesso!');
                fetchBackups();
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao excluir backup');
            }
        } catch (error) {
            console.error(error);
            alert('Erro de conexão');
        } finally {
            setLoading(false);
        }
    };



    const handleDownloadBackup = async (filename: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/backup/${filename}/download`, {
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                alert('Erro ao baixar backup');
            }
        } catch (error) {
            console.error(error);
            alert('Erro de conexão');
        }
    };

    const handleUploadBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.sql')) {
            alert('Apenas arquivos .sql são permitidos');
            return;
        }

        const formData = new FormData();
        formData.append('backup_file', file);

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/backup/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getAuthToken()}` },
                body: formData
            });

            if (res.ok) {
                alert('Backup enviado com sucesso!');
                fetchBackups();
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao enviar backup');
            }
        } catch (error) {
            console.error(error);
            alert('Erro de conexão');
        } finally {
            setLoading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const openRestoreModal = (filename: string) => {
        setBackupToRestore(filename);
        setRestoreConfirmation('');
        setShowRestoreModal(true);
    };

    const confirmRestore = async () => {
        if (restoreConfirmation !== 'RESTAURAR') return;
        if (!backupToRestore) return;

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/backup/restore`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filename: backupToRestore })
            });

            if (res.ok) {
                alert('Sistema restaurado com sucesso! A página será recarregada.');
                window.location.reload();
            } else {
                const err = await res.json();
                alert(err.error || 'Erro ao restaurar sistema');
            }
        } catch (error) {
            console.error(error);
            alert('Erro de conexão');
        } finally {
            setLoading(false);
            setShowRestoreModal(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        } else if (activeTab === 'audit') {
            fetchAuditLogs();
        } else if (activeTab === 'backup') {
            fetchBackups();
        } else if (activeTab === 'financial') {
            fetchFinancialData();
        }
    }, [activeTab]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white lg:text-3xl">Administração (SaaS)</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Segurança, auditoria e compliance do sistema.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'users'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    <span className="material-symbols-outlined text-[18px] mr-2">group</span>
                    Gestão de Usuários
                </button>
                <button
                    onClick={() => setActiveTab('audit')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'audit'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    Logs de Auditoria
                </button>
                <button
                    onClick={() => setActiveTab('lgpd')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'lgpd'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    LGPD
                </button>
                <button
                    onClick={() => setActiveTab('backup')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'backup'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    Backups
                </button>
                <button
                    onClick={() => setActiveTab('financial')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'financial'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                >
                    Financeiro
                </button>
            </div>

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                setEditingUser(null);
                                setFormData({ name: '', email: '', password: '', role: 'technician', active: true });
                                setShowUserModal(true);
                            }}
                            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-opacity-90 transition-all"
                        >
                            <span className="material-symbols-outlined">person_add</span>
                            Novo Usuário
                        </button>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-surface-light dark:border-gray-800 dark:bg-surface-dark overflow-hidden">
                        <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-700 dark:text-gray-300">
                                <tr>
                                    <th className="px-6 py-3">Nome</th>
                                    <th className="px-6 py-3">Email / Login</th>
                                    <th className="px-6 py-3">Função</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{user.name}</td>
                                        <td className="px-6 py-4">{user.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}>
                                                {user.role === 'admin' ? 'Administrador' : 'Técnico'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`flex items-center gap-1 text-xs font-bold uppercase ${user.active ? 'text-green-500' : 'text-red-500'}`}>
                                                <span className={`h-2 w-2 rounded-full ${user.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                {user.active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingUser(user);
                                                    setFormData({ name: user.name, email: user.email, password: '', role: user.role, active: user.active });
                                                    setShowUserModal(true);
                                                }}
                                                className="text-primary hover:text-green-400"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">edit</span>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="text-red-500 hover:text-red-400"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* User Modal */}
            {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md bg-white dark:bg-surface-dark rounded-xl p-6 shadow-xl animate-fade-in">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                            {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                        </h2>
                        <form onSubmit={handleUserSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome Completo</label>
                                <input
                                    type="text"
                                    required
                                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-light px-3 py-2 text-sm focus:border-primary focus:outline-none dark:text-white"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                <input
                                    type="email"
                                    required
                                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-light px-3 py-2 text-sm focus:border-primary focus:outline-none dark:text-white"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {editingUser ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
                                </label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-light px-3 py-2 text-sm focus:border-primary focus:outline-none dark:text-white"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Função</label>
                                <select
                                    className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-light px-3 py-2 text-sm focus:border-primary focus:outline-none dark:text-white"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="technician">Técnico</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            {/* SaaS Licensing Fields (Only for New Users) */}
                            {!editingUser && (
                                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <div className="col-span-2">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Licenciamento SaaS</h4>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Atribuir Plano</label>
                                        <select
                                            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-light px-2 py-1.5 text-sm focus:border-primary focus:outline-none dark:text-white"
                                            value={(formData as any).plan_id || ''}
                                            onChange={(e) => setFormData({ ...formData, plan_id: e.target.value } as any)}
                                        >
                                            <option value="">Sem Plano (Padrão)</option>
                                            <option value="2">Pro (Consultoria)</option>
                                            <option value="3">Enterprise</option>
                                            <option value="1">Free</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Duração (Dias)</label>
                                        <input
                                            type="number"
                                            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-light px-2 py-1.5 text-sm focus:border-primary focus:outline-none dark:text-white disabled:opacity-50"
                                            value={(formData as any).trial_days || 90}
                                            onChange={(e) => setFormData({ ...formData, trial_days: e.target.value } as any)}
                                            disabled={!(formData as any).plan_id}
                                        />
                                    </div>
                                    <div className="col-span-2 text-[10px] text-gray-400">
                                        * Ao selecionar um plano, o usuário se tornará um novo inquilino (Owner) independente.
                                    </div>
                                </div>
                            )}

                            {editingUser && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="active"
                                        checked={formData.active}
                                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <label htmlFor="active" className="text-sm font-medium text-gray-700 dark:text-gray-300">Usuário Ativo</label>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowUserModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-white/5"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-opacity-90 disabled:opacity-50"
                                >
                                    {loading ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Audit Logs Tab */}
            {activeTab === 'audit' && (
                <div className="rounded-xl border border-gray-100 bg-surface-light dark:border-gray-800 dark:bg-surface-dark overflow-hidden">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-700 dark:text-gray-300">
                            <tr>
                                <th className="px-6 py-3">Timestamp</th>
                                <th className="px-6 py-3">Usuário</th>
                                <th className="px-6 py-3">Ação</th>
                                <th className="px-6 py-3">Recurso</th>
                                <th className="px-6 py-3 text-right">Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {auditLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">Nenhum log encontrado.</td>
                                </tr>
                            ) : (
                                auditLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-900 dark:text-white">{log.user_name || 'Sistema'}</span>
                                                <span className="text-xs uppercase text-gray-500 tracking-wider font-bold">{log.user_role || 'Auto'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded text-[11px] font-mono text-primary font-bold">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs text-gray-600 dark:text-gray-400">
                                                {log.resource_type || '-'} {log.resource_id ? `(${log.resource_id})` : ''}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => alert(JSON.stringify(log.details, null, 2))}
                                                className="text-primary hover:text-green-400 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">info</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* LGPD Tab */}
            {activeTab === 'lgpd' && (
                <div className="space-y-6">
                    <div className="rounded-xl p-6 bg-primary/5 border border-primary/20">
                        <h3 className="flex items-center gap-2 font-bold text-primary mb-2">
                            <span className="material-symbols-outlined">shield</span>
                            Gestão de Dados Pessoais (LGPD)
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                            Sistema em conformidade com a Lei Geral de Proteção de Dados (LGPD).
                            Gerencie consentimentos, exporte dados e processe solicitações de esquecimento.
                        </p>

                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="p-4 bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-green-500 text-[18px]">verified_user</span>
                                    <span className="font-semibold text-xs text-gray-900 dark:text-white">Consentimentos</span>
                                </div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Status: Ativo</p>
                            </div>
                            <div className="p-4 bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-blue-500 text-[18px]">download</span>
                                    <span className="font-semibold text-xs text-gray-900 dark:text-white">Portabilidade</span>
                                    <span className="ml-auto bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">JSON</span>
                                </div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">API v1.0</p>
                            </div>
                            <div className="p-4 bg-white dark:bg-surface-dark rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-orange-500 text-[18px]">no_accounts</span>
                                    <span className="font-semibold text-xs text-gray-900 dark:text-white">Esquecimento</span>
                                </div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold">Anonimização</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-4">Solicitação de Titular</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Titular</label>
                                    <select id="lgpd-type" className="w-full bg-gray-50 dark:bg-surface-light border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none dark:text-white">
                                        <option value="employee">Colaborador</option>
                                        <option value="company">Empresa (Contato)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">ID ou Referência</label>
                                    <input id="lgpd-id" type="text" placeholder="Ex: ID do Colaborador" className="w-full bg-gray-50 dark:bg-surface-light border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none dark:text-white" />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={async () => {
                                            const type = (document.getElementById('lgpd-type') as HTMLSelectElement).value;
                                            const id = (document.getElementById('lgpd-id') as HTMLInputElement).value;
                                            if (!id) return alert('Informe o ID');
                                            try {
                                                const res = await fetch(`${API_BASE_URL}/api/lgpd/data/${type}/${id}`, {
                                                    headers: { 'Authorization': `Bearer ${getAuthToken()}` }
                                                });
                                                if (res.ok) {
                                                    const data = await res.json();
                                                    console.log('LGPD Export:', data);
                                                    alert('Dados recuperados com sucesso! Verifique o console para os detalhes do JSON.');
                                                } else {
                                                    alert('Erro ao buscar dados');
                                                }
                                            } catch (err) { alert('Erro de conexão'); }
                                        }}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-500 transition-colors flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">download</span>
                                        Exportar Dados
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const type = (document.getElementById('lgpd-type') as HTMLSelectElement).value;
                                            const id = (document.getElementById('lgpd-id') as HTMLInputElement).value;
                                            if (!id) return alert('Informe o ID');
                                            if (!confirm('Deseja realmente anonimizar os dados? Esta ação não pode ser desfeita.')) return;
                                            try {
                                                const res = await fetch(`${API_BASE_URL}/api/lgpd/data/${type}/${id}`, {
                                                    method: 'DELETE',
                                                    headers: { 'Authorization': `Bearer ${getAuthToken()}` }
                                                });
                                                if (res.ok) alert('Dados anonimizados com sucesso!');
                                                else alert('Erro ao processar esquecimento');
                                            } catch (err) { alert('Erro de conexão'); }
                                        }}
                                        className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-500 transition-colors flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">no_accounts</span>
                                        Processar Esquecimento
                                    </button>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-surface-light rounded-xl p-4 flex flex-col items-center justify-center text-center opacity-60">
                                <span className="material-symbols-outlined text-4xl mb-2">preview</span>
                                <p className="text-xs text-gray-500">A visualização prévia dos dados será implementada na v2.0</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Backup Tab */}
            {activeTab === 'backup' && (
                <div className="rounded-xl border border-gray-100 bg-surface-light dark:border-gray-800 dark:bg-surface-dark overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <h2 className="font-bold text-gray-900 dark:text-white">Backups do Sistema</h2>
                        <div className="flex gap-2">
                            <label className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-all cursor-pointer">
                                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                                Upload Backup
                                <input type="file" className="hidden" accept=".sql" onChange={handleUploadBackup} />
                            </label>
                            <button
                                onClick={createBackup}
                                disabled={loading}
                                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-400 transition-all disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-[18px]">backup</span>
                                Criar Backup
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-10 text-center text-gray-500 animate-pulse">Carregando backups...</div>
                    ) : backups.length === 0 ? (
                        <div className="p-20 text-center">
                            <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">cloud_off</span>
                            <p className="text-gray-500">Nenhum backup registrado.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            {backups.map((backup) => (
                                <div key={backup.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${backup.status === 'success' ? 'bg-green-50 text-green-500 dark:bg-green-900/20' :
                                            backup.status === 'simulated' ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/20' :
                                                'bg-red-50 text-red-500 dark:bg-red-900/20'
                                            }`}>
                                            <span className="material-symbols-outlined">
                                                {backup.status === 'failed' ? 'error' : 'cloud_done'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{backup.file_path}</p>
                                            <p className="text-xs text-gray-500">
                                                {backup.backup_type.toUpperCase()} • {new Date(backup.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${backup.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                        backup.status === 'simulated' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                        {backup.status}
                                    </span>

                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() => handleDownloadBackup(backup.file_path)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg dark:text-blue-400 dark:hover:bg-blue-900/20"
                                            title="Baixar Backup"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">download</span>
                                        </button>
                                        <button
                                            onClick={() => openRestoreModal(backup.file_path)}
                                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg dark:text-yellow-400 dark:hover:bg-yellow-900/20"
                                            title="Restaurar Backup"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">settings_backup_restore</span>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBackup(backup.file_path)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg dark:text-red-400 dark:hover:bg-red-900/20"
                                            title="Excluir Backup"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Financial Tab */}
            {activeTab === 'financial' && financialData && (
                <div className="space-y-6">
                    {/* Metrics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/20 dark:text-green-400">
                                    <span className="material-symbols-outlined text-3xl">attach_money</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Receita Total</p>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">R$ {financialData.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/20 dark:text-blue-400">
                                    <span className="material-symbols-outlined text-3xl">workspace_premium</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Assinaturas Ativas</p>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{financialData.activeSubscriptions}</h3>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/20 dark:text-orange-400">
                                    <span className="material-symbols-outlined text-3xl">pending</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Pagamentos Pendentes</p>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{financialData.pendingPayments}</h3>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chart & Transactions */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-100 dark:border-gray-800 p-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Receita Mensal</h3>
                            <div className="h-64 flex items-end justify-between gap-2">
                                {financialData.monthlyRevenue.map((m: any) => {
                                    const maxVal = Math.max(...financialData.monthlyRevenue.map((d: any) => parseFloat(d.total)));
                                    const height = (parseFloat(m.total) / maxVal) * 100;
                                    return (
                                        <div key={m.month} className="w-full flex flex-col items-center">
                                            <div
                                                className="w-full bg-primary/80 rounded-t-sm hover:bg-primary transition-all relative group"
                                                style={{ height: `${height}%` }}
                                            >
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                    R$ {parseFloat(m.total).toLocaleString('pt-BR')}
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-500 mt-2">{m.month}</span>
                                        </div>
                                    );
                                })}
                                {financialData.monthlyRevenue.length === 0 && <p className="text-center w-full text-gray-400">Sem dados de receita ainda.</p>}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white p-6 border-b border-gray-100 dark:border-gray-800">Transações Recentes</h3>
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-700 dark:text-gray-300">
                                    <tr>
                                        <th className="px-4 py-3">Data</th>
                                        <th className="px-4 py-3">Usuário</th>
                                        <th className="px-4 py-3">Valor</th>
                                        <th className="px-4 py-3 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {financialData.transactions.map((tx: any) => (
                                        <tr key={tx.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5">
                                            <td className="px-4 py-3">{new Date(tx.created_at).toLocaleDateString()}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900 dark:text-white">{tx.user_name}</div>
                                                <div className="text-xs">{tx.method === 'credit_card' ? 'Cartão' : 'Pix'}</div>
                                            </td>
                                            <td className="px-4 py-3">R$ {parseFloat(tx.amount).toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${tx.status === 'paid' ? 'bg-green-100 text-green-700' :
                                                    tx.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {tx.status === 'paid' ? 'Pago' : tx.status === 'pending' ? 'Pendente' : 'Falhou'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {financialData.transactions.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-400">Nenhuma transação encontrada.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Restore Confirmation Modal */}
            {showRestoreModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-white dark:bg-surface-dark rounded-xl p-6 shadow-2xl border-2 border-red-500 animate-scale-up">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-4xl text-red-600 dark:text-red-500">warning</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Atenção: Restauração de Sistema</h2>
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                Você está prestes a restaurar o backup <strong>{backupToRestore}</strong>.
                            </p>
                            <p className="mt-4 text-sm font-bold text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/50">
                                ATENÇÃO: Todos os dados atuais serão SUBSTITUÍDOS PERMANENTEMENTE pelos dados deste backup. Esta ação é irreversível.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Para confirmar, digite <span className="font-mono font-bold select-all">RESTAURAR</span> abaixo:
                                </label>
                                <input
                                    type="text"
                                    className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 p-3 text-center font-bold tracking-widest focus:border-red-500 focus:ring-red-500 uppercase dark:bg-surface-light dark:text-white"
                                    placeholder="RESTAURAR"
                                    value={restoreConfirmation}
                                    onChange={(e) => setRestoreConfirmation(e.target.value.toUpperCase())}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowRestoreModal(false)}
                                    className="flex-1 px-4 py-3 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg dark:text-gray-300 dark:bg-white/5 dark:hover:bg-white/10"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmRestore}
                                    disabled={restoreConfirmation !== 'RESTAURAR' || loading}
                                    className="flex-1 px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/30"
                                >
                                    {loading ? 'Restaurando...' : 'CONFIRMAR RESTAURAÇÃO'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
