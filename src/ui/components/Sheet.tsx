import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** acțiune opțională în antet, lângă închidere */
  headerAction?: ReactNode;
}

/** Foile deschise, de jos în sus; Escape o închide doar pe cea de deasupra. */
const stack: symbol[] = [];

/** Foaie pe tot ecranul, deasupra tab-urilor. Escape sau butonul ✕ o închid. */
export function Sheet({ title, onClose, children, headerAction }: SheetProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const me = Symbol('sheet');
    stack.push(me);
    document.body.classList.add('sheet-open');
    // nu lua focusul de la un câmp din foaie care l-a primit deja (autoFocus)
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === me) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(me), 1);
      if (stack.length === 0) document.body.classList.remove('sheet-open');
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <>
      <div className="sheet-scrim" aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="sheet-inner">
          <header className="sheet-head">
            <h2 id={titleId}>{title}</h2>
            <div className="row" style={{ gap: 8 }}>
              {headerAction}
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Închide">
                <Icon name="close" />
              </button>
            </div>
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
