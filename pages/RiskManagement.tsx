import React, { useState, useEffect } from 'react';
import { Risk, ActionPlan, RiskType, RiskStatus, ActionPlanStatus, Company } from '../types';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

// --- Helpers ---
const getRiskLevelColor = (level: number): string => {
    if (level >= 15) return 'bg-red-500 text-white'; // Critical
    if (level >= 9) return 'bg-orange-500 text-white'; // High
    if (level >= 4) return 'bg-yellow-400 text-black'; // Medium
    return 'bg-green-500 text-white'; // Low
};

const getRiskLevelLabel = (level: number): string => {
    if (level >= 15) return 'Crítico';
    if (level >= 9) return 'Alto';
    if (level >= 4) return 'Médio';
    return 'Baixo';
};

const getStatusBadge = (status: RiskStatus | ActionPlanStatus): { bg: string; text: string } => {
    switch (status) {
        case 'aberto':
        case 'pendente':
            return { bg: 'bg-red-100', text: 'text-red-700' };
        case 'em_andamento':
            return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
        case 'resolvido':
        case 'concluído':
            return { bg: 'bg-green-100', text: 'text-green-700' };
        default:
            return { bg: 'bg-gray-100', text: 'text-gray-700' };
    }
};

const RISK_TYPES: { value: RiskType; label: string; icon: string }[] = [
    { value: 'fisico', label: 'Físico', icon: 'hearing' },
    { value: 'quimico', label: 'Químico', icon: 'science' },
    { value: 'biologico', label: 'Biológico', icon: 'coronavirus' },
    { value: 'ergonomico', label: 'Ergonômico', icon: 'accessibility' },
    { value: 'acidente', label: 'Acidente', icon: 'warning' },
];

