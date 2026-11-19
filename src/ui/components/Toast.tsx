import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  /** milisecunde; implicit 5 secunde, cât să apuci să apeși „Anulează” */
  duration?: number;
}

interface ToastState extends ToastOptions {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string, options?: ToastOptions) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    counter.current += 1;
    setToast({ id: counter.current, message, ...options });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), toast.duration ?? 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" role="status" aria-live="polite" key={toast.id}>
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
