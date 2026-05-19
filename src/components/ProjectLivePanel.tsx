import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import { useToast } from "@/contexts/ToastContext";
import { useLiveSession } from "@/hooks/useLiveSession";
import {
  MAX_VOTES_PER_USER,
  postProjectComment,
  subscribeMyVotes,
  subscribeProjectComments,
  subscribeProjectVoteCount,
  toggleProjectVote,
} from "@/services/liveSession";
import type { ProjectCommentDoc } from "@/types/models";

type Props = {
  projectId: string;
  toolName?: string;
};

export function ProjectLivePanel({ projectId, toolName }: Props) {
  const { user, displayName, hasJoined, loading: sessionLoading } = useSession();
  const { toast } = useToast();
  const live = useLiveSession();

  const [voteCount, setVoteCount] = useState(0);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Array<{ id: string } & ProjectCommentDoc>>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [voteBusy, setVoteBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const showVote = live.votingEnabled;
  const showDiscussion = live.discussionEnabled;
  const voted = myVotes.has(projectId);
  const votesUsed = myVotes.size;

  useEffect(() => {
    if (!showVote) return;
    return subscribeProjectVoteCount(projectId, setVoteCount);
  }, [projectId, showVote]);

  useEffect(() => {
    if (!user || !showVote) return;
    return subscribeMyVotes(user.uid, setMyVotes);
  }, [user, showVote]);

  useEffect(() => {
    if (!showDiscussion) return;
    return subscribeProjectComments(projectId, setComments);
  }, [projectId, showDiscussion]);

  if (!showVote && !showDiscussion) return null;

  async function onVote() {
    if (!user) {
      toast("Sign in failed — refresh the page.", "error");
      return;
    }
    if (!hasJoined) {
      toast("Enter your name on the main site first.", "error");
      return;
    }
    setVoteBusy(true);
    try {
      await toggleProjectVote(user.uid, projectId);
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Vote failed.", "error");
    } finally {
      setVoteBusy(false);
    }
  }

  async function onPostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !hasJoined) return;
    setCommentBusy(true);
    try {
      await postProjectComment(user.uid, displayName, projectId, commentDraft);
      setCommentDraft("");
    } catch (ex: unknown) {
      toast(ex instanceof Error ? ex.message : "Could not post comment.", "error");
    } finally {
      setCommentBusy(false);
    }
  }

  const needsName = Boolean(!sessionLoading && user && !hasJoined);

  return (
    <aside className={`project-live-panel${panelOpen ? " is-open" : ""}`} aria-label="Live class panel">
      <button
        type="button"
        className="project-live-panel-toggle"
        onClick={() => setPanelOpen((o) => !o)}
        aria-expanded={panelOpen}
      >
        {panelOpen ? "Hide" : "Live"}
        {showVote && voteCount > 0 ? <span className="vote-badge">{voteCount}</span> : null}
      </button>

      {panelOpen ? (
        <div className="project-live-panel-body stack">
          {toolName ? (
            <p className="project-live-panel-title" style={{ margin: 0 }}>
              {toolName}
            </p>
          ) : null}

          {needsName ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              <Link to="/app">Enter your name</Link> to vote or comment.
            </p>
          ) : null}

          {showVote ? (
            <div className="stack" style={{ gap: "0.35rem" }}>
              <div className="row" style={{ alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={`vote-like-btn${voted ? " is-voted" : ""}`}
                  disabled={voteBusy || sessionLoading || !user || needsName}
                  onClick={() => void onVote()}
                  title={voted ? "Remove your vote" : "Vote for this project"}
                >
                  ♥ {voteCount}
                </button>
                <span className="muted" style={{ fontSize: "0.82rem" }}>
                  {votesUsed} / {MAX_VOTES_PER_USER} votes used
                </span>
              </div>
            </div>
          ) : null}

          {showDiscussion ? (
            <div className="stack" style={{ gap: "0.5rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>Discussion</strong>
              <div className="project-live-comments">
                {comments.length === 0 ? (
                  <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                    No comments yet.
                  </p>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {comments.map((c) => (
                      <li key={c.id} className="project-live-comment">
                        <span className="project-live-comment-name">{c.displayName}</span>
                        <span>{c.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {!needsName && user ? (
                <form className="row" style={{ gap: "0.35rem" }} onSubmit={(e) => void onPostComment(e)}>
                  <input
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Add a comment…"
                    maxLength={500}
                    disabled={commentBusy}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button type="submit" disabled={commentBusy || !commentDraft.trim()}>
                    Post
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
