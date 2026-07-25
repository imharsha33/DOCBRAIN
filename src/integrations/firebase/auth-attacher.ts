// Client-side middleware that attaches Firebase auth token to server function requests.
import { createMiddleware } from "@tanstack/react-start";
import { auth } from "./firebase";

export const attachFirebaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const user = auth.currentUser;
    let token: string | undefined;
    if (user) {
      try {
        token = await user.getIdToken();
      } catch {
        // user not signed in
      }
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
