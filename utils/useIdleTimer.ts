import { useEffect, useRef, useCallback } from 'react';

interface UseIdleTimerOptions {
    timeout: number; // tempo em milissegundos
    onIdle: () => void;
    enabled?: boolean;
}

/**
 * Hook para detectar inatividade do usuário
 * Monitora: mousemove, keydown, click, scroll, touchstart
 * Após o timeout de inatividade, chama a função onIdle
 */
export const useIdleTimer = ({ timeout, onIdle, enabled = true }: UseIdleTimerOptions) => {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastActivityRef = useRef<number>(Date.now());

    const resetTimer = useCallback(() => {
        lastActivityRef.current = Date.now();

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        if (enabled) {
            timerRef.current = setTimeout(() => {
                onIdle();
            }, timeout);
        }
    }, [timeout, onIdle, enabled]);

    useEffect(() => {
        if (!enabled) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            return;
        }

        // Eventos que contam como atividade
        const events = [
            'mousemove',
            'mousedown',
            'keydown',
            'click',
            'scroll',
            'touchstart',
            'touchmove'
        ];

        // Adicionar event listeners
        events.forEach(event => {
            document.addEventListener(event, resetTimer, { passive: true });
        });

        // Iniciar timer
        resetTimer();

        // Cleanup
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            events.forEach(event => {
                document.removeEventListener(event, resetTimer);
            });
        };
    }, [resetTimer, enabled]);

    return {
        resetTimer,
        getLastActivity: () => lastActivityRef.current,
        getRemainingTime: () => {
            const elapsed = Date.now() - lastActivityRef.current;
            return Math.max(0, timeout - elapsed);
        }
    };
};