export const RiskManagement: React.FC = () => {
    const [risks, setRisks] = useState<Risk[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [showActionModal, setShowActionModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);

    const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
    const [selectedRiskId, setSelectedRiskId] = useState<number | null>(null);
    const [expandedRisk, setExpandedRisk] = useState<number | null>(null);

    // Filters
    const [filterCompany, setFilterCompany] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterType, setFilterType] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        company_id: '',
        risk_type: 'fisico' as RiskType,
        description: '',
        source: '',
        probability: 3,
        severity: 3,
        status: 'aberto' as RiskStatus
    });

    const [actionFormData, setActionFormData] = useState({
        measure: '',
        responsible: '',
        deadline: '',
        status: 'pendente' as ActionPlanStatus,
        notes: ''
    });

    useEffect(() => {
        fetchData();
    }, [filterCompany, filterStatus, filterType]);

    const fetchData = async () => {
        try {
            const params = new URLSearchParams();
            if (filterCompany) params.append('company_id', filterCompany);
            if (filterStatus) params.append('status', filterStatus);
            if (filterType) params.append('risk_type', filterType);

            const [risksRes, companiesRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/api/risks?${params}`),
                authFetch(`${API_BASE_URL}/api/companies`)
            ]);

            setRisks(await risksRes.json());
            setCompanies(await companiesRes.json());
        } catch (error) {
            console.error('Error fetching risks:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveRisk = async (e: React.FormEvent) => {
        e.preventDefault(); // Prevents page reload, enables HTML validation
        try {
            const url = editingRisk
                ? `${API_BASE_URL}/api/risks/${editingRisk.id}`
                : `${API_BASE_URL}/api/risks`;
            const method = editingRisk ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error('Erro ao salvar');

            setShowModal(false);
            setEditingRisk(null);
            resetForm();
            fetchData();
        } catch (error) {
            alert('Erro ao salvar risco. Verifique os campos obrigatórios.');
        }
    };

    const handleResolveRisk = async (risk: Risk) => {
        if (!confirm('Deseja marcar este risco como RESOLVIDO?')) return;
        try {
            await authFetch(`${API_BASE_URL}/api/risks/${risk.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...risk, status: 'resolvido' })
            });
            fetchData();
        } catch (error) {
            alert('Erro ao resolver risco');
        }
    };

    const handleDeleteRisk = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir este risco?')) return;
        try {
            await authFetch(`${API_BASE_URL}/api/risks/${id}`, { method: 'DELETE' });
            fetchData();
        } catch (error) {
            alert('Erro ao excluir');
        }
    };

    const handleSaveAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRiskId) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/api/risks/${selectedRiskId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(actionFormData)
            });
            if (!res.ok) throw new Error('Erro ao salvar');
            setShowActionModal(false);
            resetActionForm();
            fetchData();
        } catch (error) {
            alert('Erro ao salvar plano de ação');
        }
    };

    const handleDeleteAction = async (actionId: number) => {
        if (!confirm('Excluir este plano de ação?')) return;
        try {
            await authFetch(`${API_BASE_URL}/api/actions/${actionId}`, { method: 'DELETE' });
            fetchData();
        } catch (error) {
            alert('Erro ao excluir');
        }
    };

    const resetForm = () => {
        setFormData({
            company_id: '',
            risk_type: 'fisico',
            description: '',
            source: '',
            probability: 3,
            severity: 3,
            status: 'aberto'
        });
    };

    const resetActionForm = () => {
        setActionFormData({
            measure: '',
            responsible: '',
            deadline: '',
            status: 'pendente',
            notes: ''
        });
    };

    const openEditModal = (risk: Risk) => {
        setEditingRisk(risk);
        setFormData({
            company_id: risk.company_id,
            risk_type: risk.risk_type,
            description: risk.description,
            source: risk.source || '',
            probability: risk.probability,
            severity: risk.severity,
            status: risk.status
        });
        setShowModal(true);
    };

    const openAddActionModal = (riskId: number) => {
        setSelectedRiskId(riskId);
        resetActionForm();
        setShowActionModal(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Gestão de Riscos</h1>
                        <p className="text-gray-500">PGR / GRO - Gerenciamento de Riscos Ocupacionais</p>
                    </div>
                    <button
                        onClick={() => setShowInfoModal(true)}
                        className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full hover:bg-blue-200 transition-colors"
                        title="Entenda os Níveis de Risco"
                    >
                        <span className="material-symbols-outlined text-xl">help</span>
                    </button>
                </div>
                <button
                    onClick={() => { resetForm(); setEditingRisk(null); setShowModal(true); }}
                    className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-green-400 flex items-center gap-2 shadow-sm"
                >
                    <span className="material-symbols-outlined">add</span>
                    Novo Risco
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-wrap gap-4">
                <select
                    className="flex-1 min-w-[150px] bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm"
                    value={filterCompany}
                    onChange={e => setFilterCompany(e.target.value)}
                >
                    <option value="">Todas Empresas</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                    className="flex-1 min-w-[150px] bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm"
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                >
                    <option value="">Todos Tipos</option>
                    {RISK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select
                    className="flex-1 min-w-[150px] bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm"
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                >
                    <option value="">Todos Status</option>
                    <option value="aberto">Aberto</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="resolvido">Resolvido</option>
                </select>
            </div>

            {/* Risk List */}
            {isLoading ? (
                <div className="text-center py-12">
                    <span className="material-symbols-outlined text-4xl text-gray-400 animate-spin">progress_activity</span>
                    <p className="text-gray-500 mt-2">Carregando riscos...</p>
                </div>
            ) : risks.length === 0 ? (
                <div className="text-center py-12 bg-surface-light dark:bg-surface-dark rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">check_circle</span>
                    <p className="text-lg font-bold text-gray-700 dark:text-gray-300">Tudo Certo!</p>
                    <p className="text-sm text-gray-500">Nenhuma não conformidade encontrada com os filtros atuais.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {risks.map(risk => {
                        const riskType = RISK_TYPES.find(t => t.value === risk.risk_type);
                        const statusBadge = getStatusBadge(risk.status);
                        const isExpanded = expandedRisk === risk.id;

                        return (
                            <div key={risk.id} className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow">
                                {/* Risk Header */}
                                <div
                                    className="p-4 flex flex-col md:flex-row md:items-start gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    onClick={() => setExpandedRisk(isExpanded ? null : risk.id)}
                                >
                                    {/* Risk Level Badge */}
                                    <div className={`w-16 h-16 shrink-0 rounded-xl flex flex-col items-center justify-center ${getRiskLevelColor(risk.risk_level)}`}>
                                        <span className="text-xl font-black">{risk.risk_level}</span>
                                        <span className="text-[10px] uppercase font-bold">{getRiskLevelLabel(risk.risk_level)}</span>
                                    </div>

                                    {/* Risk Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                                <span className={`material-symbols-outlined text-lg`}>{riskType?.icon}</span>
                                                <span className="text-xs font-bold uppercase">{riskType?.label}</span>
                                            </div>
                                            <span className="text-gray-300 dark:text-gray-600">|</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${statusBadge.bg} ${statusBadge.text}`}>
                                                {risk.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight mb-1">{risk.description}</h3>
                                        <p className="text-sm text-gray-500 truncate">{risk.company_name} {risk.source && `• Fonte: ${risk.source}`}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 mt-2 md:mt-0" onClick={e => e.stopPropagation()}>
                                        {risk.status !== 'resolvido' && (
                                            <button
                                                onClick={() => handleResolveRisk(risk)}
                                                className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors text-xs font-bold"
                                                title="Marcar como Resolvido"
                                            >
                                                <span className="material-symbols-outlined text-sm">check</span>
                                                Resolver
                                            </button>
                                        )}
                                        <button onClick={() => openEditModal(risk)} className="p-2 text-gray-400 hover:text-primary transition-colors">
                                            <span className="material-symbols-outlined">edit</span>
                                        </button>
                                        <a
                                            href={`${API_BASE_URL}/api/reports/action-plan/${risk.id}/pdf`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                                            title="Baixar PDF"
                                        >
                                            <span className="material-symbols-outlined">picture_as_pdf</span>
                                        </a>
                                        <button onClick={() => handleDeleteRisk(risk.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                        <span className={`material-symbols-outlined text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-background-dark p-6 animate-fade-in">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                            <div>
                                                <h4 className="text-xs font-bold uppercase text-gray-500 mb-4">Detalhes do Risco</h4>
                                                <div className="space-y-4 text-sm">
                                                    <div className="flex justify-between border-b pb-2 border-dashed border-gray-200 dark:border-gray-700">
                                                        <span className="text-gray-500">Fonte Geradora / Agente:</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{risk.source || 'Não especificada'}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b pb-2 border-dashed border-gray-200 dark:border-gray-700">
                                                        <span className="text-gray-500">Empresa:</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{risk.company_name}</span>
                                                    </div>
                                                    <div className="flex justify-between border-b pb-2 border-dashed border-gray-200 dark:border-gray-700">
                                                        <span className="text-gray-500">Status Atual:</span>
                                                        <span className={`font-bold uppercase ${statusBadge.text}`}>{risk.status.replace('_', ' ')}</span>
                                                    </div>
                                                    <div className="mt-4 bg-white dark:bg-surface-dark p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                                        <p className="text-xs text-center text-gray-500 mb-1">Cálculo de Criticidade (HRN Simplificado)</p>
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="text-center">
                                                                <span className="block text-lg font-bold">{risk.probability}</span>
                                                                <span className="text-[10px] uppercase text-gray-400">Probabilidade</span>
                                                            </div>
                                                            <span className="text-gray-400">×</span>
                                                            <div className="text-center">
                                                                <span className="block text-lg font-bold">{risk.severity}</span>
                                                                <span className="text-[10px] uppercase text-gray-400">Severidade</span>
                                                            </div>
                                                            <span className="text-gray-400">=</span>
                                                            <div className={`px-2 py-1 rounded ${getRiskLevelColor(risk.risk_level)}`}>
                                                                <span className="font-black">{risk.risk_level}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="text-xs font-bold uppercase text-gray-500">Planos de Ação e Medidas de Controle</h4>
                                                    <button
                                                        onClick={() => openAddActionModal(risk.id)}
                                                        className="text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1 rounded shadow-sm font-bold transition-colors"
                                                    >
                                                        + Adicionar Medida
                                                    </button>
                                                </div>

                                                {(!risk.action_plans || risk.action_plans.length === 0) ? (
                                                    <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                                                        <p className="text-sm text-gray-400">Nenhuma medida de controle registrada.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {risk.action_plans.map(action => {
                                                            const actionStatus = getStatusBadge(action.status);
                                                            return (
                                                                <div key={action.id} className="bg-white dark:bg-surface-dark p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex gap-3 relative group">
                                                                    <div className={`w-1 self-stretch rounded-full ${action.status === 'pendente' ? 'bg-orange-400' : 'bg-green-400'}`}></div>
                                                                    <div className="flex-1">
                                                                        <p className="font-medium text-gray-900 dark:text-white text-sm">{action.measure}</p>
                                                                        <div className="flex flex-wrap gap-x-4 mt-1 text-xs text-gray-500">
                                                                            <span>Resp: <b>{action.responsible}</b></span>
                                                                            <span>Prazo: <b>{new Date(action.deadline).toLocaleDateString()}</b></span>
                                                                        </div>
                                                                        {action.notes && <p className="text-xs text-gray-400 mt-1 italic">"{action.notes}"</p>}
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${actionStatus.bg} ${actionStatus.text}`}>
                                                                            {action.status}
                                                                        </span>
                                                                        <button
                                                                            onClick={() => handleDeleteAction(action.id)}
                                                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                                                                            title="Remover Ação"
                                                                        >
                                                                            <span className="material-symbols-outlined text-sm">delete</span>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Risk Modal (FORM WRAPPED) */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="pt-6 px-6 pb-2 flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingRisk ? 'Editar Risco' : 'Novo Risco'}</h2>
                                <p className="text-sm text-gray-500">Preencha os detalhes da não conformidade identificada.</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSaveRisk} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">Empresa *</label>
                                <select
                                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-background-dark focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                                    value={formData.company_id}
                                    onChange={e => setFormData({ ...formData, company_id: e.target.value })}
                                    required
                                >
                                    <option value="">Selecione...</option>
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">Tipo de Risco *</label>
                                <select
                                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-background-dark focus:ring-2 focus:ring-primary/50 outline-none"
                                    value={formData.risk_type}
                                    onChange={e => setFormData({ ...formData, risk_type: e.target.value as RiskType })}
                                >
                                    {RISK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">Descrição do Risco *</label>
                                <textarea
                                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-background-dark focus:ring-2 focus:ring-primary/50 outline-none resize-none"
                                    rows={3}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Descreva detalhadamente o risco ou vulnerabilidade..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">Fonte Geradora / Agente</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-background-dark focus:ring-2 focus:ring-primary/50 outline-none"
                                    value={formData.source}
                                    onChange={e => setFormData({ ...formData, source: e.target.value })}
                                    placeholder="Ex: Máquina de Corte, Ruído contínuo..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div>
                                    <label className="block text-xs font-bold mb-1 uppercase text-gray-500">Probabilidade (1-5)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={5}
                                        className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-center font-bold"
                                        value={formData.probability}
                                        onChange={e => setFormData({ ...formData, probability: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1 uppercase text-gray-500">Severidade (1-5)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={5}
                                        className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-center font-bold"
                                        value={formData.severity}
                                        onChange={e => setFormData({ ...formData, severity: Number(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div className="col-span-2 text-center pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <span className="text-xs text-gray-500 block mb-1">Nível de Risco Resultante</span>
                                    <div className={`inline-block px-4 py-1 rounded-full text-sm font-black shadow-sm ${getRiskLevelColor(formData.probability * formData.severity)}`}>
                                        {formData.probability * formData.severity} • {getRiskLevelLabel(formData.probability * formData.severity)}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">Status Inicial</label>
                                <select
                                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-background-dark"
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value as RiskStatus })}
                                >
                                    <option value="aberto">Aberto</option>
                                    <option value="em_andamento">Em Andamento</option>
                                    <option value="resolvido">Resolvido</option>
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 rounded-lg bg-primary text-black font-bold hover:bg-green-400 shadow-md transition-all hover:scale-105"
                                >
                                    Salvar Risco
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Action Plan Modal (FORM WRAPPED) */}
            {showActionModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Novo Plano de Ação</h2>
                                <p className="text-xs text-gray-500">Defina uma medida de controle para mitigar este risco.</p>
                            </div>
                            <button onClick={() => setShowActionModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSaveAction} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">Medida Corretiva *</label>
                                <textarea
                                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-background-dark focus:ring-2 focus:ring-primary/50"
                                    rows={2}
                                    value={actionFormData.measure}
                                    onChange={e => setActionFormData({ ...actionFormData, measure: e.target.value })}
                                    placeholder="Ex: Instalar proteção física..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">Responsável *</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-background-dark focus:ring-2 focus:ring-primary/50"
                                    value={actionFormData.responsible}
                                    onChange={e => setActionFormData({ ...actionFormData, responsible: e.target.value })}
                                    placeholder="Nome do responsável"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">Prazo Limite *</label>
                                <input
                                    type="date"
                                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-background-dark focus:ring-2 focus:ring-primary/50"
                                    value={actionFormData.deadline}
                                    onChange={e => setActionFormData({ ...actionFormData, deadline: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1 text-gray-700 dark:text-gray-300">Observações</label>
                                <textarea
                                    className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-background-dark focus:ring-2 focus:ring-primary/50"
                                    rows={2}
                                    value={actionFormData.notes}
                                    onChange={e => setActionFormData({ ...actionFormData, notes: e.target.value })}
                                />
                            </div>
                            <div className="pt-2 flex justify-end gap-2">
                                <button type="button" onClick={() => setShowActionModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Cancelar</button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-primary text-black font-bold hover:bg-green-400 shadow-md">Adicionar Plano</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Info / Help Modal */}
            {showInfoModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-fade-in" onClick={() => setShowInfoModal(false)}>
                    <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-500">info</span>
                                Guia de Gestão de Riscos
                            </h2>
                            <button onClick={() => setShowInfoModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <section>
                                <h3 className="text-sm font-black uppercase text-gray-500 mb-3 tracking-wider">Matriz de Risco (HRN Simplificado)</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">O Nível de Risco é calculado multiplicando a <b>Probabilidade</b> pela <b>Severidade</b> da ocorrência.</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg p-3 text-center">
                                        <div className="text-green-600 font-black text-xl mb-1">1 - 3</div>
                                        <div className="text-green-700 font-bold text-xs uppercase">Risco Baixo</div>
                                    </div>
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg p-3 text-center">
                                        <div className="text-yellow-600 font-black text-xl mb-1">4 - 8</div>
                                        <div className="text-yellow-700 font-bold text-xs uppercase">Risco Médio</div>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-lg p-3 text-center">
                                        <div className="text-orange-600 font-black text-xl mb-1">9 - 14</div>
                                        <div className="text-orange-700 font-bold text-xs uppercase">Risco Alto</div>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-3 text-center">
                                        <div className="text-red-600 font-black text-xl mb-1">15 - 25</div>
                                        <div className="text-red-700 font-bold text-xs uppercase">Crítico</div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-sm font-black uppercase text-gray-500 mb-3 tracking-wider">Status e Fluxo</h3>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <span className="w-3 h-3 rounded-full bg-red-400 mt-1.5 shrink-0"></span>
                                        <div>
                                            <span className="font-bold text-gray-900 dark:text-white text-sm">Aberto</span>
                                            <p className="text-xs text-gray-500">O risco foi identificado mas ainda não foram definidas ações de controle.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="w-3 h-3 rounded-full bg-yellow-400 mt-1.5 shrink-0"></span>
                                        <div>
                                            <span className="font-bold text-gray-900 dark:text-white text-sm">Em Andamento</span>
                                            <p className="text-xs text-gray-500">Planos de ação foram criados e estão sendo executados.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="w-3 h-3 rounded-full bg-green-400 mt-1.5 shrink-0"></span>
                                        <div>
                                            <span className="font-bold text-gray-900 dark:text-white text-sm">Resolvido</span>
                                            <p className="text-xs text-gray-500">O risco foi mitigado ou eliminado e as ações foram concluídas.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 flex justify-end">
                            <button
                                onClick={() => setShowInfoModal(false)}
                                className="px-6 py-2 bg-primary text-black font-bold rounded-lg hover:bg-green-400 transition-colors shadow-sm"
                            >
                                Entendi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
