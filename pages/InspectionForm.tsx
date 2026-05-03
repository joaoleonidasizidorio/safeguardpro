import React, { useState, useEffect } from 'react';
import { ChecklistItem, ChecklistTemplate, Inspection, InspectionAnswer, View } from '../types';
import { SignaturePad } from '../components/SignaturePad';
import { saveOfflineInspection } from '../utils/offlineSync';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

interface InspectionFormProps {
    inspectionId: number;
    onBack: () => void;
}

export const InspectionForm: React.FC<InspectionFormProps> = ({ inspectionId, onBack }) => {
    const [inspection, setInspection] = useState<Inspection | null>(null);
    const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
    const [answers, setAnswers] = useState<InspectionAnswer[]>([]);
    const [sectors, setSectors] = useState<{ id: number, name: string }[]>([]); // New state for sectors
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [inspectionId]);

    const fetchData = async () => {
        try {
            // Fetch Inspection
            const insRes = await authFetch(`${API_BASE_URL}/api/inspections/${inspectionId}`);
            const insData = await insRes.json();

            // Map DB fields to Frontend types
            const mappedIns: Inspection = {
                ...insData,
                company_id: insData.company_id,
                sector_id: insData.sector_id,
                template_id: insData.template_id,
                auditor_id: insData.auditor_id,
                technician_signature: insData.technician_signature,
                client_signature: insData.client_signature,
                companyName: insData.company_name, // Joined
                sectorName: insData.sector_name, // Joined
                templateName: insData.template_name, // Joined
                // Keep snake_case for consistency with type definition updates
                company_name: insData.company_name,
                sector_name: insData.sector_name,
                template_name: insData.template_name,
                answers: insData.answers?.map((a: any) => ({
                    ...a,
                    item_id: a.item_id,
                    photo_url: a.photo_url,
                    photo_after_url: a.photo_after_url,
                    photo_date: a.photo_date,
                    photo_lat: a.photo_lat,
                    photo_lon: a.photo_lon
                })) || []
            };
            setInspection(mappedIns);

            // Fetch Template Items
            const tmplRes = await authFetch(`${API_BASE_URL}/api/checklist-templates`);
            const tmplData = await tmplRes.json();

            // Loose comparison to handle potential string/number mismatch
            const tmpl = tmplData.find((t: any) => String(t.id) === String(mappedIns.template_id));

            if (tmpl) {
                setTemplate(tmpl);
            } else {
                console.error("Template not found. Looking for:", mappedIns.template_id, "Available:", tmplData.map((t: any) => t.id));
                setError(`Template de checklist não encontrado (ID: ${mappedIns.template_id})`);
            }

            // Fetch Sectors
            if (mappedIns.company_id) {
                try {
                    const secRes = await authFetch(`${API_BASE_URL}/api/sectors?company_id=${mappedIns.company_id}`);
                    if (secRes.ok) {
                        const secData = await secRes.json();
                        setSectors(secData);
                    }
                } catch (e) {
                    console.error("Error fetching sectors", e);
                }
            }



            // Initialize answers if empty
            if (mappedIns.answers && mappedIns.answers.length > 0) {
                setAnswers(mappedIns.answers);
            } else if (tmpl && tmpl.items) {
                const initAnswers = tmpl.items.map((item: any) => ({
                    item_id: item.id,
                    status: 'NA' as const, // Default
                    observation: ''
                }));
                setAnswers(initAnswers);
            }

        } catch (error) {
            console.error('Error loading inspection:', error);
        } finally {
            setIsLoading(false);
        }
    };



    // ... imports

    // Helper: Compress Image to prevent localStorage quota exceeded
    const compressImage = (base64Str: string, maxWidth = 800, quality = 0.6): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
        });
    };

    const handleAnswerChange = async (itemId: number, field: keyof InspectionAnswer, value: any) => {
        let finalValue = value;

        // Compress if it's an image and adding (not removing)
        if ((field === 'photo_url' || field === 'photo_after_url') && typeof value === 'string' && value.startsWith('data:image')) {
            try {
                finalValue = await compressImage(value);
            } catch (e) {
                console.error("Compression failed, using original", e);
            }
        }

        setAnswers(prev => {
            const exists = prev.find(a => a.item_id === itemId);
            if (exists) {
                return prev.map(a => a.item_id === itemId ? { ...a, [field]: finalValue } : a);
            } else {
                return [...prev, { item_id: itemId, status: 'NA', observation: '', [field]: finalValue } as InspectionAnswer];
            }
        });
    };

    const handleSave = async (activityStatus: 'Em Andamento' | 'Concluído') => {
        if (!inspection) return;

        const body = {
            status: activityStatus,
            technician_signature: inspection.technician_signature,
            client_signature: inspection.client_signature,
            latitude: inspection.latitude,
            longitude: inspection.longitude,
            answers: answers
        };

        // Offline Mode Check
        if (!navigator.onLine) {
            const saved = saveOfflineInspection(inspection.id, body);
            if (saved) {
                alert('Sem conexão: Inspeção salva LOCALMENTE. Será sincronizada quando houver internet.');
                if (activityStatus === 'Concluído') onBack();
            } else {
                alert('Erro ao salvar localmente (Provavelmente armazenamento cheio). Tente reduzir o número de fotos.');
            }
            return;
        }

        try {
            const response = await authFetch(`${API_BASE_URL}/api/inspections/${inspection.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Erro ao salvar');
            }

            alert('Inspeção salva com sucesso!');
            if (activityStatus === 'Concluído') {
                onBack();
            }
        } catch (error: any) {
            console.error('Error saving:', error);
            // Fallback to offline if fetch fails (e.g. timeout)
            const saved = saveOfflineInspection(inspection.id, body);
            if (saved) {
                alert('Erro de conexão/API: Salvo LOCALMENTE para sincronização posterior.');
                if (activityStatus === 'Concluído') onBack();
            } else {
                alert(`Erro ao salvar: ${error.message || error}`);
            }
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Carregando formulário...</div>;
    if (error) return <div className="p-8 text-center text-red-500 font-bold">{error}</div>;
    if (!inspection || !template) return <div className="p-8 text-center text-red-500">Erro: Dados da inspeção inválidos.</div>;

    // Group items by category
    const itemsByCategory: { [key: string]: ChecklistItem[] } = {};
    if (template.items) {
        template.items.forEach(item => {
            const cat = item.category || 'Geral';
            if (!itemsByCategory[cat]) itemsByCategory[cat] = [];
            itemsByCategory[cat].push(item);
        });
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{template.name}</span>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Inspeção em {inspection.companyName}</h1>
                    <div className="flex gap-4 text-sm text-gray-500 items-center mt-1">
                        <span>{new Date(inspection.date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Auditor: {inspection.auditor_id}</span>
                        <span>•</span>
                        <select
                            className="bg-transparent border-b border-gray-300 focus:border-primary outline-none"
                            value={inspection.sector_id || ''}
                            onChange={(e) => setInspection({ ...inspection, sector_id: Number(e.target.value) })}
                        >
                            <option value="">Selecionar Setor...</option>
                            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="ml-auto flex gap-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${inspection.status === 'Concluído' ? 'bg-green-100 text-green-700' :
                        'bg-amber-100 text-amber-700'
                        }`}>
                        {inspection.status}
                    </div>
                </div>
            </div>

            {/* Checklist */}
            <div className="grid gap-8">
                {Object.keys(itemsByCategory).map(category => (
                    <div key={category} className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <h3 className="text-lg font-bold text-primary mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">{category}</h3>
                        <div className="space-y-6">
                            {itemsByCategory[category].map(item => {
                                const answer = answers.find(a => a.item_id === item.id) || { status: 'NA', observation: '' };
                                return (
                                    <div key={item.id} className="grid md:grid-cols-[1fr_auto] gap-4">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white mb-2">{item.question}</p>
                                            <textarea
                                                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-background-dark p-2 focus:ring-1 focus:ring-primary"
                                                placeholder="Observações..."
                                                rows={2}
                                                value={answer.observation}
                                                onChange={e => handleAnswerChange(item.id, 'observation', e.target.value)}
                                            ></textarea>
                                            <div className="mt-2 flex gap-4">
                                                {/* Before Photo */}
                                                <div>
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Evidência (Foto/Vídeo)</span>
                                                    {('photo_url' in answer && answer.photo_url) ? (
                                                        <div className="relative inline-block group">
                                                            {String(answer.photo_url).startsWith('data:video') || String(answer.photo_url).endsWith('.mp4') ? (
                                                                <video src={String(answer.photo_url)} className="h-20 w-20 object-cover rounded-lg border border-gray-200" controls />
                                                            ) : (
                                                                <img src={String(answer.photo_url)} alt="Evidência" className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                                                            )}
                                                            <button
                                                                onClick={() => handleAnswerChange(item.id, 'photo_url', undefined)}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                                            </button>
                                                            {('photo_date' in answer && answer.photo_date) && <div className="text-[9px] text-gray-500 mt-1">{new Date(String(answer.photo_date)).toLocaleString()}</div>}
                                                        </div>
                                                    ) : (
                                                        <label className="text-xs text-gray-500 hover:text-primary cursor-pointer flex flex-col items-center justify-center h-20 w-20 border-2 border-dashed border-gray-200 hover:border-primary rounded-lg transition-colors">
                                                            <span className="material-symbols-outlined text-xl mb-1">add_a_photo</span>
                                                            <span className="text-[10px]">Foto/Vídeo</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*,video/*"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                        navigator.geolocation.getCurrentPosition((pos) => {
                                                                            handleAnswerChange(item.id, 'photo_lat', pos.coords.latitude);
                                                                            handleAnswerChange(item.id, 'photo_lon', pos.coords.longitude);
                                                                        });
                                                                        handleAnswerChange(item.id, 'photo_date', new Date().toISOString());

                                                                        const reader = new FileReader();
                                                                        reader.onloadend = () => {
                                                                            handleAnswerChange(item.id, 'photo_url', reader.result as string);
                                                                        };
                                                                        reader.readAsDataURL(file);
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                    )}
                                                </div>

                                                {/* After Photo */}
                                                <div>
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Correção (Depois)</span>
                                                    {('photo_after_url' in answer && answer.photo_after_url) ? (
                                                        <div className="relative inline-block">
                                                            {String(answer.photo_after_url).startsWith('data:video') || String(answer.photo_after_url).endsWith('.mp4') ? (
                                                                <video src={String(answer.photo_after_url)} className="h-20 w-20 object-cover rounded-lg border border-gray-200" controls />
                                                            ) : (
                                                                <img src={String(answer.photo_after_url)} alt="Correção" className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                                                            )}
                                                            <button
                                                                onClick={() => handleAnswerChange(item.id, 'photo_after_url', undefined)}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <label className="text-xs text-gray-500 hover:text-green-500 cursor-pointer flex flex-col items-center justify-center h-20 w-20 border-2 border-dashed border-gray-200 hover:border-green-500 rounded-lg transition-colors">
                                                            <span className="material-symbols-outlined text-xl mb-1">add_photo_alternate</span>
                                                            <span className="text-[10px]">Corrigido</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*,video/*"
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                        const reader = new FileReader();
                                                                        reader.onloadend = () => {
                                                                            handleAnswerChange(item.id, 'photo_after_url', reader.result as string);
                                                                        };
                                                                        reader.readAsDataURL(file);
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 min-w-[120px]">
                                            <button
                                                onClick={() => handleAnswerChange(item.id, 'status', 'C')}
                                                className={`px-3 py-2 rounded-lg text-sm font-bold border ${answer.status === 'C' ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50'}`}
                                            >Conforme</button>
                                            <button
                                                onClick={() => handleAnswerChange(item.id, 'status', 'NC')}
                                                className={`px-3 py-2 rounded-lg text-sm font-bold border ${answer.status === 'NC' ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50'}`}
                                            >Não Conforme</button>
                                            <button
                                                onClick={() => handleAnswerChange(item.id, 'status', 'NA')}
                                                className={`px-3 py-2 rounded-lg text-sm font-bold border ${answer.status === 'NA' ? 'bg-gray-400 text-white border-gray-400' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50'}`}
                                            >N/A</button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Legal Text */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 mb-8 max-w-4xl mx-auto">
                <h4 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">verified_user</span>
                    Declaração de Ciência e Aceite
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 text-justify leading-relaxed">
                    Declaro, para os devidos fins, que acompanhei a inspeção de segurança realizada e estou ciente dos apontamentos técnicos, irregularidades e medidas corretivas descritas neste relatório. Recebo, neste ato, cópia digital do presente documento, comprometendo-me a tomar as providências cabíveis para a regularização dos itens não conformes, ciente das implicações legais em caso de omissão ou negligência. A assinatura abaixo confirma a veracidade das informações e o recebimento deste laudo.
                </p>
                {inspection.status === 'Concluído' && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined">lock</span>
                        Este relatório foi concluído e assinado digitalmente. Não é possível realizar alterações.
                    </div>
                )}
            </div>

            {/* Signatures */}
            <div className={`grid md:grid-cols-2 gap-6 pb-20 max-w-4xl mx-auto ${inspection.status === 'Concluído' ? 'pointer-events-none opacity-80' : ''}`}>
                <SignaturePad
                    label="Assinatura do Técnico (Auditor)"
                    onSave={(sig) => setInspection({ ...inspection, technician_signature: sig })}
                    onClear={() => setInspection({ ...inspection, technician_signature: undefined })}
                    initialSignature={inspection.technician_signature}
                />
                <SignaturePad
                    label="Assinatura do Cliente / Responsável"
                    onSave={(sig) => setInspection({ ...inspection, client_signature: sig })}
                    onClear={() => setInspection({ ...inspection, client_signature: undefined })}
                    initialSignature={inspection.client_signature}
                />
            </div>

            {/* Visual confirmation of saved signatures */}
            <div className="flex gap-4 max-w-4xl mx-auto mb-20">
                {inspection.technician_signature && <div className="text-xs text-green-600 font-bold flex items-center gap-1"><span className="material-symbols-outlined text-sm">check_circle</span> Assinatura Técnico Salva</div>}
                {inspection.client_signature && <div className="text-xs text-green-600 font-bold flex items-center gap-1"><span className="material-symbols-outlined text-sm">check_circle</span> Assinatura Cliente Salva</div>}
            </div>

            {/* Footer containing Save buttons - Hide if Completed */}
            {inspection.status !== 'Concluído' && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 shadow-lg flex justify-end gap-4 z-40">
                    <button
                        onClick={() => handleSave('Em Andamento')}
                        className="px-6 py-2 rounded-lg font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-white transition-colors"
                        disabled={isLoading}
                    >
                        Salvar Rascunho
                    </button>
                    <button
                        onClick={() => handleSave('Concluído')}
                        className="px-6 py-2 rounded-lg font-bold text-black bg-primary hover:bg-green-400 transition-colors shadow-lg shadow-green-500/20"
                        disabled={isLoading || !inspection.technician_signature} // Require technician signature to complete
                        title={!inspection.technician_signature ? "Assinatura do técnico obrigatória para finalizar" : ""}
                    >
                        {isLoading ? 'Salvando...' : 'Finalizar Inspeção'}
                    </button>
                </div>
            )}
        </div>
    );
};
