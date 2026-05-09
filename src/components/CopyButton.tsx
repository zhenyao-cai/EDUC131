import { useToast } from "@/contexts/ToastContext";

type CopyButtonProps = {
  text: string;
  /** Shown on the button; keep short for compact rows */
  label?: string;
  className?: string;
  /** Visually smaller (uses `copy-btn-sm` when no className override) */
  compact?: boolean;
};

export function CopyButton({ text, label = "Copy", className, compact }: CopyButtonProps) {
  const { toast } = useToast();
  const cls = ["secondary", compact ? "copy-btn-sm" : "", className].filter(Boolean).join(" ");

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied.", "success");
    } catch {
      toast("Could not copy.", "error");
    }
  }

  return (
    <button type="button" className={cls || undefined} onClick={() => void onCopy()}>
      {label}
    </button>
  );
}
