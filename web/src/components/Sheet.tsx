import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Bottom sheet, rendered through a portal into <body>.
 *
 * The portal is not optional. The top bar and bottom nav both use
 * `backdrop-filter`, and an element with a backdrop-filter becomes the
 * containing block for any `position: fixed` descendant — so a sheet rendered
 * inside them would be positioned against a 60px-tall header instead of the
 * viewport, and end up off screen. Portalling to <body> escapes that.
 */
export function Sheet({
  onClose,
  children,
  label,
}: {
  onClose: () => void;
  children: ReactNode;
  label: string;
}) {
  // Escape closes, and the page behind must not scroll while the sheet is up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[oklch(20%_0.03_155_/_0.45)] backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className="animate-slide-up max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-card p-6 pb-10 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-border" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
