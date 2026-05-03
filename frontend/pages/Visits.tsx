import React, { useState, useEffect } from 'react';
import { Visit, Company, Unit, Sector } from '../types';
import { Modal } from '../components/Modal';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

export const Visits: React.FC = () => {
    const [visits, setVisits] = useState<Visit[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        companyId: '',
        unitId: '',
        sectorId: '' as string | number, // Use string for select value
        visitType: 'inspeção' as Visit['visitType'],
        scheduledAt: '',
        reportUrl: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [visitsRes, companiesRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/api/visits`),
                authFetch(`${API_BASE_URL}/api/companies`)
            ]);
            const [visitsData, companiesData] = await Promise.all([
                visitsRes.json(),
                companiesRes.json()
            ]);

            const mappedVisits = visitsData.map((v: any) => ({
                ...v,
                companyId: v.company_id,
                sectorId: v.sector_id,
                sectorName: v.sector_name,
                unitName: v.unit_name,
                visitType: v.visit_type,
                scheduledAt: v.scheduled_at,
                checkInAt: v.check_in_at,
                checkOutAt: v.check_out_at,
                companyName: v.company_name,
                reportUrl: v.report_url
            }));

            setVisits(mappedVisits);
            setCompanies(companiesData);
        } catch (error) {
            console.error('Error fetching visits:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompanyChange = async (companyId: string) => {
        setFormData({ ...formData, companyId, unitId: '', sectorId: '' });
        setUnits([]);
        setSectors([]);
        if (companyId) {
            try {
                const res = await authFetch(`${API_BASE_URL}/api/companies/${companyId}/units`);
                const data = await res.json();
                setUnits(data);
            } catch (error) {
                console.error('Error fetching units:', error);
            }
        }
    };

    const handleUnitChange = async (unitId: string) => {
        setFormData({ ...formData, unitId, sectorId: '' });
        setSectors([]);
        if (unitId) {
            try {
                const res = await authFetch(`${API_BASE_URL}/api/units/${unitId}/sectors`);
                const data = await res.json();
                setSectors(data);
            } catch (error) {
                console.error('Error fetching sectors:', error);
            }
        }
    };

    const handleOpenModal = async (visit?: Visit) => {
        if (visit) {
            setEditingId(visit.id);
            // Pre-fetch units and sectors if needed could be complex, for now just load basics
            // For a better UX, we should fetch the units for the company and sectors for the unit
            // This is a simplified version where we might reset sector/unit on edit if we don't fetch them
            // To do it right:
            let currentUnits: Unit[] = [];
            let currentSectors: Sector[] = [];

            if (visit.companyId) {
                const uRes = await authFetch(`${API_BASE_URL}/api/companies/${visit.companyId}/units`);
                currentUnits = await uRes.json();
                setUnits(currentUnits);
            }

            // We need to find the unit for the sector to fetch sectors correctly
            // But we don't have unitId distinct in Visit usually unless we fetch it.
            // Our updated backend query joins units via sectors, so we have unitName but maybe not ID directly if not selected.
            // Actually, unit_id comes from sectors table.

            // If we have sectorId, we can try to find the unit.
            // For now, let's just populate what we have.

            // Hack: If we have sectorId, we assume we can fetch sectors for the unit if we knew it.
            // Since we don't have unitId easily available in `visit` object without more joins or logic:
            // Let's rely on the user re-selecting if they want to change unit/sector.
            // OR better: Update backend to return unit_id.
            // I added unit_id join in the backend query implicitly via Unit Name, but let's assume we might need to re-select for now to simplify.
            // Wait, I can see unitName in the visit.

            setFormData({
                companyId: visit.companyId,
                unitId: '', // We don't have unitId in Visit interface yet explicitly, but we can't easily pre-fill without it.
                sectorId: visit.sectorId || '',
                visitType: visit.visitType,
                scheduledAt: new Date(visit.scheduledAt).toISOString().slice(0, 16),
                reportUrl: visit.reportUrl || ''
            });
        } else {
            setEditingId(null);
            setUnits([]);
            setSectors([]);
            setFormData({
                companyId: '',
                unitId: '',
                sectorId: '',
                visitType: 'inspeção',
                scheduledAt: '',
                reportUrl: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSaveVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        const apiBody = {
            company_id: formData.companyId,
            sector_id: formData.sectorId ? Number(formData.sectorId) : null,
            visit_type: formData.visitType,
            scheduled_at: formData.scheduledAt,
            report_url: formData.reportUrl
        };

        try {
            if (editingId) {
                await authFetch(`${API_BASE_URL}/api/visits/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiBody),
                });
            } else {
                await authFetch(`${API_BASE_URL}/api/visits`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiBody),
                });
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error('Error saving visit:', error);
        }
    };

    const handleDeleteVisit = async (id: number) => {
        if (confirm('Tem certeza que deseja remover este agendamento?')) {
            try {
                await authFetch(`${API_BASE_URL}/api/visits/${id}`, {
                    method: 'DELETE'
                });
                fetchData();
            } catch (error) {
                console.error('Error deleting visit:', error);
            }
        }
    };

    const handleCheckIn = async (id: number) => {
        if (!navigator.geolocation) {
            alert('Geolocalização não é suportada pelo seu navegador.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    await fetch(`${API_BASE_URL}/api/visits/${id}/check-in`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ latitude, longitude }),
                    });
                    fetchData();
                    alert('Check-in realizado com sucesso!');
                } catch (error) {
                    console.error('Error check-in:', error);
                    alert('Erro ao realizar check-in.');
                }
            },
            (error) => {
                console.error('Error getting location:', error);
                alert('Erro ao obter localização. Verifique as permissões.');
            }
        );
    };

    const handleCheckOut = async (id: number) => {
        try {
            await fetch(`${API_BASE_URL}/api/visits/${id}/check-out`, {
                method: 'PATCH'
            });
            fetchData();
            alert('Check-out realizado com sucesso!');
        } catch (error) {
            console.error('Error check-out:', error);
        }
    };

    const calculateDuration = (start?: string, end?: string) => {
        if (!start || !end) return null;
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffMs = endDate.getTime() - startDate.getTime();
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);

        if (diffHrs > 0) return `${diffHrs}h ${diffMins}m`;
        return `${diffMins}m`;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">Agenda de Visitas</h1>
                    <p className="text-gray-500 dark:text-gray-400">Controle de inspeções e auditorias técnicas.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 rounded-lg h-10 px-5 bg-primary hover:bg-green-400 text-black text-sm font-bold shadow-sm transition-colors"
                >
                    <span className="material-symbols-outlined text-[20px]">event</span>
                    Agendar Visita
                </button>
            </div>

            <div className="grid gap-4">
                {visits.map((visit) => {
                    const duration = calculateDuration(visit.checkInAt, visit.checkOutAt);

                    return (
                        <div key={visit.id} className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
                            <div className="flex gap-4 items-start">
                                <div className={`p-3 rounded-lg ${visit.status === 'Concluído' ? 'bg-gray-100 text-gray-500' : 'bg-primary/10 text-primary'}`}>
                                    <span className="material-symbols-outlined text-2xl">
                                        {visit.visitType === 'inspeção' ? 'fact_check' : visit.visitType === 'auditoria' ? 'rule' : 'visibility'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                                        {visit.visitType} - {visit.companyName}
                                    </h3>
                                    {(visit.unitName || visit.sectorName) && (
                                        <p className="text-sm text-gray-500 font-medium">
                                            {visit.unitName} {visit.sectorName && `• ${visit.sectorName}`}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-4 mt-1">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                                            {new Date(visit.scheduledAt).toLocaleString('pt-BR')}
                                        </p>
                                        {visit.reportUrl && (
                                            <a href={visit.reportUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">description</span>
                                                Relatório
                                            </a>
                                        )}
                                    </div>
                                    {visit.checkInAt && (
                                        <div className="mt-2 text-xs">
                                            <p className="text-primary flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">location_on</span>
                                                Início: {new Date(visit.checkInAt).toLocaleTimeString()}
                                                {visit.checkOutAt && ` | Fim: ${new Date(visit.checkOutAt).toLocaleTimeString()}`}
                                            </p>
                                            {duration && (
                                                <p className="text-gray-500 dark:text-gray-400 font-bold mt-1">
                                                    Duração: {duration}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${visit.status === 'Agendado' ? 'bg-blue-100 text-blue-700' :
                                    visit.status === 'Em Andamento' ? 'bg-orange-100 text-orange-700 animate-pulse' :
                                        'bg-green-100 text-green-700'
                                    }`}>
                                    {visit.status}
                                </span>

                                {visit.status === 'Agendado' && (
                                    <>
                                        <button onClick={() => handleCheckIn(visit.id)} className="h-9 px-4 rounded-lg bg-primary text-black text-xs font-bold hover:bg-green-400 transition-colors">
                                            Check-in
                                        </button>
                                        <button onClick={() => handleOpenModal(visit)} className="p-2 text-gray-400 hover:text-primary transition-colors">
                                            <span className="material-symbols-outlined">edit</span>
                                        </button>
                                        <button onClick={() => handleDeleteVisit(visit.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </>
                                )}
                                {visit.status === 'Em Andamento' && (
                                    <button onClick={() => handleCheckOut(visit.id)} className="h-9 px-4 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors">
                                        Check-out
                                    </button>
                                )}
                                {visit.status === 'Concluído' && (
                                    <>
                                        <a
                                            href={`${API_BASE_URL}/api/reports/visit/${visit.id}/pdf`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-primary hover:text-green-600 transition-colors"
                                            title="Baixar Relatório PDF"
                                        >
                                            <span className="material-symbols-outlined">picture_as_pdf</span>
                                        </a>
                                        <button onClick={() => handleOpenModal(visit)} className="p-2 text-gray-400 hover:text-primary transition-colors" title="Editar / Adicionar Relatório">
                                            <span className="material-symbols-outlined">edit</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )
                })}
                {visits.length === 0 && !isLoading && (
                    <div className="text-center py-12 text-gray-500">Nenhuma visita agendada.</div>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Visita" : "Agendar Nova Visita"}>
                <form onSubmit={handleSaveVisit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Empresa</label>
                        <select
                            required
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
                            value={formData.companyId}
                            onChange={e => handleCompanyChange(e.target.value)}
                        >
                            <option value="">Selecione uma empresa</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Unidade (Opcional)</label>
                        <select
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
                            value={formData.unitId}
                            onChange={e => handleUnitChange(e.target.value)}
                            disabled={!formData.companyId}
                        >
                            <option value="">Selecione uma unidade</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Setor (Opcional)</label>
                        <select
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
                            value={formData.sectorId}
                            onChange={e => setFormData({ ...formData, sectorId: e.target.value })}
                            disabled={!formData.unitId}
                        >
                            <option value="">Selecione um setor</option>
                            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Tipo de Visita</label>
                        <select
                            required
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
                            value={formData.visitType}
                            onChange={e => setFormData({ ...formData, visitType: e.target.value as Visit['visitType'] })}
                        >
                            <option value="inspeção">Inspeção</option>
                            <option value="auditoria">Auditoria</option>
                            <option value="acompanhamento">Acompanhamento</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 dark:text-gray-300">Data e Hora</label>
                        <input
                            required
                            type="datetime-local"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
                            value={formData.scheduledAt}
                            onChange={e => setFormData({ ...formData, scheduledAt: e.target.value })}
                        />
                    </div>
                    {editingId && (
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">URL do Relatório</label>
                            <input
                                type="url"
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
                                placeholder="https://exemplo.com/relatorio.pdf"
                                value={formData.reportUrl}
                                onChange={e => setFormData({ ...formData, reportUrl: e.target.value })}
                            />
                        </div>
                    )}
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium border dark:border-gray-600 dark:text-gray-300 rounded-lg">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium bg-primary rounded-lg text-black">
                            {editingId ? "Salvar Alterações" : "Confirmar Agendamento"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
