import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Employee, Training } from '../types';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

interface RealTraining {
  id: number;
  company_id: string;
  employee_id: number;
  course_name: string;
  training_date: string;
  validity_date: string;
  status: 'Válido' | 'Vencendo' | 'Vencido';
  certificate_url?: string;
  employee_name?: string;
  employee_role?: string;
  template_id?: number; // New Link
}

interface CertificateTemplate {
  id: number;
  name: string;
  image_url: string;
  body_text?: string;
  verso_text?: string; // New field
}

interface StandardText {
  id: number;
  title: string;
  content: string;
}

const TemplatesTab: React.FC = () => {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [standardTexts, setStandardTexts] = useState<StandardText[]>([]); // Cache texts
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isTextManagerOpen, setIsTextManagerOpen] = useState(false); // New Modal
  const [newName, setNewName] = useState('');
  const [bodyText, setBodyText] = useState(`Certificamos que {nome}, portador do CPF {cpf}, concluiu com aproveitamento satisfatório o treinamento {curso}, realizado em {data}. Este certificado comprova a capacitação conforme exigências das Normas Regulamentadoras vigentes.`);
  const [versoText, setVersoText] = useState(''); // New State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplate | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'frente' | 'verso'>('frente'); // For Editor
  const [generationMode, setGenerationMode] = useState<'auto' | 'manual'>('auto');

  // New State for Text Editing
  const [editingText, setEditingText] = useState<StandardText | null>(null);
  const [editingTextTitle, setEditingTextTitle] = useState('');
  const [editingTextContent, setEditingTextContent] = useState('');

  // View Mode: Grid vs List
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchTemplates();
    fetchStandardTexts();
  }, []);

  const fetchTemplates = async () => {
    const res = await authFetch(`${API_BASE_URL}/api/certificate-templates`);
    if (res.ok) setTemplates(await res.json());
  };

  const fetchStandardTexts = async () => {
    const res = await authFetch(`${API_BASE_URL}/api/standard-texts`);
    if (res.ok) setStandardTexts(await res.json());
  };

  const handleTextUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const formData = new FormData();
    Array.from(e.target.files).forEach(f => formData.append('files', f));

    const res = await fetch(`${API_BASE_URL}/api/standard-texts/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      body: formData
    });

    if (res.ok) {
      alert('Textos importados com sucesso!');
      fetchStandardTexts();
    } else {
      alert('Erro ao importar textos');
    }
  };

  const handleUpdateText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingText) return;

    const res = await authFetch(`${API_BASE_URL}/api/standard-texts/${editingText.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editingTextTitle, content: editingTextContent })
    });

    if (res.ok) {
      setEditingText(null);
      fetchStandardTexts();
    } else {
      alert('Erro ao atualizar texto');
    }
  };

  const handleDeleteText = async (id: number) => {
    if (!confirm('Deseja excluir este texto padrão?')) return;
    await authFetch(`${API_BASE_URL}/api/standard-texts/${id}`, { method: 'DELETE' });
    fetchStandardTexts();
  };

  const startEditText = (t: StandardText) => {
    setEditingText(t);
    setEditingTextTitle(t.title);
    setEditingTextContent(t.content);
  };

  const applyStandardText = (textId: string) => {
    const txt = standardTexts.find(t => t.id === Number(textId));
    if (txt) setBodyText(txt.content);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    // Use FormData for POST (with file) or JSON for PUT (usually text only, unless file replaced)
    // For simplicity, we can use FormData for both? Or JSON for PUT?
    // My PUT endpoint expects JSON body { name, body_text }.
    // If user wants to replace Image, I'd need separate logic or improve PUT.
    // For now: EDIT = Name/Text only. CREATE = Name/Text/Image.

    if (selectedTemplate) {
      // Edit Logic
      const res = await authFetch(`${API_BASE_URL}/api/certificate-templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, body_text: bodyText, verso_text: versoText })
      });
      if (res.ok) {
        setIsUploadOpen(false);
        fetchTemplates();
      } else {
        alert('Erro ao atualizar modelo');
      }
    } else {
      // Create Logic
      if (!selectedFile) return;
      const formData = new FormData();
      formData.append('name', newName);
      formData.append('body_text', bodyText);
      formData.append('verso_text', versoText);
      formData.append('background', selectedFile);

      const res = await fetch(`${API_BASE_URL}/api/certificate-templates`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
        body: formData
      });

      if (res.ok) {
        setIsUploadOpen(false);
        setNewName('');
        setSelectedFile(null);
        fetchTemplates();
      } else {
        alert('Erro ao enviar modelo');
      }
    }
  };

  const openNew = () => {
    setSelectedTemplate(null);
    setNewName('');
    // Default text
    setBodyText(`Certificamos que {nome}, portador do CPF {cpf}, concluiu com aproveitamento satisfatório o treinamento {curso}, realizado em {data}. Este certificado comprova a capacitação conforme exigências das Normas Regulamentadoras vigentes.`);
    setIsUploadOpen(true);
  };

  const openEdit = (t: CertificateTemplate) => {
    setSelectedTemplate(t);
    setNewName(t.name);
    setBodyText(t.body_text || '');
    setVersoText(t.verso_text || '');
    setActiveModalTab('frente');
    setIsUploadOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja excluir este modelo?')) return;
    await authFetch(`${API_BASE_URL}/api/certificate-templates/${id}`, { method: 'DELETE' });
    fetchTemplates();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Meus Modelos de Certificado</h3>
        <div className="flex gap-2 items-center">
          {/* View Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded p-1 mr-4">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              title="Visualização em Grade"
            >
              <span className="material-symbols-outlined text-lg">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded ${viewMode === 'list' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              title="Visualização em Lista"
            >
              <span className="material-symbols-outlined text-lg">view_list</span>
            </button>
          </div>

          <button onClick={() => setIsTextManagerOpen(true)} className="bg-gray-200 text-black px-4 py-2 rounded font-bold hover:bg-gray-300">Gerenciar Textos (Upload)</button>
          <button onClick={openNew} className="bg-primary text-black px-4 py-2 rounded font-bold">Novo Modelo</button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map(t => (
            <div key={t.id} className="border rounded-lg overflow-hidden bg-white shadow-sm dark:bg-surface-dark dark:border-gray-700 group relative">
              {t.image_url ? (
                <img src={`${API_BASE_URL}${t.image_url}`} alt={t.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 flex-col">
                  <span className="material-symbols-outlined text-4xl mb-2">article</span>
                  <span className="text-xs font-bold uppercase">Layout Padrão</span>
                </div>
              )}
              <div className="p-3">
                <h4 className="font-bold text-sm truncate">{t.name}</h4>
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Excluir"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
              <button
                onClick={() => openEdit(t)}
                className="absolute top-2 right-10 bg-blue-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Editar Texto"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-dark rounded-lg border dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 dark:bg-gray-800 font-bold border-b dark:border-gray-700">
              <tr>
                <th className="p-3 w-16">Preview</th>
                <th className="p-3">Nome do Modelo</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {templates.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="p-2">
                    {t.image_url ? (
                      <img src={`${API_BASE_URL}${t.image_url}`} alt={t.name} className="w-12 h-12 object-cover rounded border" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded border flex items-center justify-center text-gray-400">
                        <span className="material-symbols-outlined text-xl">article</span>
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-medium">{t.name}</td>
                  <td className="p-3 text-right space-x-2">
                    <button onClick={() => openEdit(t)} className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 p-2 rounded">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:text-red-800 font-bold text-xs bg-red-50 p-2 rounded">
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} title={selectedTemplate ? "Editar Modelo" : "Upload de Modelo"}>
        <div className="flex border-b mb-4">
          <button onClick={() => setActiveModalTab('frente')} className={`px-4 py-2 font-bold ${activeModalTab === 'frente' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>Frente (Certificado)</button>
          <button onClick={() => setActiveModalTab('verso')} className={`px-4 py-2 font-bold ${activeModalTab === 'verso' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}>Verso (Conteúdo)</button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">

          <div>
            <label className="block text-sm mb-1">Nome do Modelo</label>
            <input className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700" placeholder="Ex: NR-10 Completo" value={newName} onChange={e => setNewName(e.target.value)} required />
          </div>

          {activeModalTab === 'frente' && (
            <>
              {!selectedTemplate && (
                <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm mb-4">
                  <p>O modelo deve ser uma imagem (JPG/PNG) para o fundo da <strong>Frente</strong>.</p>
                  <p>Formato sugerido: A4 Paisagem (3508x2480px).</p>
                </div>
              )}

              {/* Standard Text Selector (Front) */}
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border mb-2">
                <label className="block text-xs font-bold text-gray-500 mb-1 flex justify-between">
                  Importar Padrão para Frente
                  <button type="button" onClick={() => setIsTextManagerOpen(true)} className="text-blue-600 underline">Gerenciar</button>
                </label>
                <select
                  className="w-full p-1 border rounded text-sm dark:bg-background-dark dark:border-gray-700"
                  onChange={(e) => {
                    const txt = standardTexts.find(t => t.id === Number(e.target.value));
                    if (txt) setBodyText(txt.content);
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Selecione...</option>
                  {standardTexts.map(st => <option key={st.id} value={st.id}>{st.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Texto da Frente <span className="text-xs text-gray-500">(Assinaturas, Data, etc)</span></label>
                <textarea
                  className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700 h-40 text-sm"
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                  required
                />
              </div>

              {!selectedTemplate && (
                <div>
                  <label className="block text-sm mb-1">Imagem de Fundo (Frente)</label>
                  <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} required={!selectedTemplate} className="w-full text-sm" />
                </div>
              )}
            </>
          )}

          {activeModalTab === 'verso' && (
            <>
              <div className="bg-yellow-50 text-yellow-800 p-3 rounded text-sm mb-4">
                <p>O Verso será a <strong>Página 2</strong> do PDF. Ideal para o Conteúdo Programático.</p>
              </div>

              {/* Standard Text Selector (Back) */}
              <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border mb-2">
                <label className="block text-xs font-bold text-gray-500 mb-1 flex justify-between">
                  Importar Padrão para Verso (NRs)
                  <button type="button" onClick={() => setIsTextManagerOpen(true)} className="text-blue-600 underline">Gerenciar</button>
                </label>
                <select
                  className="w-full p-1 border rounded text-sm dark:bg-background-dark dark:border-gray-700"
                  onChange={(e) => {
                    const txt = standardTexts.find(t => t.id === Number(e.target.value));
                    if (txt) setVersoText(txt.content);
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Selecione a NR...</option>
                  {standardTexts.map(st => <option key={st.id} value={st.id}>{st.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Conteúdo do Verso (Programático)</label>
                <textarea
                  className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700 h-96 text-sm font-mono"
                  value={versoText}
                  onChange={e => setVersoText(e.target.value)}
                  placeholder="Cole aqui o conteúdo da NR..."
                />
              </div>
            </>
          )}

          <button className="w-full bg-primary p-2 rounded font-bold">Salvar Modelo</button>
        </form>
      </Modal>

      {/* Text Manager Modal */}
      <Modal isOpen={isTextManagerOpen} onClose={() => { setIsTextManagerOpen(false); setEditingText(null); }} title="Gerenciar Biblioteca de Textos">
        <div className="space-y-6">

          {!editingText ? (
            <>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">upload_file</span>
                <p className="font-bold mb-1">Upload de Arquivos de Texto (.txt)</p>
                <p className="text-xs text-gray-500 mb-4">Arraste seus arquivos aqui ou clique para selecionar. O nome do arquivo será o título.</p>
                <input
                  type="file"
                  accept=".txt"
                  multiple
                  onChange={handleTextUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-black hover:file:bg-green-400"
                />
              </div>

              <div className="max-h-60 overflow-y-auto border rounded dark:border-gray-700">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 dark:bg-gray-800 font-bold sticky top-0">
                    <tr>
                      <th className="p-2">Norma / Título</th>
                      <th className="p-2">Conteúdo (Prévia)</th>
                      <th className="p-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {standardTexts.map(st => (
                      <tr key={st.id}>
                        <td className="p-2 font-medium">{st.title}</td>
                        <td className="p-2 text-gray-500 truncate max-w-xs">{st.content.substring(0, 50)}...</td>
                        <td className="p-2 text-right space-x-2">
                          <button onClick={() => startEditText(st)} className="text-blue-600 hover:underline text-xs font-bold">Editar</button>
                          <button onClick={() => handleDeleteText(st.id)} className="text-red-600 hover:underline text-xs">Excluir</button>
                        </td>
                      </tr>
                    ))}
                    {standardTexts.length === 0 && (
                      <tr><td colSpan={3} className="p-4 text-center text-gray-500">Nenhum texto cadastrado. Faça upload.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <form onSubmit={handleUpdateText} className="space-y-4">
              <div className="bg-blue-50 text-blue-800 p-2 rounded text-sm mb-2">
                Editando texto da norma.
              </div>
              <div>
                <label className="block text-sm mb-1">Título (Nome da Norma)</label>
                <input
                  className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                  value={editingTextTitle}
                  onChange={e => setEditingTextTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Conteúdo</label>
                <textarea
                  className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700 h-96 text-sm font-mono"
                  value={editingTextContent}
                  onChange={e => setEditingTextContent(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingText(null)} className="w-full bg-gray-200 p-2 rounded font-bold">Cancelar</button>
                <button type="submit" className="w-full bg-primary p-2 rounded font-bold">Salvar Alterações</button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
};

const TrainingsList: React.FC = () => {
  // Moved Trainings Logic here...
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [trainings, setTrainings] = useState<RealTraining[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]); // To select inside modal
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const [currentTraining, setCurrentTraining] = useState<Partial<RealTraining>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [generationMode, setGenerationMode] = useState<'auto' | 'manual'>('auto');

  // New State for Bulk & Pagination
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);


  // Fetch Companies
  useEffect(() => {
    authFetch(`${API_BASE_URL}/api/companies`)
      .then(res => res.json())
      .then(data => {
        setCompanies(data);
        if (data.length > 0) setSelectedCompanyId(data[0].id);
      })
      .catch(err => console.error('Error loading companies:', err));

    // Fetch Templates for selector
    authFetch(`${API_BASE_URL}/api/certificate-templates`)
      .then(res => res.json())
      .then(setTemplates);

  }, []);

  // Fetch Data when Company/Page Changes
  useEffect(() => {
    if (!selectedCompanyId) return;
    fetchTrainings();
  }, [selectedCompanyId, page, limit]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    fetchEmployees();
  }, [selectedCompanyId]);

  const fetchTrainings = async () => {
    const res = await authFetch(`${API_BASE_URL}/api/trainings?company_id=${selectedCompanyId}&page=${page}&limit=${limit}`);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) {
        setTrainings(json);
        setTotal(json.length);
      } else {
        setTrainings(json.data);
        setTotal(json.total);
      }
    }
  };

  const fetchEmployees = async () => {
    const res = await authFetch(`${API_BASE_URL}/api/employees?company_id=${selectedCompanyId}`);
    if (res.ok) setEmployees(await res.json());
  };

  const calculateStatus = (validity: string) => {
    const today = new Date();
    const valDate = new Date(validity);
    const diffTime = valDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Vencido';
    if (diffDays < 30) return 'Vencendo';
    return 'Válido';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    let certUrl = currentTraining.certificate_url;

    if (selectedFile) {
      const formData = new FormData();
      formData.append('certificate', selectedFile);
      const uploadRes = await fetch(`${API_BASE_URL}/api/trainings/upload`, {
        method: 'POST',
        body: formData
      });
      if (uploadRes.ok) {
        const data = await uploadRes.json();
        certUrl = data.url;
      }
    }

    // Recalculate status
    const computedStatus = currentTraining.validity_date ? calculateStatus(currentTraining.validity_date) : 'Válido';

    const payload = {
      ...currentTraining,
      employee_ids: isEditing ? undefined : selectedEmployeeIds,
      company_id: selectedCompanyId,
      certificate_url: certUrl,
      status: computedStatus
    };

    const url = isEditing
      ? `${API_BASE_URL}/api/trainings/${currentTraining.id}`
      : `${API_BASE_URL}/api/trainings`;

    const method = isEditing ? 'PUT' : 'POST';

    const token = localStorage.getItem('authToken');
    await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    setIsModalOpen(false);
    setSelectedEmployeeIds([]);
    fetchTrainings();
    setSelectedFile(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deseja excluir este treinamento?')) return;
    await fetch(`${API_BASE_URL}/api/trainings/${id}`, { method: 'DELETE' });
    fetchTrainings();
  };

  const openNew = () => {
    setCurrentTraining({});
    setIsEditing(false);
    setSelectedEmployeeIds([]);
    setIsModalOpen(true);
  };

  const handlePrintCertificate = (trainingId: number) => {
    const token = localStorage.getItem('authToken');
    if (!token || token === 'null') {
      alert('Sua sessão parece inválida. Por favor, faça login novamente.');
      return;
    }
    const url = `${API_BASE_URL}/api/trainings/${trainingId}/certificate?technician_name=${encodeURIComponent(localStorage.getItem('userName') || 'Responsável Técnico')}`;
    window.open(`${url}&token=${token}`, '_blank');
  };

  // Bulk Actions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Deseja excluir ${selectedIds.length} treinamentos selecionados?`)) return;

    await fetch(`${API_BASE_URL}/api/trainings/bulk-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify({ ids: selectedIds })
    });

    setSelectedIds([]);
    fetchTrainings();
  };

  const handleBulkPrint = async () => {
    setIsBulkPrinting(true);
    try {
      const token = localStorage.getItem('authToken');
      const techName = localStorage.getItem('userName') || 'Responsável Técnico';

      const res = await fetch(`${API_BASE_URL}/api/trainings/certificates/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedIds, technician_name: techName })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        setSelectedIds([]);
      } else {
        alert('Erro ao gerar certificados em massa.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro de conexão.');
    } finally {
      setIsBulkPrinting(false);
    }
  };

  const toggleEmployeeSelection = (employeeId: number) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const openEdit = (t: RealTraining) => {
    setCurrentTraining(t);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const filtered = trainings.filter(t => {
    const matchSearch = t.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.course_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchFilter = filterStatus === 'Todos' || t.status === filterStatus;
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Treinamentos Realizados</h2>
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
            onClick={openNew}
            className="flex items-center justify-center rounded-lg h-10 px-4 bg-primary text-black font-bold shadow-md"
          >
            <span className="material-symbols-outlined mr-2">add</span>
            Novo Treinamento
          </button>
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex gap-4">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-dark"
            placeholder="Buscar funcionário ou curso..."
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 px-3 rounded-lg bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700"
          >
            <option value="Todos">Todos</option>
            <option value="Válido">Válido</option>
            <option value="Vencendo">Vencendo</option>
            <option value="Vencido">Vencido</option>
          </select>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-2 px-4 border-b border-blue-100 dark:border-blue-800 flex items-center justify-between text-sm">
            <span className="font-bold text-blue-800 dark:text-blue-300">{selectedIds.length} selecionado(s)</span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkPrint}
                disabled={isBulkPrinting}
                className="flex items-center gap-1 bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-600 px-3 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                {isBulkPrinting ? 'Gerando...' : 'Imprimir'}
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1 bg-white dark:bg-surface-dark border border-red-200 dark:border-red-900 text-red-600 px-3 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                Excluir
              </button>
            </div>
          </div>
        )}

        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="p-4 w-10">
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                />
              </th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Funcionário</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Curso</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500 text-center">Status</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Validade</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map(t => (
              <tr key={t.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selectedIds.includes(t.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(t.id)}
                    onChange={() => handleSelectRow(t.id)}
                  />
                </td>
                <td className="p-4">
                  <p className="font-bold">{t.employee_name}</p>
                  <p className="text-xs text-gray-500">{t.employee_role}</p>
                </td>
                <td className="p-4">{t.course_name}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${t.status === 'Válido' ? 'bg-green-100 text-green-700' :
                    t.status === 'Vencendo' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                    {t.status}
                  </span>
                </td>
                <td className="p-4">{new Date(t.validity_date).toLocaleDateString()}</td>
                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => handlePrintCertificate(t.id)}
                    className="text-primary hover:text-blue-700 font-medium text-sm mr-2"
                    title="Imprimir Certificado"
                  >
                    <span className="material-symbols-outlined text-lg">print</span>
                  </button>
                  {t.certificate_url && (
                    <a href={`${API_BASE_URL}${t.certificate_url}`} target="_blank" className="text-blue-600 hover:underline text-sm mr-2">Ver Anexo</a>
                  )}
                  <button onClick={() => openEdit(t)} className="text-gray-500 hover:text-blue-600"><span className="material-symbols-outlined">edit</span></button>
                  <button onClick={() => handleDelete(t.id)} className="text-gray-500 hover:text-red-600"><span className="material-symbols-outlined">delete</span></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
          <div className="text-sm text-gray-500">
            Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, total)} de {total} registros
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 border rounded bg-white dark:bg-surface-dark disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm font-bold px-2">Página {page}</span>
            <button
              disabled={page * limit >= total}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 border rounded bg-white dark:bg-surface-dark disabled:opacity-50"
            >
              Próximo
            </button>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? "Editar Treinamento" : "Novo Treinamento"}>
        <form onSubmit={handleSave} className="space-y-4">

          {/* Mode Selection */}
          <div className="flex gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="genMode" checked={generationMode === 'auto'} onChange={() => setGenerationMode('auto')} className="text-primary" />
              <span className="text-sm font-bold">Gerar Certificado (Automático)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="genMode" checked={generationMode === 'manual'} onChange={() => setGenerationMode('manual')} className="text-primary" />
              <span className="text-sm font-bold">Upload de Arquivo (Já pronto)</span>
            </label>
          </div>

          {generationMode === 'auto' && (
            <div className="border-l-4 border-primary pl-3 py-1 bg-surface-light dark:bg-surface-dark">
              <label className="block text-sm mb-1 font-bold text-primary">Modelo de Certificado (Fundo)</label>
              <select className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                value={currentTraining.template_id || ''}
                onChange={e => setCurrentTraining({ ...currentTraining, template_id: Number(e.target.value) || undefined })}
              >
                <option value="">Padrão (Fundo Branco)</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">O sistema irá preencher os dados (Nome, CPF) sobre este fundo.</p>
            </div>
          )}

          {generationMode === 'manual' && (
            <div className={`mt-4 rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${selectedFile ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-700 hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}>
              <label className="cursor-pointer w-full h-full block">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center gap-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedFile ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                    <span className="material-symbols-outlined text-2xl">
                      {selectedFile ? 'check' : 'cloud_upload'}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {selectedFile ? selectedFile.name : 'Clique para selecionar o certificado/imagem'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Clique para alterar` : 'PDF, JPG ou PNG (Max 10MB)'}
                    </p>
                  </div>
                </div>
              </label>
            </div>
          )}


          {/* Company Warining */}
          {(!currentTraining.company_id && !isEditing) && (
            <div className="bg-yellow-50 text-yellow-800 p-2 rounded text-sm border border-yellow-200 flex items-center">
              <span className="material-symbols-outlined mr-2 text-lg">warning</span>
              Selecione uma empresa na tela anterior para carregar os colaboradores.
            </div>
          )}

          {isEditing ? (
            <div>
              <label className="block text-sm mb-1">Colaborador</label>

              <select
                required
                className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                value={currentTraining.employee_id || ''}
                onChange={e => setCurrentTraining({ ...currentTraining, employee_id: Number(e.target.value) })}
              >
                <option value="">Selecione...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm mb-2 font-medium">Colaboradores (selecione um ou mais)</label>
              <div className="max-h-40 overflow-y-auto border rounded p-2 dark:bg-background-dark dark:border-gray-700">
                {employees.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhum colaborador encontrado</p>
                ) : (
                  employees.map(e => (
                    <label key={e.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(e.id)}
                        onChange={() => toggleEmployeeSelection(e.id)}
                        className="mr-3 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm">{e.name} {e.role && `- ${e.role}`}</span>
                    </label>
                  ))
                )}
              </div>
              {selectedEmployeeIds.length > 0 && (
                <p className="text-xs text-primary mt-1">{selectedEmployeeIds.length} colaborador(es) selecionado(s)</p>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm mb-1">Curso / Norma</label>
            <input
              required
              type="text"
              className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
              placeholder="Ex: NR-10 Básico"
              value={currentTraining.course_name || ''}
              onChange={e => setCurrentTraining({ ...currentTraining, course_name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Data Treinamento</label>
              <input
                required
                type="date"
                className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                value={currentTraining.training_date ? currentTraining.training_date.split('T')[0] : ''}
                onChange={e => setCurrentTraining({ ...currentTraining, training_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Data Validade</label>
              <input
                required
                type="date"
                className="w-full p-2 border rounded dark:bg-background-dark dark:border-gray-700"
                value={currentTraining.validity_date ? currentTraining.validity_date.split('T')[0] : ''}
                onChange={e => setCurrentTraining({ ...currentTraining, validity_date: e.target.value })}
              />
            </div>
          </div>
          {/* Legacy Input Removed - Using unified manual mode upload above */}
          <button className="w-full bg-primary p-2 rounded font-bold">Salvar</button>
        </form>
      </Modal>
    </div>
  );
};

export const Trainings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'trainings' | 'templates'>('trainings');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Gestão de Treinamentos</h1>
          <p className="text-gray-500 dark:text-gray-400">Controle de certificações, modelos e vencimentos.</p>
        </div>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab('trainings')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'trainings' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Treinamentos Realizados
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${activeTab === 'templates' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Modelos de Certificado
        </button>
      </div>

      <div className="pt-4">
        {activeTab === 'trainings' && <TrainingsList />}
        {activeTab === 'templates' && <TemplatesTab />}
      </div>
    </div>
  );
};