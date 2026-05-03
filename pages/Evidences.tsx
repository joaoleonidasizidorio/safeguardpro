import React, { useState, useEffect } from 'react';
import { Inspection, InspectionAnswer } from '../types';
import { authFetch } from '../utils/api';
import { API_BASE_URL } from '../config';

interface EvidenceItem {
    id: number;
    inspectionId: number;
    companyName: string;
    sectorName: string;
    date: string;
    itemName: string;
    category: string;
    photoUrl: string;
    photoAfterUrl?: string;
    photoDate?: string;
    photoLat?: number;
    photoLon?: number;
    observation?: string;
}

export const Evidences: React.FC = () => {
    const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
    const [filterCompany, setFilterCompany] = useState('');
    const [filterSector, setFilterSector] = useState('');
    const [filterNR, setFilterNR] = useState(''); // New NR Filter
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchEvidences();
    }, []);

    const fetchEvidences = async () => {
        try {
            // First get all templates to map item IDs to names
            const tmplRes = await authFetch(`${API_BASE_URL}/api/checklist-templates`);
            const templates = tmplRes.ok ? await tmplRes.json() : [];
            const itemsMap: Record<number, any> = {};
            if (Array.isArray(templates)) {
                templates.forEach((t: any) => {
                    t.items?.forEach((i: any) => {
                        itemsMap[i.id] = i;
                    });
                });
            }

            // Get all inspections
            const insRes = await authFetch(`${API_BASE_URL}/api/inspections`);
            const inspections: Inspection[] = insRes.ok ? await insRes.json() : [];

            if (!Array.isArray(inspections)) throw new Error("Invalid inspections data");

            // Flatten inspections into evidence items
            const allEvidences: EvidenceItem[] = [];

            inspections.forEach(ins => {
                ins.answers?.forEach(ans => {
                    if (ans.photo_url || ans.photo_after_url) {
                        const item = itemsMap[ans.item_id];
                        allEvidences.push({
                            id: ans.id || Math.random(),
                            inspectionId: ins.id,
                            companyName: ins.company_name ?? 'N/A',
                            sectorName: ins.sector_name ?? 'Geral',
                            date: ins.date,
                            itemName: item?.question || 'Item Desconhecido',
                            category: item?.category || 'Geral',
                            photoUrl: ans.photo_url || '',
                            photoAfterUrl: ans.photo_after_url,
                            photoDate: ans.photo_date,
                            photoLat: ans.photo_lat,
                            photoLon: ans.photo_lon,
                            observation: ans.observation
                        });
                    }
                });
            });

            setEvidences(allEvidences.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredEvidences = evidences.filter(ev => {
        const matchCompany = filterCompany ? ev.companyName.toLowerCase().includes(filterCompany.toLowerCase()) : true;
        const matchSector = filterSector ? ev.sectorName.toLowerCase().includes(filterSector.toLowerCase()) : true;
        const matchNR = filterNR ? ev.itemName.toLowerCase().includes(filterNR.toLowerCase()) || ev.category.toLowerCase().includes(filterNR.toLowerCase()) : true; // Rough NR filter
        return matchCompany && matchSector && matchNR;
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Galeria de Evidências</h1>
                    <p className="text-gray-500">Registro fotográfico completo de todas as inspeções.</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex gap-4">
                <input
                    type="text"
                    placeholder="Filtrar por Empresa..."
                    className="flex-1 bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
                    value={filterCompany}
                    onChange={e => setFilterCompany(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Filtrar por Setor..."
                    className="flex-1 bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
                    value={filterSector}
                    onChange={e => setFilterSector(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Filtrar por NR ou Item..."
                    className="flex-1 bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
                    value={filterNR}
                    onChange={e => setFilterNR(e.target.value)}
                />
            </div>

            {/* Gallery Grid */}
            {isLoading ? (
                <div className="text-center py-10 text-gray-500">Carregando evidências...</div>
            ) : filteredEvidences.length === 0 ? (
                <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    Nenhuma evidência encontrada.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvidences.map(ev => (
                        <div key={ev.id} className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden group">
                            <div className="grid grid-cols-2 h-48">
                                <div className="relative border-r border-white/20">
                                    <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded font-bold uppercase backdrop-blur-sm z-10">Antes</span>
                                    {ev.photoUrl ? (
                                        ev.photoUrl.startsWith('data:video') || ev.photoUrl.endsWith('.mp4') ? (
                                            <video src={ev.photoUrl} className="w-full h-full object-cover" controls />
                                        ) : (
                                            <img src={ev.photoUrl} alt="Antes" className="w-full h-full object-cover" />
                                        )
                                    ) : (
                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">Sem foto</div>
                                    )}
                                </div>
                                <div className="relative bg-gray-50">
                                    <span className="absolute top-2 left-2 bg-green-500/80 text-white text-[10px] px-2 py-1 rounded font-bold uppercase backdrop-blur-sm z-10">Depois</span>
                                    {ev.photoAfterUrl ? (
                                        ev.photoAfterUrl.startsWith('data:video') || ev.photoAfterUrl.endsWith('.mp4') ? (
                                            <video src={ev.photoAfterUrl} className="w-full h-full object-cover" controls />
                                        ) : (
                                            <img src={ev.photoAfterUrl} alt="Depois" className="w-full h-full object-cover" />
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center p-2">
                                            Aguardando<br />Correção
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4">
                                <div className="flex gap-2 mb-2">
                                    <span className="bg-primary/10 text-green-700 dark:text-primary text-[10px] uppercase font-bold px-2 py-0.5 rounded">{ev.category}</span>
                                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[10px]">domain</span> {ev.companyName}
                                    </span>
                                </div>

                                <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1 line-clamp-2">{ev.itemName}</h4>
                                {ev.observation && <p className="text-xs text-gray-500 mb-2 italic">"{ev.observation}"</p>}

                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                        <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                        {new Date(ev.date).toLocaleDateString()}
                                    </div>
                                    {ev.photoLat && (
                                        <a
                                            href={`https://maps.google.com/?q=${ev.photoLat},${ev.photoLon}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-[10px] text-blue-500 hover:underline"
                                        >
                                            <span className="material-symbols-outlined text-[12px]">location_on</span>
                                            Ver Mapa
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
