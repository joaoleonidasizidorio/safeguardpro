import React, { useState, useEffect } from 'react';
import { View } from '../types';
import { authFetch } from '../utils/api';
import {
    Building2, Users, FileText, Search, Plus, Filter, Calendar,
    Download, Trash2, Edit, AlertCircle, CheckCircle, Clock
} from 'lucide-react';
import { ASOForm } from './ASOForm';

export const ASOManagement: React.FC = () => {
    const [asos, setAsos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [companies, setCompanies] = useState<any[]>([]);
    const [selectedCompany, setSelectedCompany] = useState('');

    // Pagination
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [hasMore, setHasMore] = useState(false); // Simplified pagination

    // Selection
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Create/Edit Mode
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAso, setEditingAso] = useState<any>(null);

    useEffect(() => {
        fetchCompanies();
    }, []);

    useEffect(() => {
        fetchASOs();
    }, [selectedCompany, page]);

    const fetchCompanies = async () => {
        try {
            const res = await authFetch('http://localhost:7000/api/companies');
            if (res.ok) setCompanies(await res.json());
        } catch (error) {
            console.error('Error fetching companies', error);
        }
    };

    const fetchASOs = async () => {
        setLoading(true);
        try {
            let url = `http://localhost:7000/api/asos?page=${page}&limit=${limit}`;
            if (selectedCompany) url += `&company_id=${selectedCompany}`;

            const res = await authFetch(url);
            if (res.ok) {
                const data = await res.json();
                setAsos(data);
                setHasMore(data.length === limit); // Naive check
            }
        } catch (error) {
            console.error('Error fetching ASOs', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async (id: number) => {
        try {
            const res = await authFetch(`http://localhost:7000/api/asos/${id}/pdf`, {
                method: 'POST'
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `aso-${id}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                const err = await res.json();
                alert(`Erro ao baixar PDF: ${err.error || 'Erro desconhecido'}`);
            }
        } catch (error) {
            console.error('Error downloading ASO', error);
            alert('Erro ao baixar ASO');
        }
    };

    const handlePrint = async (id: number) => {
        try {
            const res = await authFetch(`http://localhost:7000/api/asos/${id}/pdf`, {
                method: 'POST'
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
            } else {
                const err = await res.json();
                alert(`Erro ao imprimir PDF: ${err.error || 'Erro desconhecido'}`);
            }
        } catch (error) {
            console.error('Error printing ASO', error);
            alert('Erro ao imprimir ASO');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir este ASO?')) return;
        try {
            const res = await authFetch(`http://localhost:7000/api/asos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchASOs();
                setSelectedIds(prev => prev.filter(pid => pid !== id));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} itens?`)) return;

        // Loop delete (simplest for now)
        for (const id of selectedIds) {
            await authFetch(`http://localhost:7000/api/asos/${id}`, { method: 'DELETE' });
        }
        setSelectedIds([]);
        fetchASOs();
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === asos.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(asos.map(a => a.id));
        }
    };

    const toggleSelect = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(pid => pid !== id));
        } else {
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const handleEdit = async (id: number) => {
        try {
            setLoading(true);
            const res = await authFetch(`http://localhost:7000/api/asos/${id}?t=${Date.now()}`, {
                headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
            });
            if (res.ok) {
                const fullAso = await res.json();
                setEditingAso(fullAso);
                setIsModalOpen(true);
            } else {
                alert('Erro ao carregar detalhes do ASO');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao carregar ASO');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="w-8 h-8 text-blue-600" />
                        Gestão de ASO
                    </h1>
                    <p className="text-gray-600">Atestados de Saúde Ocupacional</p>
                </div>
                <div className="flex gap-2">
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
                        >
                            <Trash2 size={20} /> Excluir ({selectedIds.length})
                        </button>
                    )}
                    <button
                        onClick={() => { setEditingAso(null); setIsModalOpen(true); }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Plus size={20} /> Novo ASO
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4 items-center">
                <div className="flex items-center gap-2 text-gray-600">
                    <Filter size={20} />
                    <span>Filtrar por:</span>
                </div>
                <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Todas as Empresas</option>
                    {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por funcionário..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left">
                                <input
                                    type="checkbox"
                                    checked={asos.length > 0 && selectedIds.length === asos.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Funcionário</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Exame</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Situação</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={6} className="text-center py-8">Carregando...</td></tr>
                        ) : asos.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-8 text-gray-500">Nenhum ASO encontrado</td></tr>
                        ) : (
                            asos.map((aso) => (
                                <tr key={aso.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(aso.id)}
                                            onChange={() => toggleSelect(aso.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{aso.employee_name}</div>
                                        <div className="text-sm text-gray-500">{aso.employee_cpf}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{aso.type}</td>
                                    <td className="px-6 py-4 text-sm text-gray-700">
                                        {new Date(aso.exam_date).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${aso.aptitude_status === 'Apto' ? 'bg-green-100 text-green-800' :
                                            aso.aptitude_status === 'Inapto' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {aso.aptitude_status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium flex justify-end gap-2">
                                        <button
                                            onClick={() => handlePrint(aso.id)}
                                            className="text-gray-600 hover:text-gray-900"
                                            title="Imprimir"
                                        >
                                            <FileText size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDownloadPDF(aso.id)}
                                            className="text-blue-600 hover:text-blue-900"
                                            title="Baixar PDF"
                                        >
                                            <Download size={18} />
                                        </button>
                                        <button
                                            onClick={() => { setEditingAso(aso); setIsModalOpen(true); }}
                                            className="text-green-600 hover:text-green-900"
                                            title="Editar"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(aso.id)}
                                            className="text-red-600 hover:text-red-900"
                                            title="Excluir"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex justify-between items-center">
                <button
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-4 py-2 border rounded-lg bg-white disabled:opacity-50"
                >
                    Anterior
                </button>
                <span className="text-gray-600">Página {page}</span>
                <button
                    disabled={!hasMore && asos.length < limit}
                    onClick={() => setPage(p => p + 1)}
                    className="px-4 py-2 border rounded-lg bg-white disabled:opacity-50"
                >
                    Próximo
                </button>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 relative">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                        >
                            <span className="sr-only">Fechar</span>
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <h2 className="text-xl font-bold mb-4 pr-8">
                            {editingAso ? 'Editar ASO' : 'Novo ASO'}
                        </h2>

                        <ASOForm
                            key={editingAso ? editingAso.id : 'new'}
                            onSuccess={() => { setIsModalOpen(false); fetchASOs(); }}
                            onCancel={() => setIsModalOpen(false)}
                            initialData={editingAso}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
