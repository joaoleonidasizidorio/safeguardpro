import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

interface ActionPlan {
    id: number;
    measure: string;
    responsible: string;
    deadline: string;
    status: string;
    notes?: string;
}

interface Incident {
    id: number;
    company_id: string;
    employee_id?: number;
    employee_name?: string;
    type: 'Incidente' | 'Acidente' | 'Quase-acidente' | 'Acidente Típico';
    date: string;
    location: string;
    description: string;
    severity?: 'Leve' | 'Moderado' | 'Grave' | 'Fatal';
    investigation_result?: string;
    status: 'Aberto' | 'Em Investigação' | 'Concluído';
    created_at: string;
    photos: string[];
    action_plans: ActionPlan[];
    // Enhanced fields
    generating_source?: string;
    body_part?: string;
    injured_person_report?: string;
    witness_report?: string;
    possible_causes?: string;
    conclusion?: string;
}

export const IncidentManagement: React.FC = () => {
    const [companies, setCompanies] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [incidents, setIncidents] = useState<Incident[]>([]);

    // Modal & Form (Registration)
    const [isRegModalOpen, setIsRegModalOpen] = useState(false);
    const [regData, setRegData] = useState({
        employee_id: '',
        type: 'Incidente',
        date: new Date().toISOString().slice(0, 16),
        location: '',
        description: '',
        severity: 'Leve'
    });
    const [tempPhotos, setTempPhotos] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    // Modal (Investigation)
    const [isInvModalOpen, setIsInvModalOpen] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
    const [invData, setInvData] = useState({
        generating_source: '',
        body_part: '',
        injured_person_report: '',
        witness_report: '',
        possible_causes: '',
        conclusion: '',
        investigation_result: '' // keeping legacy just in case, but 'conclusion' is primary UI
    });
    const [invStatus, setInvStatus] = useState<'Aberto' | 'Em Investigação' | 'Concluído'>('Aberto');

    // Modal (Action Plan)
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [actionData, setActionData] = useState({ measure: '', responsible: '', deadline: '', notes: '' });

    useEffect(() => {
        authFetch(`${API_BASE_URL}/api/companies`)
            .then(res => res.json())
            .then(data => {
                setCompanies(data);
                if (data.length > 0) setSelectedCompanyId(data[0].id);
            });
    }, []);

    useEffect(() => {
        if (!selectedCompanyId) return;
        fetchEmployees();
        fetchIncidents();
    }, [selectedCompanyId]);

    const fetchEmployees = async () => {
        const res = await authFetch(`${API_BASE_URL}/api/employees?company_id=${selectedCompanyId}`);
        if (res.ok) setEmployees(await res.json());
    };

    const fetchIncidents = async () => {
        const res = await authFetch(`${API_BASE_URL}/api/incidents?company_id=${selectedCompanyId}`);
        if (res.ok) setIncidents(await res.json());
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        setUploading(true);
        const files = Array.from(e.target.files);
        const uploadedUrls = [...tempPhotos];

        for (const file of files) {
            const formData = new FormData();
            formData.append('photo', file);
            const res = await authFetch(`${API_BASE_URL}/api/incidents/upload`, {
                method: 'POST',
                // authFetch handles headers but for FormData we often need to let browser set Content-Type
                // BUT authFetch automatically adds Content-Type: application/json if not specified? 
                // Let's check api.ts or just Assume we need to handle headers manually if not JSON.
                // Actually authFetch usually sets Authorization. 
                // If body is FormData, we should NOT set Content-Type.
                headers: {},
                body: formData
            });
            if (res.ok) {
                const { url } = await res.json();
                uploadedUrls.push(url);
            }
        }
        setTempPhotos(uploadedUrls);
        setUploading(false);
    };

    const handleSaveIncident = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...regData,
            company_id: selectedCompanyId,
            photos: tempPhotos,
            employee_id: regData.employee_id || null
        };

        const res = await authFetch(`${API_BASE_URL}/api/incidents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            setIsRegModalOpen(false);
            setRegData({ employee_id: '', type: 'Incidente', date: new Date().toISOString().slice(0, 16), location: '', description: '', severity: 'Leve' });
            setTempPhotos([]);
            fetchIncidents();
        } else {
            alert('Erro ao salvar incidente');
        }
    };

    const handleOpenInvestigation = (inc: Incident) => {
        setSelectedIncident(inc);
        setInvData({
            generating_source: inc.generating_source || '',
            body_part: inc.body_part || '',
            injured_person_report: inc.injured_person_report || '',
            witness_report: inc.witness_report || '',
            possible_causes: inc.possible_causes || '',
            conclusion: inc.conclusion || '',
            investigation_result: inc.investigation_result || ''
        });
        setInvStatus(inc.status);
        setIsInvModalOpen(true);
    };

    const handleSaveInvestigation = async () => {
        if (!selectedIncident) return;
        const res = await authFetch(`${API_BASE_URL}/api/incidents/${selectedIncident.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...invData, status: invStatus })
        });

        if (res.ok) {
            setIsInvModalOpen(false);
            fetchIncidents();
        }
    };

    const handleAddActionPlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedIncident) return;

        const res = await authFetch(`${API_BASE_URL}/api/incidents/${selectedIncident.id}/actions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(actionData)
        });

        if (res.ok) {
            setIsActionModalOpen(false);
            setActionData({ measure: '', responsible: '', deadline: '', notes: '' });
            // Refresh incident details in modal
            const refreshRes = await authFetch(`${API_BASE_URL}/api/incidents?company_id=${selectedCompanyId}`);
            if (refreshRes.ok) {
                const updatedList = await refreshRes.json();
                setIncidents(updatedList);
                const updatedInc = updatedList.find((i: Incident) => i.id === selectedIncident.id);
                if (updatedInc) setSelectedIncident(updatedInc);
            }
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Aberto': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            case 'Em Investigação': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Concluído': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Acidente': return 'text-red-600 font-bold';
            case 'Incidente': return 'text-orange-500 font-bold';
            case 'Quase-acidente': return 'text-blue-500 font-bold';
            default: return '';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">Comunicação de Incidentes</h1>
                    <p className="text-gray-500 dark:text-gray-400">Registro, investigação e controle de acidentes e quase-acidentes.</p>
                </div>
                <div className="flex gap-4">
                    <select
                        className="p-2 border rounded-lg bg-white dark:bg-surface-dark dark:border-gray-700"
                        value={selectedCompanyId}
                        onChange={e => setSelectedCompanyId(e.target.value)}
                    >
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                        onClick={() => setIsRegModalOpen(true)}
                        className="flex items-center justify-center rounded-lg h-10 px-4 bg-red-600 text-white font-bold shadow-md hover:bg-red-700 transition-colors"
                    >
                        <span className="material-symbols-outlined mr-2">report_problem</span>
                        Registrar
                    </button>
                </div>
            </div>

            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                            <th className="p-4 text-xs font-bold uppercase text-gray-400">Data/Hora</th>
                            <th className="p-4 text-xs font-bold uppercase text-gray-400">Tipo</th>
                            <th className="p-4 text-xs font-bold uppercase text-gray-400">Colaborador</th>
                            <th className="p-4 text-xs font-bold uppercase text-gray-400">Local</th>
                            <th className="p-4 text-xs font-bold uppercase text-gray-400">Status</th>
                            <th className="p-4 text-xs font-bold uppercase text-gray-400 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {incidents.map(inc => (
                            <tr key={inc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                <td className="p-4 text-sm font-medium">{new Date(inc.date).toLocaleString('pt-BR')}</td>
                                <td className={`p-4 text-sm ${getTypeColor(inc.type)}`}>{inc.type}</td>
                                <td className="p-4 text-sm">{inc.employee_name || 'N/A'}</td>
                                <td className="p-4 text-sm">{inc.location}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(inc.status)}`}>
                                        {inc.status}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    <button
                                        onClick={() => handleOpenInvestigation(inc)}
                                        className="text-primary hover:underline text-sm font-bold"
                                    >
                                        Investigar
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {incidents.length === 0 && (
                    <div className="p-10 text-center text-gray-500">Nenhum registro encontrado para esta empresa.</div>
                )}
            </div>

            {/* Registration Modal */}
            <Modal isOpen={isRegModalOpen} onClose={() => setIsRegModalOpen(false)} title="Comunicar Incidente">
                <form onSubmit={handleSaveIncident} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm mb-1 font-bold">Tipo</label>
                            <select
                                required
                                className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                                value={regData.type}
                                onChange={e => setRegData({ ...regData, type: e.target.value as any })}
                            >
                                <option value="Incidente">Incidente</option>
                                <option value="Acidente">Acidente</option>
                                <option value="Quase-acidente">Quase-acidente</option>
                                <option value="Acidente Típico">Acidente Típico</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm mb-1 font-bold">Data/Hora</label>
                            <input
                                required
                                type="datetime-local"
                                className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                                value={regData.date}
                                onChange={e => setRegData({ ...regData, date: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm mb-1 font-bold">Colaborador Envolvido (Opcional)</label>
                        <select
                            className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                            value={regData.employee_id}
                            onChange={e => setRegData({ ...regData, employee_id: e.target.value })}
                        >
                            <option value="">Selecione...</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm mb-1 font-bold">Local da Ocorrência</label>
                        <input
                            required
                            type="text"
                            placeholder="Ex: Canteiro de Obras - Setor A"
                            className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                            value={regData.location}
                            onChange={e => setRegData({ ...regData, location: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-1 font-bold">Descrição dos Fatos</label>
                        <textarea
                            required
                            rows={3}
                            placeholder="Descreva detalhadamente o que ocorreu..."
                            className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                            value={regData.description}
                            onChange={e => setRegData({ ...regData, description: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-1 font-bold">Gravidade</label>
                        <select
                            required
                            className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                            value={regData.severity}
                            onChange={e => setRegData({ ...regData, severity: e.target.value as any })}
                        >
                            <option value="Leve">Leve</option>
                            <option value="Moderado">Moderado</option>
                            <option value="Grave">Grave</option>
                            <option value="Fatal">Fatal</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm mb-1 font-bold">Fotos da Ocorrência</label>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="w-full text-sm mb-2"
                        />
                        {uploading && <p className="text-xs text-blue-500 animate-pulse">Enviando fotos...</p>}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {tempPhotos.map((url, i) => (
                                <img key={i} src={`${API_BASE_URL}${url}`} className="h-16 w-16 object-cover rounded border border-gray-200" alt="Evidência" />
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={uploading}
                        className="w-full bg-red-600 text-white p-2 rounded font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                        Enviar Comunicação
                    </button>
                </form>
            </Modal>

            {/* Investigation Modal */}
            <Modal isOpen={isInvModalOpen} onClose={() => setIsInvModalOpen(false)} title="Investigação de Incidente" size="xl">
                {selectedIncident && (
                    <div className="space-y-6 max-h-[80vh] overflow-y-auto p-1">
                        <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                            <div><span className="font-bold">Protocolo:</span> #{selectedIncident.id}</div>
                            <div><span className="font-bold">Tipo:</span> {selectedIncident.type}</div>
                            <div><span className="font-bold">Data:</span> {new Date(selectedIncident.date).toLocaleString()}</div>
                            <div><span className="font-bold">Local:</span> {selectedIncident.location}</div>
                        </div>

                        <div>
                            <h4 className="font-bold text-sm mb-2 text-primary">Evidências Fotográficas</h4>
                            <div className="flex gap-2 overflow-x-auto">
                                {selectedIncident.photos.map((url, i) => (
                                    <a key={i} href={`${API_BASE_URL}${url}`} target="_blank" rel="noreferrer">
                                        <img src={`${API_BASE_URL}${url}`} className="h-20 w-20 object-cover rounded border dark:border-gray-700" alt="Foto" />
                                    </a>
                                ))}
                                {selectedIncident.photos.length === 0 && <p className="text-xs text-gray-500 italic">Nenhuma foto registrada.</p>}
                            </div>
                        </div>

                        <div className="space-y-4 pr-2">
                            {/* Read-Only Original Description */}
                            <div className="bg-orange-50 dark:bg-orange-900/10 p-3 rounded-lg border border-orange-100 dark:border-orange-900/30">
                                <label className="block text-xs font-bold uppercase text-orange-800 dark:text-orange-400 mb-1">Relato Inicial do Acidente</label>
                                <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{selectedIncident.description}"</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1 font-bold text-gray-700 dark:text-gray-300">Fonte Geradora</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                                        placeholder="Ex: Máquina, Ferramenta, Piso..."
                                        value={invData.generating_source}
                                        onChange={e => setInvData({ ...invData, generating_source: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1 font-bold text-gray-700 dark:text-gray-300">Parte do Corpo Atingida</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                                        placeholder="Ex: Mão direita, Cabeça..."
                                        value={invData.body_part}
                                        onChange={e => setInvData({ ...invData, body_part: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm mb-1 font-bold text-gray-700 dark:text-gray-300">Relato do Acidentado</label>
                                <textarea
                                    rows={3}
                                    className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                                    placeholder="Descrição fato pelo acidentado..."
                                    value={invData.injured_person_report}
                                    onChange={e => setInvData({ ...invData, injured_person_report: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm mb-1 font-bold text-gray-700 dark:text-gray-300">Relato de Testemunhas</label>
                                <textarea
                                    rows={3}
                                    className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                                    placeholder="Se houver testemunhas, descreva..."
                                    value={invData.witness_report}
                                    onChange={e => setInvData({ ...invData, witness_report: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm mb-1 font-bold text-gray-700 dark:text-gray-300">Possíveis Causas</label>
                                <textarea
                                    rows={3}
                                    className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                                    placeholder="Fatores que contribuíram para o acidente..."
                                    value={invData.possible_causes}
                                    onChange={e => setInvData({ ...invData, possible_causes: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm mb-1 font-bold text-primary">Conclusão / Parecer Técnico</label>
                                <textarea
                                    rows={4}
                                    className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                                    placeholder="Conclusão final da investigação..."
                                    value={invData.conclusion}
                                    onChange={e => setInvData({ ...invData, conclusion: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                                <label className="text-sm font-bold">Status da Investigação:</label>
                                <select
                                    className="p-2 border rounded dark:bg-background-dark dark:border-gray-700 text-sm font-bold"
                                    value={invStatus}
                                    onChange={e => setInvStatus(e.target.value as any)}
                                >
                                    <option value="Aberto">Aberto</option>
                                    <option value="Em Investigação">Em Investigação</option>
                                    <option value="Concluído">Concluído</option>
                                </select>
                            </div>
                        </div>

                        <div className="border-t dark:border-gray-800 pt-4">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-sm">Plano de Ação Corretiva</h4>
                                <button
                                    onClick={() => setIsActionModalOpen(true)}
                                    className="text-xs bg-primary text-black px-2 py-1 rounded font-bold"
                                >
                                    + Nova Ação
                                </button>
                            </div>
                            <div className="space-y-2">
                                {selectedIncident.action_plans.map(plan => (
                                    <div key={plan.id} className="p-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded text-xs">
                                        <div className="flex justify-between font-bold mb-1">
                                            <span>{plan.measure}</span>
                                            <span className={plan.status === 'concluído' ? 'text-green-500' : 'text-orange-500'}>{plan.status}</span>
                                        </div>
                                        <div className="text-gray-500">Resp: {plan.responsible} | Prazo: {new Date(plan.deadline).toLocaleDateString()}</div>
                                    </div>
                                ))}
                                {selectedIncident.action_plans.length === 0 && <p className="text-xs text-gray-500 italic">Nenhuma ação vinculada.</p>}
                            </div>
                        </div>

                        <button
                            onClick={handleSaveInvestigation}
                            className="w-full bg-primary text-black p-3 rounded font-bold shadow-lg hover:bg-green-400 transition-colors"
                        >
                            Salvar Investigação
                        </button>
                    </div>
                )}
            </Modal>

            {/* Action Plan Modal */}
            <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} title="Nova Ação Corretiva">
                <form onSubmit={handleAddActionPlan} className="space-y-4">
                    <div>
                        <label className="block text-sm mb-1">Medida Corretiva / Ação</label>
                        <input required className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                            value={actionData.measure} onChange={e => setActionData({ ...actionData, measure: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm mb-1">Responsável</label>
                            <input required className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                                value={actionData.responsible} onChange={e => setActionData({ ...actionData, responsible: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm mb-1">Prazo</label>
                            <input required type="date" className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                                value={actionData.deadline} onChange={e => setActionData({ ...actionData, deadline: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Observações</label>
                        <textarea className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                            value={actionData.notes} onChange={e => setActionData({ ...actionData, notes: e.target.value })} />
                    </div>
                    <button type="submit" className="w-full bg-primary text-black p-2 rounded font-bold">Adicionar ao Plano</button>
                </form>
            </Modal>
        </div>
    );
};
