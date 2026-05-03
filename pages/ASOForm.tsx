import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';
import { Save, Plus, Trash2 } from 'lucide-react';

interface ASOFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    initialData?: any;
}

export const ASOForm: React.FC<ASOFormProps> = ({ onSuccess, onCancel, initialData }) => {
    const [loading, setLoading] = useState(false);

    // Data Sources
    const [companies, setCompanies] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [examTypes, setExamTypes] = useState<any[]>([]);
    const [risksCatalog, setRisksCatalog] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        company_id: '',
        employee_id: '',
        type: 'Periódico',
        exam_date: new Date().toISOString().split('T')[0],
        issue_date: new Date().toISOString().split('T')[0],
        valid_until: '',
        doctor_name: '',
        doctor_crm: '',
        doctor_uf: 'SP',
        clinic_name: '',
        aptitude_status: 'Apto',
        aptitude_obs: '',
        exams: [] as any[],
        risks: [] as any[]
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (initialData) {
            setFormData({
                company_id: initialData.company_id,
                employee_id: initialData.employee_id,
                type: initialData.type,
                exam_date: initialData.exam_date ? new Date(initialData.exam_date).toISOString().split('T')[0] : '',
                issue_date: initialData.issue_date ? new Date(initialData.issue_date).toISOString().split('T')[0] : '',
                valid_until: initialData.valid_until ? new Date(initialData.valid_until).toISOString().split('T')[0] : '',
                doctor_name: initialData.doctor_name,
                doctor_crm: initialData.doctor_crm,
                doctor_uf: initialData.doctor_uf,
                clinic_name: initialData.clinic_name || '',
                aptitude_status: initialData.aptitude_status,
                aptitude_obs: initialData.aptitude_obs || '',
                exams: (initialData.exams || []).map((e: any) => ({
                    ...e,
                    exam_type_id: String(e.exam_type_id || ''),
                    exam_date: e.exam_date ? new Date(e.exam_date).toISOString().split('T')[0] : ''
                })),
                risks: (initialData.risks || []).map((r: any) => ({
                    ...r,
                    risk_description: r.risk_description || r.risk_name || '',
                    risk_type: r.risk_type ? r.risk_type.charAt(0).toUpperCase() + r.risk_type.slice(1).toLowerCase() : 'Físico'
                }))
            });
            // Fetch employees for determining company context if needed
            if (initialData.company_id) {
                fetchEmployees(initialData.company_id);
            }
        }
    }, [initialData]);

    useEffect(() => {
        if (formData.company_id && !initialData) { // Only fetch if not loading initial data to avoid race conditions or use a better check
            fetchEmployees(formData.company_id);
        } else if (formData.company_id && initialData && employees.length === 0) {
            fetchEmployees(formData.company_id);
        }
    }, [formData.company_id]);

    const fetchInitialData = async () => {
        try {
            const [compRes, examRes, riskRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/api/companies`),
                authFetch(`${API_BASE_URL}/api/exam-types`),
                authFetch(`${API_BASE_URL}/api/risks`) // Make sure this endpoint exists or remove
            ]);

            if (compRes.ok) setCompanies(await compRes.json());
            if (examRes.ok) setExamTypes(await examRes.json());
        } catch (e) { console.error(e); }
    };

    const fetchEmployees = async (companyId: string) => {
        try {
            const res = await authFetch(`${API_BASE_URL}/api/employees?company_id=${companyId}`);
            if (res.ok) setEmployees(await res.json());
        } catch (e) { console.error(e); }
    };

    const handleAddExam = () => {
        setFormData({
            ...formData,
            exams: [...formData.exams, { exam_type_id: '', exam_date: formData.exam_date, result: 'Normal', obs: '' }]
        });
    };

    const handleRemoveExam = (index: number) => {
        const newExams = [...formData.exams];
        newExams.splice(index, 1);
        setFormData({ ...formData, exams: newExams });
    };

    const handleExamChange = (index: number, field: string, value: string) => {
        const newExams = [...formData.exams];
        newExams[index] = { ...newExams[index], [field]: value };
        setFormData({ ...formData, exams: newExams });
    };

    const handleAddRisk = () => {
        setFormData({
            ...formData,
            risks: [...formData.risks, { risk_description: '', risk_type: 'Físico', risk_id: null }] // risk_id null for custom/adhoc
        });
    };

    const handleRemoveRisk = (index: number) => {
        const newRisks = [...formData.risks];
        newRisks.splice(index, 1);
        setFormData({ ...formData, risks: newRisks });
    };

    const handleRiskChange = (index: number, field: string, value: string) => {
        const newRisks = [...formData.risks];
        newRisks[index] = { ...newRisks[index], [field]: value };
        setFormData({ ...formData, risks: newRisks });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = initialData
                ? `${API_BASE_URL}/api/asos/${initialData.id}`
                : `${API_BASE_URL}/api/asos`;

            const method = initialData ? 'PUT' : 'POST';

            // Clean arrays before sending
            const cleanedData = {
                ...formData,
                exams: formData.exams.filter(e => e.exam_type_id && e.exam_type_id !== ''),
                risks: formData.risks.filter(r => r.risk_description && r.risk_description.trim() !== '')
            };

            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cleanedData)
            });

            if (res.ok) {
                onSuccess();
            } else {
                const err = await res.json();
                alert(`Erro ao salvar ASO: ${err.error || 'Erro desconhecido'}`);
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Identification */}
            <div className="bg-gray-50 p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">1. Identificação</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Empresa</label>
                        <select
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                            value={formData.company_id}
                            onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                        >
                            <option value="">Selecione...</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Funcionário</label>
                        <select
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                            value={formData.employee_id}
                            onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                            disabled={!formData.company_id}
                        >
                            <option value="">Selecione...</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name} {e.cpf ? `- CPF: ${e.cpf}` : ''}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Tipo de ASO</label>
                        <select
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            {['Admissional', 'Periódico', 'Mudança de Função', 'Retorno ao Trabalho', 'Demissional'].map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Data do Exame</label>
                        <input
                            type="date"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                            value={formData.exam_date}
                            onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* 2. Risks */}
            <div className="bg-gray-50 p-4 rounded-lg border">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-700">2. Riscos Ocupacionais</h3>
                    <button type="button" onClick={handleAddRisk} className="text-blue-600 text-sm font-medium flex items-center gap-1">
                        <Plus size={16} /> Adicionar Risco
                    </button>
                </div>

                {formData.risks.length === 0 && <p className="text-sm text-gray-500 italic">Nenhum risco adicionado (Ausência de riscos).</p>}

                {formData.risks.map((risk, idx) => (
                    <div key={idx} className="flex gap-2 mb-2 items-start">
                        <div className="w-1/3">
                            <select
                                className="w-full border rounded p-2 text-sm"
                                value={risk.risk_type}
                                onChange={(e) => handleRiskChange(idx, 'risk_type', e.target.value)}
                            >
                                {['Físico', 'Químico', 'Biológico', 'Ergonômico', 'Acidente'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Descrição do Risco"
                                className="w-full border rounded p-2 text-sm"
                                value={risk.risk_description}
                                onChange={(e) => handleRiskChange(idx, 'risk_description', e.target.value)}
                            />
                        </div>
                        <button type="button" onClick={() => handleRemoveRisk(idx)} className="text-red-500 p-2"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>

            {/* 3. Exams */}
            <div className="bg-gray-50 p-4 rounded-lg border">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-700">3. Exames Complementares</h3>
                    <button type="button" onClick={handleAddExam} className="text-blue-600 text-sm font-medium flex items-center gap-1">
                        <Plus size={16} /> Adicionar Exame
                    </button>
                </div>

                {formData.exams.length === 0 && <p className="text-sm text-gray-500 italic">Apenas exame clínico.</p>}

                {formData.exams.map((exam, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-start bg-white p-2 rounded border">
                        <div className="col-span-4">
                            <label className="text-xs text-gray-500">Exame</label>
                            <select
                                className="w-full border rounded p-1 text-sm"
                                value={exam.exam_type_id}
                                onChange={(e) => handleExamChange(idx, 'exam_type_id', e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {examTypes.length === 0 && <option value="" disabled>Carregando tipos...</option>}
                                {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-3">
                            <label className="text-xs text-gray-500">Data</label>
                            <input
                                type="date"
                                className="w-full border rounded p-1 text-sm"
                                value={exam.exam_date}
                                onChange={(e) => handleExamChange(idx, 'exam_date', e.target.value)}
                            />
                        </div>
                        <div className="col-span-3">
                            <label className="text-xs text-gray-500">Resultado</label>
                            <select
                                className="w-full border rounded p-1 text-sm"
                                value={exam.result}
                                onChange={(e) => handleExamChange(idx, 'result', e.target.value)}
                            >
                                <option value="Normal">Normal</option>
                                <option value="Alterado">Alterado</option>
                            </select>
                        </div>
                        <div className="col-span-2 text-right pt-4">
                            <button type="button" onClick={() => handleRemoveExam(idx)} className="text-red-500"><Trash2 size={16} /></button>
                        </div>
                    </div>
                ))}
            </div>

            {/* 4. Conclusion */}
            <div className="bg-gray-50 p-4 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">4. Conclusão e Responsáveis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Parecer Médico</label>
                        <select
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                            value={formData.aptitude_status}
                            onChange={(e) => setFormData({ ...formData, aptitude_status: e.target.value })}
                        >
                            <option value="Apto">Apto</option>
                            <option value="Apto com Restrição">Apto com Restrição</option>
                            <option value="Inapto">Inapto</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Observações / Restrições</label>
                        <textarea
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                            rows={2}
                            value={formData.aptitude_obs}
                            onChange={(e) => setFormData({ ...formData, aptitude_obs: e.target.value })}
                        ></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Médico Responsável</label>
                        <input
                            type="text"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                            value={formData.doctor_name}
                            onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                            placeholder="Nome do Médico"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">CRM / UF</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                                value={formData.doctor_crm}
                                onChange={(e) => setFormData({ ...formData, doctor_crm: e.target.value })}
                                placeholder="12345"
                            />
                            <input
                                type="text"
                                className="mt-1 block w-20 rounded-md border-gray-300 shadow-sm p-2 border"
                                value={formData.doctor_uf}
                                onChange={(e) => setFormData({ ...formData, doctor_uf: e.target.value })}
                                placeholder="SP"
                                maxLength={2}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    <Save size={18} />
                    {loading ? 'Salvando...' : 'Salvar ASO'}
                </button>
            </div>
        </form>
    );
};
