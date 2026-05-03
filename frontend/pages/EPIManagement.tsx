import React, { useState, useEffect } from 'react';
import { EPI, Employee, EPIDelivery, Company } from '../types';
import { Modal } from '../components/Modal';
import { SignaturePad } from '../components/SignaturePad';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

// Subcomponents (can be extracted later)
const InventoryTab: React.FC<{ companyId: string }> = ({ companyId }) => {
    const [epis, setEpis] = useState<EPI[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentEpi, setCurrentEpi] = useState<Partial<EPI>>({});
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        fetchEpis();
    }, [companyId]);

    const fetchEpis = async () => {
        const res = await authFetch(`${API_BASE_URL}/api/epis?company_id=${companyId}`);
        if (res.ok) setEpis(await res.json());
    };

    const handleOpenNew = () => {
        setCurrentEpi({});
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (epi: EPI) => {
        setCurrentEpi(epi);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir este EPI?')) return;
        await authFetch(`${API_BASE_URL}/api/epis/${id}`, { method: 'DELETE' });
        fetchEpis();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = isEditing
            ? `${API_BASE_URL}/api/epis/${currentEpi.id}`
            : `${API_BASE_URL}/api/epis`;

        const method = isEditing ? 'PUT' : 'POST';

        await authFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...currentEpi, company_id: companyId })
        });
        setIsModalOpen(false);
        fetchEpis();
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Estoque de EPIs</h3>
                <button onClick={handleOpenNew} className="bg-primary text-black px-4 py-2 rounded font-bold">Novo EPI</button>
            </div>
            <div className="bg-white dark:bg-surface-dark rounded shadow overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="p-3">Nome</th>
                            <th className="p-3">CA</th>
                            <th className="p-3">Fabricante</th>
                            <th className="p-3">Validade (dias)</th>
                            <th className="p-3">Estoque</th>
                            <th className="p-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {epis.map(epi => (
                            <tr key={epi.id}>
                                <td className="p-3 font-medium">{epi.name}</td>
                                <td className="p-3">{epi.ca_number}</td>
                                <td className="p-3">{epi.manufacturer}</td>
                                <td className="p-3">{epi.validity_days}</td>
                                <td className="p-3 font-bold">{epi.stock_quantity}</td>
                                <td className="p-3 text-right space-x-2">
                                    <button onClick={() => handleOpenEdit(epi)} className="text-blue-600 hover:text-blue-800" title="Editar">
                                        <span className="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                    <button onClick={() => handleDelete(epi.id)} className="text-red-600 hover:text-red-800" title="Excluir">
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? "Editar EPI" : "Cadastrar EPI"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <input className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" placeholder="Nome do EPI" value={currentEpi.name || ''} onChange={e => setCurrentEpi({ ...currentEpi, name: e.target.value })} required />
                    <input className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" placeholder="Número do CA" value={currentEpi.ca_number || ''} onChange={e => setCurrentEpi({ ...currentEpi, ca_number: e.target.value })} required />
                    <input className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" placeholder="Fabricante" value={currentEpi.manufacturer || ''} onChange={e => setCurrentEpi({ ...currentEpi, manufacturer: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="number" className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" placeholder="Validade (dias)" value={currentEpi.validity_days || ''} onChange={e => setCurrentEpi({ ...currentEpi, validity_days: Number(e.target.value) })} />
                        <input type="number" className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" placeholder="Qtd. Estoque" value={currentEpi.stock_quantity || ''} onChange={e => setCurrentEpi({ ...currentEpi, stock_quantity: Number(e.target.value) })} required />
                    </div>
                    <button className="w-full bg-primary p-2 rounded font-bold">Salvar</button>
                </form>
            </Modal>
        </div>
    );
};

