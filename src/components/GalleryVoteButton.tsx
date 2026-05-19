import { useState } from "react";
import { useSession } from "@/contexts/SessionContext";
import { useToast } from "@/contexts/ToastContext";
import { MAX_VOTES_PER_USER, toggleProjectVote } from "@/services/liveSession";

type Props = {
  projectId: string;
  voteCount: number;
  voted: boolean;
  votesUsed: number;
};

export function GalleryVoteButton({ projectId, voteCount, voted, votesUsed }: Props) {
  const { user, hasJoined, loading } = useSession();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !hasJoined) {
      toast("Enter your name on the site first.", "error");
      return;
    }
    setBusy(true);
    try {
      await toggleProjectVote(user.uid, projectId);
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Vote failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`vote-like-btn${voted ? " is-voted" : ""}`}
      disabled={busy || loading || !user}
      onClick={(e) => void onClick(e)}
    >
      ♥ {voteCount}
      <span className="muted" style={{ fontSize: "0.75rem", marginLeft: "0.2rem" }}>
        ({votesUsed}/{MAX_VOTES_PER_USER})
      </span>
    </button>
  );
}
