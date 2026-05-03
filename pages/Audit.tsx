import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Inspection, Company, ChecklistTemplate, View } from '../types';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

interface AuditProps {
  onNavigateToInspection: (id: number) => void;
}

export const Audit: React.FC<AuditProps> = ({ onNavigateToInspection }) => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMenuId, setCurrentMenuId] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    companyId: '',
    templateId: '',
    date: new Date().toISOString().slice(0, 16) // Default to current time
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [insRes, compRes, tmplRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/api/inspections`),
        authFetch(`${API_BASE_URL}/api/companies`),
        authFetch(`${API_BASE_URL}/api/checklist-templates`)
      ]);

      const insData = await insRes.json();
      const compData = await compRes.json();
      const tmplData = await tmplRes.json();

      setInspections(insData.map((i: any) => ({
        ...i,
        companyName: i.company_name,
        templateName: i.template_name
      })));
      setCompanies(compData);
      setTemplates(tmplData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      company_id: formData.companyId,
      template_id: Number(formData.templateId),
      auditor_id: 'Alex Morgan', // Hardcoded for demo
      date: formData.date,
      status: 'Agendado'
    };

    try {
      await authFetch(`${API_BASE_URL}/api/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setIsModalOpen(false);
      fetchData();
      setFormData({ companyId: '', templateId: '', date: new Date().toISOString().slice(0, 16) });
    } catch (error) {
      console.error('Error creating inspection:', error);
    }
  };

  const handleDelete = async (id: number) => {
    // Note: Delete API endpoint isn't implemented in the plan, assuming it might be needed but skipped for simplicity in first pass. 
    // If needed, I would use fetch DELETE here. For now, UI only.
    alert('Funcionalidade de exclusão não implementada na API para este demo.');
    setCurrentMenuId(null);
  };

  return (
    <div className="space-y-6" onClick={() => setCurrentMenuId(null)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Auditorias & Vistorias</h1>
          <p className="text-gray-500 dark:text-gray-400">Planeje e execute inspeções de campo (Checklists Digitais).</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-primary text-black px-5 py-2.5 rounded-lg font-bold shadow-lg shadow-primary/20 hover:bg-green-400 transition-all"
        >
          <span className="material-symbols-outlined">add_task</span>
          Nova Inspeção
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Status Cards */}
        <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <span className="material-symbols-outlined text-4xl text-blue-500 mb-2">event_upcoming</span>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{inspections.filter(a => a.status === 'Agendado').length}</h3>
            <p className="text-sm text-gray-500">Agendadas</p>
          </div>
          <div className="absolute right-[-20px] top-[-20px] h-32 w-32 bg-blue-500/10 rounded-full blur-2xl"></div>
        </div>
        <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <span className="material-symbols-outlined text-4xl text-amber-500 mb-2">pending_actions</span>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{inspections.filter(a => a.status === 'Em Andamento').length}</h3>
            <p className="text-sm text-gray-500">Em Andamento</p>
          </div>
          <div className="absolute right-[-20px] top-[-20px] h-32 w-32 bg-amber-500/10 rounded-full blur-2xl"></div>
        </div>
        <div className="bg-white dark:bg-surface-dark p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <span className="material-symbols-outlined text-4xl text-primary mb-2">task_alt</span>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{inspections.filter(a => a.status === 'Concluído').length}</h3>
            <p className="text-sm text-gray-500">Concluídas</p>
          </div>
          <div className="absolute right-[-20px] top-[-20px] h-32 w-32 bg-primary/10 rounded-full blur-2xl"></div>
        </div>
      </div>

      <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-visible">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-white">Cronograma de Auditorias</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800 overflow-visible min-h-[300px]">
          {inspections.length === 0 && <div className="p-8 text-center text-gray-500">Nenhuma inspeção encontrada.</div>}
          {inspections.map((audit) => (
            <div key={audit.id} className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors relative">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-gray-500">business</span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">{audit.companyName}</h4>
                  <p className="text-sm text-gray-500">{audit.template_name} • Auditor: {audit.auditor_id}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end relative">
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase font-bold">Data</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{new Date(audit.date).toLocaleDateString()}</p>
                </div>
                <div className="w-32 text-right">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${audit.status === 'Concluído' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    audit.status === 'Em Andamento' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                    {audit.status}
                  </span>
                </div>
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrentMenuId(currentMenuId === audit.id ? null : audit.id); }}
                    className="text-gray-400 hover:text-primary transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className="material-symbols-outlined">more_vert</span>
                  </button>

                  {currentMenuId === audit.id && (
                    <div className="absolute right-0 top-10 w-48 bg-white dark:bg-surface-dark rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-fade-in text-left">
                      <button
                        onClick={(e) => { e.stopPropagation(); onNavigateToInspection(audit.id); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px] text-blue-500">edit_document</span>
                        {audit.status === 'Concluído' ? 'Ver Detalhes' : 'Realizar Inspeção'}
                      </button>
                      <a
                        href={`${API_BASE_URL}/api/reports/inspection/${audit.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px] text-primary">picture_as_pdf</span>
                        Baixar PDF
                      </a>
                      <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(audit.id); }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]">cancel</span> Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Inspeção de Segurança">
        <form onSubmit={handleSchedule} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Empresa / Cliente</label>
            <select
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
              value={formData.companyId}
              onChange={e => setFormData({ ...formData, companyId: e.target.value })}
            >
              <option value="">Selecione...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Checklist (NR)</label>
            <select
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
              value={formData.templateId}
              onChange={e => setFormData({ ...formData, templateId: e.target.value })}
            >
              <option value="">Selecione um Modelo...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">Selecione a NR base para a inspeção.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Agendada</label>
            <input
              required
              type="datetime-local"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-surface-dark dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-black bg-primary rounded-lg hover:bg-green-400">Criar Inspeção</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};