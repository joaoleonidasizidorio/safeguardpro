
import { Inspection, InspectionAnswer } from '../types';

const OFFLINE_STORAGE_KEY_PREFIX = 'offline_inspection_';

interface OfflineInspectionPayload {
    id: number;
    status: 'Em Andamento' | 'Concluído';
    technician_signature?: string;
    client_signature?: string;
    latitude?: number;
    longitude?: number;
    answers: InspectionAnswer[];
    timestamp: number;
}

export const saveOfflineInspection = (
    inspectionId: number,
    data: Omit<OfflineInspectionPayload, 'id' | 'timestamp'>
) => {
    try {
        const payload: OfflineInspectionPayload = {
            id: inspectionId,
            timestamp: Date.now(),
            ...data
        };
        localStorage.setItem(`${OFFLINE_STORAGE_KEY_PREFIX}${inspectionId}`, JSON.stringify(payload));
        console.log(`Inspection ${inspectionId} saved offline.`);
        return true;
    } catch (e) {
        console.error('Failed to save offline inspection (Quota exceeded?)', e);
        return false;
    }
};

export const getOfflineInspections = (): OfflineInspectionPayload[] => {
    const items: OfflineInspectionPayload[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(OFFLINE_STORAGE_KEY_PREFIX)) {
            try {
                const val = localStorage.getItem(key);
                if (val) items.push(JSON.parse(val));
            } catch (e) {
                console.error('Error parsing offline item', key, e);
            }
        }
    }
    return items.sort((a, b) => b.timestamp - a.timestamp);
};

export const clearOfflineInspection = (inspectionId: number) => {
    localStorage.removeItem(`${OFFLINE_STORAGE_KEY_PREFIX}${inspectionId}`);
};

export const syncInspection = async (item: OfflineInspectionPayload, apiUrl: string): Promise<boolean> => {
    try {
        const body = {
            status: item.status,
            technician_signature: item.technician_signature,
            client_signature: item.client_signature,
            latitude: item.latitude,
            longitude: item.longitude,
            answers: item.answers
        };

        const response = await fetch(`${apiUrl}/api/inspections/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            clearOfflineInspection(item.id);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Sync failed for', item.id, error);
        return false;
    }
};
