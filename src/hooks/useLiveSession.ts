import { useEffect, useState } from "react";
import { defaultLiveSession, subscribeLiveSession } from "@/services/liveSession";
import type { LiveSessionState } from "@/types/models";

export function useLiveSession(): LiveSessionState {
  const [state, setState] = useState<LiveSessionState>(defaultLiveSession);

  useEffect(() => {
    return subscribeLiveSession(setState);
  }, []);

  return state;
}
