import React, { useState, useEffect } from 'react';
import { Company, Employee } from '../types';
import { Modal } from '../components/Modal';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

// --- Subcomponent: Employees Management Tab ---
const EmployeesManager: React.FC<{ companies: Company[] }> = ({ companies }) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies.length > 0 ? companies[0].id : '');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Partial<Employee>>({});

  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchEmployees();
    }
  }, [selectedCompanyId]);

  const fetchEmployees = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/employees?company_id=${selectedCompanyId}`);
      if (res.ok) setEmployees(await res.json());
    } catch (err) {
      console.error('Failed to fetch employees', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingEmp.id
      ? `${API_BASE_URL}/api/employees/${editingEmp.id}`
      : `${API_BASE_URL}/api/employees`;
    const method = editingEmp.id ? 'PUT' : 'POST';

    try {
      await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingEmp, company_id: selectedCompanyId })
      });
      setIsModalOpen(false);
      fetchEmployees();
    } catch (err) {
      alert('Erro ao salvar colaborador.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este colaborador?')) return;
    await authFetch(`${API_BASE_URL}/api/employees/${id}`, { method: 'DELETE' });
    fetchEmployees();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">Gerenciar Colaboradores</h2>
          <p className="text-gray-500">Cadastre e edite funcionários por empresa.</p>
        </div>
        <div className="flex gap-4 items-center">
          <select
            className="p-2 border rounded-lg bg-white dark:bg-surface-dark dark:border-gray-700"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
          >
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={() => { setEditingEmp({}); setIsModalOpen(true); }}
            className="flex items-center gap-2 rounded-lg h-10 px-5 bg-primary hover:bg-green-400 text-text-main text-sm font-bold shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined">add</span>
            Novo Colaborador
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-surface-light dark:bg-surface-dark overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-background-dark text-xs font-bold uppercase text-gray-500">
            <tr>
              <th className="px-6 py-4">Nome</th>
              <th className="px-6 py-4">Cargo</th>
              <th className="px-6 py-4">Admissão</th>
              <th className="px-6 py-4">CPF</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {employees.length > 0 ? (
              employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-6 py-4 font-bold">{emp.name}</td>
                  <td className="px-6 py-4">{emp.role}</td>
                  <td className="px-6 py-4">{new Date(emp.admission_date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4 text-gray-500">{emp.cpf || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => { setEditingEmp(emp); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800 mr-2">
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nenhum colaborador cadastrado nesta empresa.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEmp.id ? "Editar Colaborador" : "Novo Colaborador"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome Completo</label>
            <input className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" value={editingEmp.name || ''} onChange={e => setEditingEmp({ ...editingEmp, name: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cargo / Função</label>
            <input className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" value={editingEmp.role || ''} onChange={e => setEditingEmp({ ...editingEmp, role: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data de Admissão</label>
              <input type="date" className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" value={editingEmp.admission_date ? editingEmp.admission_date.split('T')[0] : ''} onChange={e => setEditingEmp({ ...editingEmp, admission_date: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CPF</label>
              <input className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" value={editingEmp.cpf || ''} onChange={e => setEditingEmp({ ...editingEmp, cpf: e.target.value })} />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm bg-primary text-black font-bold rounded hover:bg-green-400">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// --- Main Component ---
export const Companies: React.FC = () => {
  const [mainTab, setMainTab] = useState<'companies' | 'employees'>('companies');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit/Add state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    cnae: '',
    riskLevel: 1,
    legalRepresentative: ''
  });

  // Detailed view state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<'units' | 'history'>('units');
  const [units, setUnits] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subModalType, setSubModalType] = useState<'unit' | 'history'>('unit');
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [subFormData, setSubFormData] = useState<any>({});

  // Dropdown state for row actions
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  // Status explanation popup state
  const [statusPopup, setStatusPopup] = useState<{ isOpen: boolean; status: string | null }>({
    isOpen: false,
    status: null
  });

  const statusExplanations: Record<string, { title: string; description: string; icon: string; color: string }> = {
    active: {
      title: 'Empresa Ativa',
      description: 'Esta empresa está com toda a documentação em dia, sem pendências de visitas técnicas e em conformidade com as normas de segurança do trabalho. Todos os treinamentos obrigatórios estão atualizados e os laudos técnicos estão válidos.',
      icon: 'check_circle',
      color: 'text-green-600 dark:text-green-400'
    },
    pending: {
      title: 'Empresa Pendente',
      description: 'Esta empresa possui pendências a serem resolvidas, como: documentação incompleta, aguardando primeira visita técnica, ou em processo de regularização. É necessário completar o cadastro e agendar as visitas necessárias.',
      icon: 'pending',
      color: 'text-yellow-600 dark:text-yellow-400'
    },
    irregular: {
      title: 'Empresa Irregular',
      description: 'Esta empresa apresenta irregularidades que precisam de atenção imediata, como: documentação vencida, laudos expirados, visitas técnicas em atraso ou não conformidades identificadas. É necessário tomar ações corretivas urgentes.',
      icon: 'error',
      color: 'text-red-600 dark:text-red-400'
    }
  };

  React.useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await authFetch(`${API_BASE_URL}/api/companies`);
        const data = await response.json();
        const mappedData = data.map((c: any) => ({
          ...c,
          riskLevel: c.risk_level,
          legalRepresentative: c.legal_representative,
          lastVisit: c.last_visit,
          nextVisit: c.next_visit
        }));
        setCompanies(mappedData);
      } catch (error) {
        console.error('Failed to fetch companies:', error);
        setCompanies([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCompanies();
  }, []);


  const fetchSubData = async (companyId: string) => {
    try {
      const [unitsRes, historyRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/api/companies/${companyId}/units`),
        authFetch(`${API_BASE_URL}/api/companies/${companyId}/history`)
      ]);

      const unitsData = await unitsRes.json();
      const historyData = await historyRes.json();

      setUnits(unitsData);
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to fetch sub-data:', error);
      setUnits([]);
      setHistory([]);

    }
  };

  const handleOpenDetails = (company: Company) => {
    setSelectedCompany(company);
    fetchSubData(company.id);
    setOpenActionId(null);
  };

  const filteredCompanies = companies.filter(company => {
    const matchesSearch =
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterStatus === 'Todos' ||
      (filterStatus === 'Ativo' && company.status === 'active') ||
      (filterStatus === 'Irregular' && company.status === 'irregular') ||
      (filterStatus === 'Pendente' && company.status === 'pending');

    return matchesSearch && matchesFilter;
  });

  const handleOpenModal = (company?: Company) => {
    if (company) {
      setEditingId(company.id);
      setFormData({
        name: company.name,
        contact: company.contact,
        email: company.email,
        cnae: company.cnae || '',
        riskLevel: company.riskLevel || 1,
        legalRepresentative: company.legalRepresentative || ''
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        contact: '',
        email: '',
        cnae: '',
        riskLevel: 1,
        legalRepresentative: ''
      });
    }
    setIsModalOpen(true);
    setOpenActionId(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover esta empresa? Todas as unidades e históricos vinculados serão perdidos.')) {
      try {
        const response = await authFetch(`${API_BASE_URL}/api/companies/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setCompanies(companies.filter(c => c.id !== id));
        } else {
          alert('Erro ao excluir empresa.');
        }
      } catch (error) {
        console.error('Failed to delete company:', error);
      }
    }
    setOpenActionId(null);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const apiBody = {
      name: formData.name,
      contact: formData.contact,
      email: formData.email,
      cnae: formData.cnae,
      risk_level: formData.riskLevel,
      legal_representative: formData.legalRepresentative,
      status: editingId ? companies.find(c => c.id === editingId)?.status : "pending",
      initials: formData.name.substring(0, 2).toUpperCase()
    };

    try {
      if (editingId) {
        const response = await authFetch(`${API_BASE_URL}/api/companies/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiBody),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Erro ao atualizar empresa');
        }
        const updated = await response.json();
        setCompanies(companies.map(c => c.id === editingId ? { ...updated, riskLevel: updated.risk_level, legalRepresentative: updated.legal_representative } : c));
      } else {
        const id = Math.floor(Math.random() * 10000).toString();
        const response = await authFetch(`${API_BASE_URL}/api/companies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...apiBody, id }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Erro ao cadastrar empresa');
        }
        const created = await response.json();
        setCompanies([{ ...created, riskLevel: created.risk_level, legalRepresentative: created.legal_representative }, ...companies]);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save company:', error);
      alert('Erro ao salvar empresa.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render Logic ---

  if (selectedCompany) {
    // Existing Details View Logic ...
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedCompany(null)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">{selectedCompany.name}</h1>
            <p className="text-sm text-gray-500">Detalhes e Gestão de Unidades</p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab('units')}
            className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'units' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Unidades / Filiais
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Histórico de Serviços
          </button>
        </div>

        {activeTab === 'units' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Unidades Cadastradas</h2>
              <button
                onClick={() => {
                  setSubModalType('unit');
                  setEditingSubId(null);
                  setSubFormData({ name: '', address: '', unit_type: 'Filial' });
                  setIsSubModalOpen(true);
                }}
                className="h-9 px-4 rounded-lg bg-primary text-black text-xs font-bold hover:bg-green-400 transition-colors"
              >
                Adicionar Unidade
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.map(unit => (
                <div key={unit.id} className="p-4 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-bold uppercase text-gray-500">{unit.unit_type || 'Unidade'}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setSubModalType('unit');
                          setEditingSubId(unit.id);
                          setSubFormData({ name: unit.name, address: unit.address, unit_type: unit.unit_type });
                          setIsSubModalOpen(true);
                        }}
                        className="p-1 text-gray-400 hover:text-primary"
                      ><span className="material-symbols-outlined text-sm">edit</span></button>
                      <button
                        onClick={async () => {
                          if (confirm('Excluir unidade?')) {
                            await authFetch(`${API_BASE_URL}/api/units/${unit.id}`, { method: 'DELETE' });
                            fetchSubData(selectedCompany.id);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-500"
                      ><span className="material-symbols-outlined text-sm">delete</span></button>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{unit.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{unit.address}</p>
                </div>
              ))}
              {units.length === 0 && <p className="text-sm text-gray-500 col-span-3 py-8 text-center bg-gray-50 dark:bg-gray-800/20 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">Nenhuma unidade cadastrada para esta empresa.</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Histórico de Atendimento</h2>
              <button
                onClick={() => {
                  setSubModalType('history');
                  setEditingSubId(null);
                  setSubFormData({ date: new Date().toISOString().split('T')[0], description: '', technician: '' });
                  setIsSubModalOpen(true);
                }}
                className="h-9 px-4 rounded-lg bg-primary text-black text-xs font-bold hover:bg-green-400 transition-colors"
              >
                Novo Registro
              </button>
            </div>
            <div className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-background-dark text-xs font-bold uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Data</th>
                    <th className="px-6 py-3">Descrição</th>
                    <th className="px-6 py-3">Técnico</th>
                    <th className="px-6 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {history.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm whitespace-nowrap">{new Date(item.date).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-4 text-sm">{item.description}</td>
                      <td className="px-6 py-4 text-sm font-medium">{item.technician}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSubModalType('history');
                            setEditingSubId(item.id);
                            setSubFormData({ date: item.date, description: item.description, technician: item.technician });
                            setIsSubModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-primary"
                        ><span className="material-symbols-outlined text-sm">edit</span></button>
                        <button
                          onClick={async () => {
                            if (confirm('Excluir registro?')) {
                              await authFetch(`${API_BASE_URL}/api/service-history/${item.id}`, { method: 'DELETE' });
                              fetchSubData(selectedCompany.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-500"
                        ><span className="material-symbols-outlined text-sm">delete</span></button>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500 text-sm">Nenhum histórico disponível.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Modal
          isOpen={isSubModalOpen}
          onClose={() => setIsSubModalOpen(false)}
          title={editingSubId ? `Editar ${subModalType === 'unit' ? 'Unidade' : 'Histórico'}` : `Adicionar ${subModalType === 'unit' ? 'Unidade' : 'Histórico'}`}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const url = subModalType === 'unit'
                ? (editingSubId ? `${API_BASE_URL}/api/units/${editingSubId}` : `${API_BASE_URL}/api/units`)
                : (editingSubId ? `${API_BASE_URL}/api/service-history/${editingSubId}` : `${API_BASE_URL}/api/service-history`);

              const method = editingSubId ? 'PUT' : 'POST';
              const body = { ...subFormData, company_id: selectedCompany.id };

              await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
              });
              setIsSubModalOpen(false);
              fetchSubData(selectedCompany.id);
            }}
            className="space-y-4"
          >
            {subModalType === 'unit' ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Nome da Unidade</label>
                  <input required className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2 text-sm" value={subFormData.name} onChange={e => setSubFormData({ ...subFormData, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Endereço</label>
                  <input required className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2 text-sm" value={subFormData.address} onChange={e => setSubFormData({ ...subFormData, address: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2 text-sm" value={subFormData.unit_type} onChange={e => setSubFormData({ ...subFormData, unit_type: e.target.value })}>
                    <option value="Filial">Filial</option>
                    <option value="Canteiro">Canteiro</option>
                    <option value="Escritório">Escritório</option>
                    <option value="Depósito">Depósito</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Data</label>
                  <input type="date" required className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2 text-sm" value={subFormData.date} onChange={e => setSubFormData({ ...subFormData, date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Descrição do Serviço</label>
                  <textarea required className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2 text-sm min-h-[100px]" value={subFormData.description} onChange={e => setSubFormData({ ...subFormData, description: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Responsável Técnico</label>
                  <input required className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2 text-sm" value={subFormData.technician} onChange={e => setSubFormData({ ...subFormData, technician: e.target.value })} />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setIsSubModalOpen(false)} className="px-4 py-2 text-sm border rounded-lg">Cancelar</button>
              <button type="submit" className="px-4 py-2 text-sm bg-primary text-black font-bold rounded-lg hover:bg-green-400 transition-colors">Salvar</button>
            </div>
          </form >
        </Modal >
      </div >
    );
  }

  // --- Main View (Tabs) ---
  return (
    <div className="space-y-6" onClick={() => setOpenActionId(null)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Gestão de Empresas</h1>
          <p className="text-gray-500 dark:text-gray-400">Gerencie clientes, contratos e colaboradores.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setMainTab('companies')}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${mainTab === 'companies' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Empresas
        </button>
        <button
          onClick={() => setMainTab('employees')}
          className={`px-4 py-2 text-sm font-bold transition-colors border-b-2 ${mainTab === 'employees' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Colaboradores
        </button>
      </div>

      {mainTab === 'companies' ? (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={(e) => { e.stopPropagation(); handleOpenModal(); }}
              className="flex items-center justify-center gap-2 rounded-lg h-10 px-5 bg-primary hover:bg-green-400 text-text-main text-sm font-bold shadow-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              Nova Empresa
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex-1 relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors material-symbols-outlined">search</span>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 text-text-main dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                placeholder="Buscar por nome, contato ou e-mail..."
                type="text"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-11 pl-4 pr-10 rounded-lg bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                >
                  <option value="Todos">Todos os Status</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Irregular">Irregular</option>
                  <option value="Pendente">Pendente</option>
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none material-symbols-outlined text-[20px]">expand_more</span>
              </div>
              <button className="h-11 w-11 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-dark text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span className="material-symbols-outlined">filter_list</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-surface-light dark:bg-surface-dark overflow-visible shadow-sm">
            <div className="overflow-x-auto overflow-y-visible min-h-[300px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-background-dark border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Empresa</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Responsável</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">CNAE / Risco</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">Rep. Legal</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredCompanies.length > 0 ? (
                    filteredCompanies.map((company) => (
                      <tr key={company.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors relative">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`size-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${company.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : company.status === 'irregular' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30'}`}>
                              {company.initials}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{company.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">ID: #{company.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{company.contact}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{company.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusPopup({ isOpen: true, status: company.status || 'pending' });
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border cursor-pointer hover:opacity-80 transition-opacity ${company.status === 'active' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800' : company.status === 'irregular' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800' : 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800'}`}
                            title="Clique para ver informações sobre este status"
                          >
                            {company.status === 'active' ? 'Ativo' : company.status === 'irregular' ? 'Irregular' : 'Pendente'}
                            <span className="material-symbols-outlined text-[14px]">info</span>
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 dark:text-gray-200">CNAE: {company.cnae || '-'}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Risco: Grau {company.riskLevel || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          <div className="flex flex-col">
                            <span className="font-medium">{company.legalRepresentative || '-'}</span>
                            <span className="text-xs text-gray-500">Representante</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenModal(company); }}
                            className="text-gray-400 hover:text-primary transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 mr-1"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionId(openActionId === company.id ? null : company.id);
                            }}
                            className="text-gray-400 hover:text-primary transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <span className="material-symbols-outlined text-[20px]">more_vert</span>
                          </button>

                          {/* Dropdown Menu */}
                          {openActionId === company.id && (
                            <div className="absolute right-8 top-10 w-40 bg-white dark:bg-surface-dark rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-fade-in">
                              <button onClick={() => handleOpenDetails(company)} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">visibility</span> Detalhes
                              </button>
                              <button onClick={() => alert('Agendar Visita')} className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">event</span> Visita
                              </button>
                              <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(company.id); }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span> Excluir
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                        <p>Nenhuma empresa encontrada com os filtros atuais.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <EmployeesManager companies={companies} />
      )}

      {/* Main Company Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Empresa" : "Nova Empresa"}>
        <form onSubmit={handleSaveCompany} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da Empresa</label>
            <input
              required
              type="text"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
              placeholder="Ex: Construções Ltda"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Responsável</label>
            <input
              required
              type="text"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
              placeholder="Nome completo"
              value={formData.contact}
              onChange={e => setFormData({ ...formData, contact: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              required
              type="email"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
              placeholder="contato@empresa.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CNAE</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
                placeholder="Ex: 41.20-4-00"
                value={formData.cnae}
                onChange={e => setFormData({ ...formData, cnae: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grau de Risco</label>
              <select
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
                value={formData.riskLevel}
                onChange={e => setFormData({ ...formData, riskLevel: parseInt(e.target.value) })}
              >
                <option value={1}>Grau 1</option>
                <option value={2}>Grau 2</option>
                <option value={3}>Grau 3</option>
                <option value={4}>Grau 4</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Representante Legal</label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-background-dark p-2.5 text-sm dark:text-white"
              placeholder="Nome do representante"
              value={formData.legalRepresentative}
              onChange={e => setFormData({ ...formData, legalRepresentative: e.target.value })}
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-surface-dark dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-black bg-primary rounded-lg hover:bg-green-400">
              {editingId ? "Salvar Alterações" : "Cadastrar Empresa"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Status Explanation Popup */}
      <Modal
        isOpen={statusPopup.isOpen}
        onClose={() => setStatusPopup({ isOpen: false, status: null })}
        title="Legenda de Status"
        size="sm"
      >
        {statusPopup.status && statusExplanations[statusPopup.status] && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${statusPopup.status === 'active' ? 'bg-green-100 dark:bg-green-900/30' :
                statusPopup.status === 'irregular' ? 'bg-red-100 dark:bg-red-900/30' :
                  'bg-yellow-100 dark:bg-yellow-900/30'
                }`}>
                <span className={`material-symbols-outlined text-2xl ${statusExplanations[statusPopup.status].color}`}>
                  {statusExplanations[statusPopup.status].icon}
                </span>
              </div>
              <h4 className={`text-lg font-bold ${statusExplanations[statusPopup.status].color}`}>
                {statusExplanations[statusPopup.status].title}
              </h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {statusExplanations[statusPopup.status].description}
            </p>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h5 className="text-xs font-bold uppercase text-gray-500 mb-3">Todos os Status</h5>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300">Ativo</span>
                  <span className="text-xs text-gray-500">- Empresa regularizada</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300">Pendente</span>
                  <span className="text-xs text-gray-500">- Aguardando ações</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/40 dark:text-red-300">Irregular</span>
                  <span className="text-xs text-gray-500">- Requer atenção urgente</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setStatusPopup({ isOpen: false, status: null })}
                className="px-4 py-2 text-sm font-medium text-black bg-primary rounded-lg hover:bg-green-400 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};