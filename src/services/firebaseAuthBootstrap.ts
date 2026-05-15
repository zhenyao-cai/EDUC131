import { onAuthStateChanged, signInAnonymously, type Auth, type User } from "firebase/auth";

const DEFAULT_TIMEOUT_MS = 20_000;

function authErrorMessage(ex: unknown): string {
  if (ex instanceof Error) {
    if (/timed out/i.test(ex.message)) return ex.message;
    if (/network|failed to fetch|offline/i.test(ex.message)) {
      return "Network error — check Wi‑Fi or cellular and try again.";
    }
    return ex.message;
  }
  return "Could not connect to Firebase.";
}

/** Wait for anonymous auth; times out on slow or blocked mobile browsers. */
export function ensureAnonymousAuth(auth: Auth, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<User> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      fn();
    };

    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            "Connection timed out. Use a normal browser tab (not private), check network, and ensure this site URL is added in Firebase → Authentication → Authorized domains.",
          ),
        ),
      );
    }, timeoutMs);

    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        if (u) {
          finish(() => resolve(u));
        } else {
          void signInAnonymously(auth).catch((ex) => {
            finish(() => reject(new Error(authErrorMessage(ex))));
          });
        }
      },
      (ex) => {
        finish(() => reject(new Error(authErrorMessage(ex))));
      },
    );
  });
}
