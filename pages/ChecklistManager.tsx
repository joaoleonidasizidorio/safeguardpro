import React, { useState, useEffect } from 'react';
import { ChecklistTemplate, ChecklistItem } from '../types';
import { API_BASE_URL } from '../config';

export const ChecklistManager: React.FC = () => {
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
    const [newItemQuestion, setNewItemQuestion] = useState('');
    const [newItemCategory, setNewItemCategory] = useState('');

    // Form Stats
    const [formData, setFormData] = useState({ name: '', description: '' });

    // Auth info
    const userId = localStorage.getItem('safeguard_user_id');
    const userRole = localStorage.getItem('safeguard_user_type');
    const isMaster = userRole === 'admin' && ['leonidas.joao@gmail.com', 'admin@safeguardpro.com'].includes(localStorage.getItem('safeguard_user_email') || '');


    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/checklist-templates`);
            const data = await res.json();
            setTemplates(data);
        } catch (error) {
            console.error('Error fetching templates:', error);
        }
    };

    const handleSaveTemplate = async () => {
        try {
            const method = editingTemplate ? 'PUT' : 'POST';
            const url = editingTemplate
                ? `${API_BASE_URL}/api/checklist-templates/${editingTemplate.id}`
                : `${API_BASE_URL}/api/checklist-templates`;

            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            setIsModalOpen(false);
            setEditingTemplate(null);
            setFormData({ name: '', description: '' });
            fetchTemplates();
        } catch (error) {
            console.error('Error saving template:', error);
        }
    };

    const handleDeleteTemplate = async (id: number) => {
        if (!confirm('Tem certeza? Isso excluirá todas as inspeções vinculadas a este modelo.')) return;
        try {
            await fetch(`${API_BASE_URL}/api/checklist-templates/${id}`, { method: 'DELETE' });
            fetchTemplates();
        } catch (error) {
            console.error('Error deleting template:', error);
        }
    };

    const handleAddItem = async (templateId: number) => {
        if (!newItemQuestion) return;
        try {
            await fetch(`${API_BASE_URL}/api/checklist-items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template_id: templateId,
                    question: newItemQuestion,
                    category: newItemCategory || 'Geral'
                })
            });
            setNewItemQuestion('');
            setNewItemCategory('');
            fetchTemplates(); // Refresh to show new item
        } catch (error) {
            console.error('Error adding item:', error);
        }
    };

    const handleDeleteItem = async (itemId: number) => {
        try {
            await fetch(`${API_BASE_URL}/api/checklist-items/${itemId}`, { method: 'DELETE' });
            fetchTemplates();
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Gerenciamento de NRs</h1>
                    <p className="text-gray-500">Crie e personalize seus modelos de checklist.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingTemplate(null);
                        setFormData({ name: '', description: '' });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-primary hover:bg-green-400 text-black font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    <span className="material-symbols-outlined">add</span>
                    Nova NR / Checklist
                </button>
            </div>

            <div className="grid gap-6">
                {templates.map(template => (
                    <div key={template.id} className="bg-white dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{template.name}</h3>
                                <p className="text-sm text-gray-500">{template.description}</p>
                            </div>
                            <div className="flex gap-2">
                                {(isMaster || template.owner_id === userId) && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setEditingTemplate(template);
                                                setFormData({ name: template.name, description: template.description || '' });
                                                setIsModalOpen(true);
                                            }}
                                            className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                                        >
                                            <span className="material-symbols-outlined">edit</span>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTemplate(template.id)}
                                            className="p-2 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Items List */}
                        <div className="space-y-2 mb-4">
                            {template.items?.map(item => (
                                <div key={item.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-background-dark rounded border border-gray-100 dark:border-gray-700">
                                    <span className="text-gray-700 dark:text-gray-300">
                                        <span className="font-bold text-xs text-primary uppercase mr-2">[{item.category}]</span>
                                        {item.question}
                                    </span>
                                    {(isMaster || template.owner_id === userId) && (
                                        <button
                                            onClick={() => handleDeleteItem(item.id)}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add Item Form (Only for owners) */}
                        {(isMaster || template.owner_id === userId) && (
                            <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <input
                                    type="text"
                                    placeholder="Pergunta / Item de Verificação"
                                    className="flex-1 bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
                                    value={newItemQuestion}
                                    onChange={e => setNewItemQuestion(e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="Categoria (ex: EPI)"
                                    className="w-32 bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm"
                                    value={newItemCategory}
                                    onChange={e => setNewItemCategory(e.target.value)}
                                />
                                <button
                                    onClick={() => handleAddItem(template.id)}
                                    className="bg-gray-200 dark:bg-gray-700 hover:bg-primary hover:text-black text-gray-600 dark:text-white rounded-lg px-3 py-1"
                                >
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-surface-dark rounded-2xl w-full max-w-md p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                            {editingTemplate ? 'Editar NR / Checklist' : 'Nova NR / Checklist'}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
                                <input
                                    type="text"
                                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-background-dark p-2"
                                    placeholder="Ex: NR-33 - Espaço Confinado"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                                <textarea
                                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-background-dark p-2"
                                    rows={3}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                ></textarea>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveTemplate}
                                    className="px-4 py-2 rounded-lg bg-primary text-black font-bold hover:bg-green-400"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