const EmployeesTab: React.FC<{ companyId: string }> = ({ companyId }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEmp, setNewEmp] = useState<Partial<Employee>>({});

    useEffect(() => { fetchEmployees(); }, [companyId]);

    const fetchEmployees = async () => {
        const res = await authFetch(`${API_BASE_URL}/api/employees?company_id=${companyId}`);
        if (res.ok) setEmployees(await res.json());
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        await authFetch(`${API_BASE_URL}/api/employees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newEmp, company_id: companyId })
        });
        setIsModalOpen(false);
        fetchEmployees();
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Colaboradores</h3>
                <button onClick={() => setIsModalOpen(true)} className="bg-primary text-black px-4 py-2 rounded font-bold">Novo Colaborador</button>
            </div>
            <div className="bg-white dark:bg-surface-dark rounded shadow overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="p-3">Nome</th>
                            <th className="p-3">Cargo</th>
                            <th className="p-3">Admissão</th>
                            <th className="p-3">CPF</th>
                            <th className="p-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {employees.map(emp => (
                            <tr key={emp.id}>
                                <td className="p-3 font-medium">{emp.name}</td>
                                <td className="p-3">{emp.role}</td>
                                <td className="p-3">{emp.admission_date}</td>
                                <td className="p-3">{emp.cpf}</td>
                                <td className="p-3 text-right">
                                    <button
                                        onClick={() => window.open(`${API_BASE_URL}/api/reports/epi-history/${emp.id}/pdf`, '_blank')}
                                        className="text-gray-600 hover:text-gray-800"
                                        title="Imprimir Ficha de EPI"
                                    >
                                        <span className="material-symbols-outlined text-sm">print</span>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Cadastrar Colaborador">
                <form onSubmit={handleSave} className="space-y-4">
                    <input className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" placeholder="Nome Completo" onChange={e => setNewEmp({ ...newEmp, name: e.target.value })} required />
                    <input className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" placeholder="Cargo / Função" onChange={e => setNewEmp({ ...newEmp, role: e.target.value })} required />
                    <input className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" placeholder="CPF" onChange={e => setNewEmp({ ...newEmp, cpf: e.target.value })} />
                    <input className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" placeholder="Data Admissão" type="date" onChange={e => setNewEmp({ ...newEmp, admission_date: e.target.value })} />
                    <button className="w-full bg-primary p-2 rounded font-bold">Salvar</button>
                </form>
            </Modal>
        </div>
    );
};

const DeliveriesTab: React.FC<{ companyId: string }> = ({ companyId }) => {
    const [deliveries, setDeliveries] = useState<EPIDelivery[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [epis, setEpis] = useState<EPI[]>([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [viewDelivery, setViewDelivery] = useState<EPIDelivery | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // newDelivery state uses Partial<EPIDelivery> to allow incomplete data during creation
    const [newDelivery, setNewDelivery] = useState<Partial<EPIDelivery>>({ quantity: 1, reason: 'Entrega Inicial' });

    useEffect(() => {
        fetchDeliveries();
        fetchEmployees();
        fetchEpis();
    }, [companyId]);

    const fetchDeliveries = async () => {
        const res = await authFetch(`${API_BASE_URL}/api/epi-deliveries?company_id=${companyId}`);
        if (res.ok) setDeliveries(await res.json());
    };
    const fetchEmployees = async () => {
        const res = await authFetch(`${API_BASE_URL}/api/employees?company_id=${companyId}`);
        if (res.ok) setEmployees(await res.json());
    };
    const fetchEpis = async () => {
        const res = await authFetch(`${API_BASE_URL}/api/epis?company_id=${companyId}`);
        if (res.ok) setEpis(await res.json());
    };

    const handleOpenNew = () => {
        setNewDelivery({ quantity: 1, reason: 'Entrega Inicial', company_id: companyId });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleEdit = (del: EPIDelivery) => {
        setNewDelivery({
            ...del,
            employee_id: del.employee_id,
            epi_id: del.epi_id
        });
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleView = (del: EPIDelivery) => {
        setViewDelivery(del);
        setIsViewerOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Deseja excluir esta entrega? O estoque será reposto.')) return;
        try {
            await authFetch(`${API_BASE_URL}/api/epi-deliveries/${id}`, { method: 'DELETE' });
            fetchDeliveries();
            fetchEpis();
        } catch (err) {
            alert('Erro ao excluir');
        }
    };

    const handleSave = async () => {
        if (!newDelivery.employee_signature && !isEditing) {
            alert('A assinatura do colaborador é obrigatória.');
            return;
        }

        try {
            const url = isEditing
                ? `${API_BASE_URL}/api/epi-deliveries/${newDelivery.id}`
                : `${API_BASE_URL}/api/epi-deliveries`;

            const method = isEditing ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDelivery)
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setIsModalOpen(false);
            fetchDeliveries();
            fetchEpis();
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Histórico de Entregas</h3>
                <button onClick={handleOpenNew} className="bg-primary text-black px-4 py-2 rounded font-bold">Registrar Entrega</button>
            </div>
            <div className="bg-white dark:bg-surface-dark rounded shadow overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="p-3">Data</th>
                            <th className="p-3">Colaborador</th>
                            <th className="p-3">EPI</th>
                            <th className="p-3">CA</th>
                            <th className="p-3">Qtd</th>
                            <th className="p-3">Motivo</th>
                            <th className="p-3">Próx. Troca</th>
                            <th className="p-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {deliveries.map(del => (
                            <tr key={del.id}>
                                <td className="p-3">{new Date(del.delivery_date).toLocaleDateString()}</td>
                                <td className="p-3 font-medium">{del.employee_name}</td>
                                <td className="p-3">{del.epi_name}</td>
                                <td className="p-3">{del.ca_number}</td>
                                <td className="p-3">{del.quantity}</td>
                                <td className="p-3">{del.reason}</td>
                                <td className="p-3 text-orange-600 font-bold">
                                    {del.next_exchange_date ? new Date(del.next_exchange_date).toLocaleDateString() : '-'}
                                </td>
                                <td className="p-3 text-right space-x-2">
                                    <button onClick={() => handleView(del)} className="text-gray-600 hover:text-gray-800" title="Visualizar">
                                        <span className="material-symbols-outlined text-sm">visibility</span>
                                    </button>
                                    <button onClick={() => handleEdit(del)} className="text-blue-600 hover:text-blue-800" title="Editar">
                                        <span className="material-symbols-outlined text-sm">edit</span>
                                    </button>
                                    <button onClick={() => handleDelete(del.id)} className="text-red-600 hover:text-red-800" title="Excluir">
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* View Modal */}
            <Modal isOpen={isViewerOpen} onClose={() => setIsViewerOpen(false)} title="Comprovante de Entrega" size="lg">
                {viewDelivery && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500">Colaborador</label>
                                <p className="font-bold">{viewDelivery.employee_name}</p>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">Data Entrega</label>
                                <p className="font-bold">{new Date(viewDelivery.delivery_date).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">EPI</label>
                                <p className="font-bold">{viewDelivery.epi_name} (CA: {viewDelivery.ca_number})</p>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">Motivo</label>
                                <p>{viewDelivery.reason}</p>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <p className="font-bold mb-2">Assinatura do Colaborador</p>
                            {viewDelivery.employee_signature ? (
                                <img src={viewDelivery.employee_signature} alt="Assinatura" className="border rounded max-w-full" />
                            ) : (
                                <p className="text-gray-400 italic">Sem assinatura digital.</p>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? "Editar Entrega" : "Registrar Entrega de EPI"} size="lg">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm mb-1">Colaborador</label>
                        <select className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                            disabled={isEditing}
                            value={newDelivery.employee_id || ''}
                            onChange={e => setNewDelivery({ ...newDelivery, employee_id: Number(e.target.value) })}>
                            <option value="">Selecione...</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm mb-1">EPI</label>
                        <select className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                            disabled={isEditing}
                            value={newDelivery.epi_id || ''}
                            onChange={e => setNewDelivery({ ...newDelivery, epi_id: Number(e.target.value) })}>
                            <option value="">Selecione...</option>
                            {epis.map(e => <option key={e.id} value={e.id}>{e.name} (Estoque: {e.stock_quantity})</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm mb-1">Quantidade</label>
                            <input type="number" className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" value={newDelivery.quantity} onChange={e => setNewDelivery({ ...newDelivery, quantity: Number(e.target.value) })} />
                        </div>
                        <div>
                            <label className="block text-sm mb-1">Motivo</label>
                            <select className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" value={newDelivery.reason} onChange={e => setNewDelivery({ ...newDelivery, reason: e.target.value })}>
                                <option value="Entrega Inicial">Entrega Inicial</option>
                                <option value="Troca por Validade">Troca por Validade</option>
                                <option value="Perda">Perda</option>
                                <option value="Dano">Dano</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded text-sm text-justify">
                        <p className="font-bold mb-2">Termo de Responsabilidade</p>
                        Declaro ter recebido os EPIs relacionados acima em perfeito estado de conservação e funcionamento. Comprometo-me a utilizá-los apenas para as finalidades a que se destinam, responsabilizando-me por sua guarda e conservação.
                    </div>

                    <SignaturePad
                        label="Assinatura do Colaborador"
                        initialSignature={newDelivery.employee_signature}
                        onSave={(sig) => setNewDelivery({ ...newDelivery, employee_signature: sig })}
                        onClear={() => setNewDelivery({ ...newDelivery, employee_signature: undefined })}
                    />

                    <button onClick={handleSave} className="w-full bg-primary p-2 rounded font-bold mt-4">Confirmar Entrega</button>
                </div>
            </Modal>
        </div>
    );
};

const TechnicalProfileTab: React.FC<{ companyId: string }> = ({ companyId }) => {
    const [roles, setRoles] = useState<string[]>([]);
    const [epis, setEpis] = useState<EPI[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [matrix, setMatrix] = useState<Record<string, number[]>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, [companyId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [empRes, epiRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/api/employees?company_id=${companyId}`),
                authFetch(`${API_BASE_URL}/api/epis?company_id=${companyId}`)
            ]);

            if (empRes.ok && epiRes.ok) {
                const employees: Employee[] = await empRes.json();
                const episList: EPI[] = await epiRes.json();

                // Extract unique roles
                const uniqueRoles = Array.from(new Set(employees.map(e => e.role).filter(Boolean)));
                setRoles(uniqueRoles);
                setEpis(episList);

                // Load matrix from localStorage key `epi_matrix_${companyId}`
                const savedMatrix = localStorage.getItem(`epi_matrix_${companyId}`);
                if (savedMatrix) {
                    setMatrix(JSON.parse(savedMatrix));
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleEpiForRole = (epiId: number) => {
        if (!selectedRole) return;
        const currentEpis = matrix[selectedRole] || [];
        const newEpis = currentEpis.includes(epiId)
            ? currentEpis.filter(id => id !== epiId)
            : [...currentEpis, epiId];

        const newMatrix = { ...matrix, [selectedRole]: newEpis };
        setMatrix(newMatrix);
        localStorage.setItem(`epi_matrix_${companyId}`, JSON.stringify(newMatrix));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Perfil Técnico por Cargo</h3>
                <p className="text-sm text-gray-500">Defina os EPIs obrigatórios para cada função.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-surface-dark rounded shadow p-4">
                    <h4 className="font-bold mb-4 border-b pb-2">Cargos / Funções</h4>
                    {loading ? <p>Carregando...</p> : (
                        <ul className="space-y-2">
                            {roles.map(role => (
                                <li key={role}
                                    onClick={() => setSelectedRole(role)}
                                    className={`p-2 rounded cursor-pointer flex justify-between items-center ${selectedRole === role ? 'bg-primary text-black font-bold' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                                    {role}
                                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                                </li>
                            ))}
                            {roles.length === 0 && <p className="text-gray-500 text-sm">Nenhum cargo encontrado nos colaboradores.</p>}
                        </ul>
                    )}
                </div>

                <div className="md:col-span-2 bg-white dark:bg-surface-dark rounded shadow p-4">
                    <h4 className="font-bold mb-4 border-b pb-2">
                        {selectedRole ? `EPIs para: ${selectedRole}` : 'Selecione um cargo para ver os EPIs'}
                    </h4>

                    {selectedRole ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {epis.map(epi => {
                                const isChecked = (matrix[selectedRole] || []).includes(epi.id);
                                return (
                                    <div key={epi.id}
                                        onClick={() => toggleEpiForRole(epi.id)}
                                        className={`border rounded p-3 cursor-pointer transition-colors flex items-start gap-3 ${isChecked ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'}`}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${isChecked ? 'bg-primary border-primary text-white' : 'border-gray-400'}`}>
                                            {isChecked && <span className="material-symbols-outlined text-sm">check</span>}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{epi.name}</p>
                                            <p className="text-xs text-gray-500">CA: {epi.ca_number}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <span className="material-symbols-outlined text-4xl mb-2">touch_app</span>
                            <p>Clique em um cargo ao lado.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const EPIManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'inventory' | 'employees' | 'deliveries' | 'technical_profile'>('inventory');
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

    // Load companies to select context (if admin) or auto-select (if company)
    // For now, assuming Technician view selecting a company
    useEffect(() => {
        authFetch(`${API_BASE_URL}/api/companies`)
            .then(res => res.json())
            .then(data => {
                setCompanies(data);
                if (data.length > 0) setSelectedCompanyId(data[0].id);
            });
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">Gestão de EPIs</h1>
                    <p className="text-gray-500 dark:text-gray-400">Controle de estoque, entregas e validade.</p>
                </div>
                <div>
                    <select
                        className="p-2 border rounded-lg bg-white dark:bg-surface-dark dark:border-gray-700"
                        value={selectedCompanyId}
                        onChange={e => setSelectedCompanyId(e.target.value)}
                    >
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800">
                <button
                    onClick={() => setActiveTab('inventory')}
                    className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'inventory' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Estoque
                </button>
                <button
                    onClick={() => setActiveTab('employees')}
                    className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'employees' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Colaboradores
                </button>
                <button
                    onClick={() => setActiveTab('deliveries')}
                    className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'deliveries' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Entregas e Assinaturas
                </button>
                <button
                    onClick={() => setActiveTab('technical_profile')}
                    className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'technical_profile' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Perfil Técnico
                </button>
            </div>

            <div className="pt-4">
                {selectedCompanyId ? (
                    <>
                        {activeTab === 'inventory' && <InventoryTab companyId={selectedCompanyId} />}
                        {activeTab === 'employees' && <EmployeesTab companyId={selectedCompanyId} />}
                        {activeTab === 'deliveries' && <DeliveriesTab companyId={selectedCompanyId} />}
                        {activeTab === 'technical_profile' && <TechnicalProfileTab companyId={selectedCompanyId} />}
                    </>
                ) : <p>Selecione uma empresa.</p>}
            </div>
        </div>
    );
};
