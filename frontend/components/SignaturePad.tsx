import React, { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
    onSave: (signature: string) => void;
    onClear: () => void;
    label: string;
    initialSignature?: string;
    height?: number;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear, label, initialSignature, height = 200 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Init Context
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
        }

        // Resize Observer
        const resizeObserver = new ResizeObserver(() => {
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                if (rect.width > 0) {
                    // Save current content? Clearing resets it. 
                    // For signature pad, resizing usually clears or we need to redraw.
                    // For simplicity, we restart, or we can copy. 
                    // Let's just set width. 
                    canvas.width = rect.width;
                    canvas.height = height;

                    // Re-apply context styles after resize reset
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.strokeStyle = '#000';
                        ctx.lineWidth = 2;
                        ctx.lineCap = 'round';

                        // Redraw initial signature if exists and not modified
                        if (initialSignature && !hasSignature) {
                            const img = new Image();
                            img.onload = () => {
                                ctx.drawImage(img, 0, 0);
                                setHasSignature(true);
                            };
                            img.src = initialSignature;
                        }
                    }
                }
            }
        });

        // Observe parent or canvas itself (if w-full)
        if (canvas.parentElement) {
            resizeObserver.observe(canvas.parentElement);
        }

        return () => resizeObserver.disconnect();
    }, [height, initialSignature]); // Remove hasSignature from dep to avoid loop, but we check it inside

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const rect = canvas.getBoundingClientRect();
                const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
                const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
                ctx.beginPath();
                ctx.moveTo(x, y);
            }
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const rect = canvas.getBoundingClientRect();
                const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
                const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
                ctx.lineTo(x, y);
                ctx.stroke();
                setHasSignature(true);
            }
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clear = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                setHasSignature(false);
                onClear();
            }
        }
    };

    const save = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const dataUrl = canvas.toDataURL('image/png');
            onSave(dataUrl);
        }
    };

    return (
        <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-background-dark">
            <h4 className="text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">{label}</h4>
            <canvas
                ref={canvasRef}
                className="w-full border border-gray-200 dark:border-gray-600 rounded cursor-crosshair touch-none bg-gray-50 dark:bg-surface-dark"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={clear} className="text-sm text-red-500 hover:underline">Limpar</button>
                <button type="button" onClick={save} disabled={!hasSignature} className="text-sm text-primary hover:underline font-bold disabled:opacity-50">Salvar Assinatura</button>
            </div>
        </div>
    );
};
