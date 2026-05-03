import React, { useState, useEffect } from 'react';
import { Risk, ActionPlan, RiskType, RiskStatus, ActionPlanStatus, Company } from '../types';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

// Risk Level Color Helper
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
    const [showModal, setShowModal] = useState(false);
    const [showActionModal, setShowActionModal] = useState(false);
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
            // Build query params
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

    const handleSaveRisk = async () => {
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
            alert('Erro ao salvar risco');
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

    const handleSaveAction = async () => {
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Gestão de Riscos</h1>
                    <p className="text-gray-500">PGR / GRO - Gerenciamento de Riscos Ocupacionais</p>
                </div>
                <button
                    onClick={() => { resetForm(); setEditingRisk(null); setShowModal(true); }}
                    className="bg-primary text-black px-4 py-2 rounded-lg font-bold hover:bg-green-400 flex items-center gap-2"
                >
                    <span className="material-symbols-outlined">add</span>
                    Novo Risco
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-wrap gap-4">
                <select
                    className="flex-1 min-w-[150px] bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
                    value={filterCompany}
                    onChange={e => setFilterCompany(e.target.value)}
                >
                    <option value="">Todas Empresas</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                    className="flex-1 min-w-[150px] bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                >
                    <option value="">Todos Tipos</option>
                    {RISK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select
                    className="flex-1 min-w-[150px] bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
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
                <div className="text-center py-10 text-gray-500">Carregando riscos...</div>
            ) : risks.length === 0 ? (
                <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    Nenhum risco cadastrado.
                </div>
            ) : (
                <div className="space-y-4">
                    {risks.map(risk => {
                        const riskType = RISK_TYPES.find(t => t.value === risk.risk_type);
                        const statusBadge = getStatusBadge(risk.status);
                        const isExpanded = expandedRisk === risk.id;

                        return (
                            <div key={risk.id} className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                                {/* Risk Header */}
                                <div
                                    className="p-4 flex items-start gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    onClick={() => setExpandedRisk(isExpanded ? null : risk.id)}
                                >
                                    {/* Risk Level Badge */}
                                    <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center ${getRiskLevelColor(risk.risk_level)}`}>
                                        <span className="text-xl font-black">{risk.risk_level}</span>
                                        <span className="text-[10px] uppercase font-bold">{getRiskLevelLabel(risk.risk_level)}</span>
                                    </div>

                                    {/* Risk Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`material-symbols-outlined text-lg`}>{riskType?.icon}</span>
                                            <span className="text-xs font-bold text-gray-400 uppercase">{riskType?.label}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusBadge.bg} ${statusBadge.text}`}>
                                                {risk.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">{risk.description}</h3>
                                        <p className="text-sm text-gray-500">{risk.company_name} {risk.source && `• Fonte: ${risk.source}`}</p>
                                        <div className="flex gap-4 mt-2 text-xs text-gray-400">
                                            <span>Probabilidade: <b>{risk.probability}</b></span>
                                            <span>Severidade: <b>{risk.severity}</b></span>
                                            <span>Ações: <b>{risk.action_plans?.length || 0}</b></span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => openEditModal(risk)}
                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                            <span className="material-symbols-outlined text-gray-500">edit</span>
                                        </button>
                                        <a
                                            href={`${API_BASE_URL}/api/reports/action-plan/${risk.id}/pdf`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                            title="Baixar Plano de Ação PDF"
                                        >
                                            <span className="material-symbols-outlined text-primary">picture_as_pdf</span>
                                        </a>
                                        <button
                                            onClick={() => handleDeleteRisk(risk.id)}
                                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            <span className="material-symbols-outlined text-red-500">delete</span>
                                        </button>
                                        <span className="material-symbols-outlined text-gray-400">
                                            {isExpanded ? 'expand_less' : 'expand_more'}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Plans (Expandable) */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-background-dark p-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300">Planos de Ação</h4>
                                            <button
                                                onClick={() => openAddActionModal(risk.id)}
                                                className="text-xs bg-primary text-black px-3 py-1 rounded-lg font-bold hover:bg-green-400"
                                            >
                                                + Adicionar Ação
                                            </button>
                                        </div>
                                        {(!risk.action_plans || risk.action_plans.length === 0) ? (
                                            <p className="text-sm text-gray-400 italic">Nenhum plano de ação cadastrado.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {risk.action_plans.map(action => {
                                                    const actionStatus = getStatusBadge(action.status);
                                                    return (
                                                        <div key={action.id} className="bg-white dark:bg-surface-dark p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                                            <div>
                                                                <p className="font-medium text-gray-900 dark:text-white">{action.measure}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    Responsável: <b>{action.responsible}</b> • Prazo: <b>{new Date(action.deadline).toLocaleDateString()}</b>
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${actionStatus.bg} ${actionStatus.text}`}>
                                                                    {action.status.replace('_', ' ')}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleDeleteAction(action.id)}
                                                                    className="p-1 rounded hover:bg-red-50"
                                                                >
                                                                    <span className="material-symbols-outlined text-sm text-red-400">close</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Risk Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-lg">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-lg font-bold">{editingRisk ? 'Editar Risco' : 'Novo Risco'}</h2>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-bold mb-1">Empresa *</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2"
                                    value={formData.company_id}
                                    onChange={e => setFormData({ ...formData, company_id: e.target.value })}
                                    required
                                >
                                    <option value="">Selecione...</option>
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Tipo de Risco *</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2"
                                    value={formData.risk_type}
                                    onChange={e => setFormData({ ...formData, risk_type: e.target.value as RiskType })}
                                >
                                    {RISK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Descrição *</label>
                                <textarea
                                    className="w-full border rounded-lg px-3 py-2"
                                    rows={3}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Descreva o risco identificado..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Fonte / Agente</label>
                                <input
                                    type="text"
                                    className="w-full border rounded-lg px-3 py-2"
                                    value={formData.source}
                                    onChange={e => setFormData({ ...formData, source: e.target.value })}
                                    placeholder="Ex: Máquinas, Produtos químicos..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold mb-1">Probabilidade (1-5)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={5}
                                        className="w-full border rounded-lg px-3 py-2"
                                        value={formData.probability}
                                        onChange={e => setFormData({ ...formData, probability: Number(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">Severidade (1-5)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={5}
                                        className="w-full border rounded-lg px-3 py-2"
                                        value={formData.severity}
                                        onChange={e => setFormData({ ...formData, severity: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-center">
                                <span className="text-sm text-gray-500">Nível de Risco Calculado:</span>
                                <div className={`inline-block ml-2 px-3 py-1 rounded-lg font-bold ${getRiskLevelColor(formData.probability * formData.severity)}`}>
                                    {formData.probability * formData.severity} - {getRiskLevelLabel(formData.probability * formData.severity)}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Status</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2"
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value as RiskStatus })}
                                >
                                    <option value="aberto">Aberto</option>
                                    <option value="em_andamento">Em Andamento</option>
                                    <option value="resolvido">Resolvido</option>
                                </select>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border hover:bg-gray-50">Cancelar</button>
                            <button onClick={handleSaveRisk} className="px-4 py-2 rounded-lg bg-primary text-black font-bold hover:bg-green-400">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Plan Modal */}
            {showActionModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h2 className="text-lg font-bold">Novo Plano de Ação</h2>
                            <button onClick={() => setShowActionModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-bold mb-1">Medida Corretiva *</label>
                                <textarea
                                    className="w-full border rounded-lg px-3 py-2"
                                    rows={2}
                                    value={actionFormData.measure}
                                    onChange={e => setActionFormData({ ...actionFormData, measure: e.target.value })}
                                    placeholder="Descreva a ação a ser tomada..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Responsável *</label>
                                <input
                                    type="text"
                                    className="w-full border rounded-lg px-3 py-2"
                                    value={actionFormData.responsible}
                                    onChange={e => setActionFormData({ ...actionFormData, responsible: e.target.value })}
                                    placeholder="Nome do responsável"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Prazo *</label>
                                <input
                                    type="date"
                                    className="w-full border rounded-lg px-3 py-2"
                                    value={actionFormData.deadline}
                                    onChange={e => setActionFormData({ ...actionFormData, deadline: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-1">Observações</label>
                                <textarea
                                    className="w-full border rounded-lg px-3 py-2"
                                    rows={2}
                                    value={actionFormData.notes}
                                    onChange={e => setActionFormData({ ...actionFormData, notes: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                            <button onClick={() => setShowActionModal(false)} className="px-4 py-2 rounded-lg border hover:bg-gray-50">Cancelar</button>
                            <button onClick={handleSaveAction} className="px-4 py-2 rounded-lg bg-primary text-black font-bold hover:bg-green-400">Salvar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
