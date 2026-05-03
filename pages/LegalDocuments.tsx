import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

interface Document {
    id: number;
    company_id: string;
    type: string;
    name: string;
    url: string;
    version: number;
    expiration_date?: string;
    created_at: string;
}

export const LegalDocuments: React.FC = () => {
    const [companies, setCompanies] = useState<any[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [documents, setDocuments] = useState<Document[]>([]);
    const [filterType, setFilterType] = useState('Todos');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal & Form
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ type: '', name: '', expiration_date: '' });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const docTypes = ['PGR', 'PCMSO', 'LTCAT', 'PPP', 'ASO', 'APR', 'Ordem de Serviço', 'Outros'];

    // Fetch Companies
    useEffect(() => {
        const loadCompanies = async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/api/companies`);
                if (res.status === 401) {
                    setError('Sessão expirada. Por favor, faça login novamente.');
                    return;
                }
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setCompanies(data);
                        if (data.length > 0) setSelectedCompanyId(data[0].id);
                    }
                } else {
                    console.error("Error fetching companies:", res.statusText);
                }
            } catch (err) {
                console.error("Fetch companies exception:", err);
                setError('Erro ao carregar empresas.');
            } finally {
                setLoading(false);
            }
        };
        loadCompanies();
    }, []);

    // Fetch Documents
    useEffect(() => {
        if (!selectedCompanyId) return;
        fetchDocuments();
    }, [selectedCompanyId, filterType]);

    const fetchDocuments = async () => {
        try {
            let url = `${API_BASE_URL}/api/documents?company_id=${selectedCompanyId}`;
            if (filterType !== 'Todos') url += `&type=${filterType}`;
            const res = await authFetch(url);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setDocuments(data);
            }
        } catch (err) {
            console.error("Fetch documents error:", err);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString();
        } catch (e) {
            return dateStr;
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) return alert('Selecione um arquivo');

        try {
            // 1. Upload File
            const uploadData = new FormData();
            uploadData.append('document', selectedFile);

            const uploadRes = await authFetch(`${API_BASE_URL}/api/documents/upload`, {
                method: 'POST', body: uploadData
            });

            if (!uploadRes.ok) throw new Error('Falha no upload');
            const { url } = await uploadRes.json();

            // 2. Register Document
            const payload = {
                company_id: selectedCompanyId,
                type: formData.type,
                name: formData.name,
                url: url,
                expiration_date: formData.expiration_date || null
            };

            const res = await authFetch(`${API_BASE_URL}/api/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchDocuments();
                setFormData({ type: '', name: '', expiration_date: '' });
                setSelectedFile(null);
            } else {
                alert('Erro ao salvar documento');
            }
        } catch (err) {
            console.error(err);
            alert('Erro ao enviar documento');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Excluir este documento?')) return;
        await authFetch(`${API_BASE_URL}/api/documents/${id}`, { method: 'DELETE' });
        fetchDocuments();
    };

    if (loading) return <div className="p-8 text-center">Carregando documentos...</div>;

    if (error) return (
        <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl">
            <h3 className="font-bold text-lg">Acesso Negado ou Erro de Conexão</h3>
            <p>{error}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white">Documentos Legais</h1>
                    <p className="text-gray-500 dark:text-gray-400">Central de documentos versionados e controle de validade.</p>
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
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center justify-center rounded-lg h-10 px-4 bg-primary text-black font-bold shadow-md"
                    >
                        <span className="material-symbols-outlined mr-2">upload_file</span>
                        Upload
                    </button>
                </div>
            </div>

            <div className="flex gap-4 mb-4 overflow-x-auto pb-2">
                <button
                    onClick={() => setFilterType('Todos')}
                    className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${filterType === 'Todos' ? 'bg-primary text-black' : 'bg-gray-200 dark:bg-gray-800'}`}
                >
                    Todos
                </button>
                {docTypes.map(type => (
                    <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${filterType === type ? 'bg-primary text-black' : 'bg-gray-200 dark:bg-gray-800'}`}
                    >
                        {type}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {documents.length === 0 ? (
                    <div className="col-span-full text-center text-gray-500 py-10">Nenhum documento encontrado.</div>
                ) : (
                    documents.map(doc => (
                        <div key={doc.id} className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs font-bold rounded">{doc.type}</span>
                                <div className="flex items-center gap-1">
                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">v{doc.version || 1}</span>
                                    <button onClick={() => handleDelete(doc.id)} className="text-gray-400 hover:text-red-500">
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>
                            <h3 className="font-bold text-lg mb-1 truncate" title={doc.name}>{doc.name}</h3>
                            <p className="text-xs text-gray-500 mb-4">Enviado em: {formatDate(doc.created_at)}</p>

                            {doc.expiration_date && (
                                <div className="mb-4 text-xs">
                                    <span className="font-bold">Validade: </span>
                                    <span className={new Date(doc.expiration_date) < new Date() ? 'text-red-500 font-bold' : 'text-green-600'}>
                                        {formatDate(doc.expiration_date)}
                                    </span>
                                </div>
                            )}

                            <a
                                href={`${API_BASE_URL}${doc.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full text-center bg-gray-50 dark:bg-gray-800 py-2 rounded-lg text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                Visualizar Arquivo
                            </a>
                        </div>
                    ))
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Documento">
                <form onSubmit={handleUpload} className="space-y-4">
                    <div>
                        <label className="block text-sm mb-1">Tipo de Documento</label>
                        <select
                            required
                            className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="">Selecione...</option>
                            {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Nome do Arquivo/Documento</label>
                        <input
                            required
                            type="text"
                            placeholder="Ex: PGR 2024 - Versão Final"
                            className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Validade (Opcional)</label>
                        <input
                            type="date"
                            className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                            value={formData.expiration_date}
                            onChange={e => setFormData({ ...formData, expiration_date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Arquivo (PDF, Doc, Imagem)</label>
                        <input required type="file" onChange={handleFileChange} className="w-full text-sm" />
                    </div>
                    <button type="submit" className="w-full bg-primary text-black p-2 rounded font-bold hover:bg-primary/90 transition-colors">Enviar Documento</button>
                    <p className="text-xs text-center text-gray-500">O sistema irá gerar automaticamente uma nova versão se o nome for igual.</p>
                </form>
            </Modal>
        </div>
    );
};
