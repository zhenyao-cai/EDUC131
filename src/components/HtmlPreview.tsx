/** Renders untrusted HTML in an isolated iframe (no same-origin with the app). */
export function HtmlPreview({ html, fill, compact }: { html: string; fill?: boolean; compact?: boolean }) {
  return (
    <iframe
      title="Preview"
      className="html-preview-frame"
      sandbox="allow-scripts allow-forms allow-modals"
      srcDoc={html}
      style={{
        width: "100%",
        height: fill ? "100%" : compact ? 140 : undefined,
        minHeight: compact ? 120 : fill ? "100%" : 280,
        maxHeight: compact ? 160 : fill ? undefined : undefined,
        border: "1px solid var(--border)",
        borderRadius: fill ? 0 : "var(--radius)",
        background: "white",
        display: "block",
      }}
    />
  );
}
