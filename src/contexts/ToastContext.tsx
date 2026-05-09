import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "info" | "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_MS = 4200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [{ id, message, variant }, ...prev]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions text">
        {toasts.map((t) => (
          <ToastBanner key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastBanner({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false);
  const autoTimer = useRef(0);

  const close = useCallback(() => {
    window.clearTimeout(autoTimer.current);
    setLeaving(true);
    window.setTimeout(() => onDismiss(item.id), 280);
  }, [item.id, onDismiss]);

  useEffect(() => {
    autoTimer.current = window.setTimeout(close, DISMISS_MS);
    return () => window.clearTimeout(autoTimer.current);
  }, [close]);

  return (
    <div className={`toast-banner toast-banner--${item.variant}${leaving ? " toast-banner--leave" : ""}`} role="status">
      <p className="toast-banner-text">{item.message}</p>
      <button type="button" className="toast-banner-close" onClick={close} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
