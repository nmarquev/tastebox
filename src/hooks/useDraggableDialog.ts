import { useCallback, useEffect, useRef, useState } from 'react';

// Permite arrastrar un modal (Radix DialogContent) desde un "handle" (su barra superior).
// - dragHandleProps: se aplican al elemento que actúa de barra para arrastrar.
// - contentStyle: se aplica al DialogContent; sobreescribe el transform de centrado
//   sumándole el desplazamiento. Solo se aplica cuando se arrastró (para no romper las
//   animaciones de apertura/cierre de Radix mientras está centrado).
export function useDraggableDialog(isOpen: boolean) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // Al abrir/cerrar, volver a centrar.
  useEffect(() => {
    if (!isOpen) setOffset({ x: 0, y: 0 });
  }, [isOpen]);

  const onPointerMove = useCallback((event: PointerEvent) => {
    const state = dragState.current;
    if (!state) return;
    setOffset({
      x: state.baseX + (event.clientX - state.startX),
      y: state.baseY + (event.clientY - state.startY),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragState.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  useEffect(() => {
    // Limpieza por si el componente se desmonta a mitad de un arrastre.
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    // No arrastrar si se hizo clic en un control interactivo del header.
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="combobox"], [data-no-drag]')) return;
    dragState.current = { startX: event.clientX, startY: event.clientY, baseX: offset.x, baseY: offset.y };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [offset.x, offset.y, onPointerMove, onPointerUp]);

  const dragHandleProps = {
    onPointerDown,
    style: { cursor: 'move', touchAction: 'none' as const, userSelect: 'none' as const },
  };

  const moved = offset.x !== 0 || offset.y !== 0;
  const contentStyle: React.CSSProperties | undefined = moved
    ? { transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }
    : undefined;

  return { dragHandleProps, contentStyle };
}
