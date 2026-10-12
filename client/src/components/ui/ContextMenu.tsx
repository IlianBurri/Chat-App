import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { MenuContextProvider, MenuList } from './Menu';

interface Point {
  x: number;
  y: number;
}

/**
 * Right-click menu. Also opens with the context-menu key or Shift+F10 on the
 * wrapped element, so it works from the keyboard.
 */
export function useContextMenu() {
  const [point, setPoint] = useState<Point | null>(null);
  const originRef = useRef<HTMLElement | null>(null);

  const open = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    originRef.current = e.currentTarget;
    setPoint({ x: e.clientX, y: e.clientY });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      originRef.current = e.currentTarget;
      setPoint({ x: rect.left + 24, y: rect.top + rect.height / 2 });
    }
  };

  const close = () => {
    setPoint(null);
    originRef.current?.focus();
  };

  return { point, triggerProps: { onContextMenu: open, onKeyDown }, close };
}

export function ContextMenu({ point, label, onClose, children }: { point: Point | null; label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Point | null>(null);

  useEffect(() => {
    if (!point) return;
    // Keep the menu inside the viewport.
    const rect = ref.current?.getBoundingClientRect();
    const width = rect?.width ?? 220;
    const height = rect?.height ?? 200;
    setPosition({
      x: Math.min(point.x, window.innerWidth - width - 8),
      y: Math.min(point.y, window.innerHeight - height - 8),
    });
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('blur', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('blur', onScroll);
    };
  }, [point, onClose]);

  if (!point) return null;
  const at = position ?? point;
  return (
    <div ref={ref} className="fixed z-50" style={{ left: at.x, top: at.y }}>
      <MenuContextProvider close={onClose}>
        <MenuList label={label} onClose={onClose} className="w-56">
          {children}
        </MenuList>
      </MenuContextProvider>
    </div>
  );
}
