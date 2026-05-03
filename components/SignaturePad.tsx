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
        <div className="border border-gray-200 dark:border-gray-800 rounded-2xl p-6 bg-white dark:bg-surface-dark shadow-sm">
            <h4 className="text-sm font-bold mb-4 text-gray-900 dark:text-white uppercase tracking-wider">{label}</h4>
            <div className="relative group">
                <canvas
                    ref={canvasRef}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl cursor-crosshair touch-none bg-gray-50 dark:bg-background-dark/50"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                        <p className="text-sm font-medium">Assine aqui</p>
                    </div>
                )}
            </div>
            <div className="flex justify-between items-center mt-4">
                <button type="button" onClick={clear} className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">delete</span>
                    LIMPAR
                </button>
                <button 
                    type="button" 
                    onClick={save} 
                    disabled={!hasSignature} 
                    className="bg-primary text-background-dark px-6 py-2 rounded-xl text-xs font-black hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                >
                    SALVAR ASSINATURA
                </button>
            </div>
        </div>
    );
};
