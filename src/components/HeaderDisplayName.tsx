import { useEffect, useRef, useState } from "react";
import { useSession } from "@/contexts/SessionContext";
import { useToast } from "@/contexts/ToastContext";

export function HeaderDisplayName() {
  const { displayName, updateDisplayName, updatingName } = useSession();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(displayName);
  }, [displayName, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(displayName);
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(displayName);
    setEditing(false);
  }

  async function saveEdit() {
    try {
      await updateDisplayName(draft);
      setEditing(false);
      toast("Name updated.", "success");
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Could not update name.", "error");
    }
  }

  if (editing) {
    return (
      <form
        className="header-name-form"
        onSubmit={(e) => {
          e.preventDefault();
          void saveEdit();
        }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={120}
          disabled={updatingName}
          aria-label="Your name"
          className="header-name-input"
        />
        <button type="submit" disabled={updatingName || !draft.trim()}>
          {updatingName ? "…" : "Save"}
        </button>
        <button type="button" className="secondary" disabled={updatingName} onClick={cancelEdit}>
          Cancel
        </button>
      </form>
    );
  }

  return (
    <button type="button" className="header-name-btn" onClick={startEdit} title="Change your name">
      {displayName}
    </button>
  );
}
