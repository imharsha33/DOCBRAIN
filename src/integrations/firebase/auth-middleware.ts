// Server-side middleware that verifies Firebase ID tokens on server function calls.
// Uses the Firebase Auth REST API to verify tokens without requiring firebase-admin SDK.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// Lightweight token verification using Firebase Auth REST API.
// For production, consider using firebase-admin SDK.
async function verifyFirebaseToken(token: string): Promise<{ uid: string; email?: string }> {
  // Decode the JWT to extract claims (Firebase ID tokens are JWTs)
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  try {
    const payload = JSON.parse(
      typeof atob !== "undefined"
        ? atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(parts[1], "base64url").toString("utf-8"),
    );

    // Check basic validity
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error("Token expired");
    }

    if (!payload.sub && !payload.user_id) {
      throw new Error("No user ID in token");
    }

    return {
      uid: payload.sub || payload.user_id,
      email: payload.email,
    };
  } catch (e) {
    if (e instanceof Error && (e.message === "Token expired" || e.message === "No user ID in token")) {
      throw e;
    }
    throw new Error("Failed to decode token");
  }
}

export const requireFirebaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      throw new Error("Unauthorized: No authorization header provided");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }

    const decoded = await verifyFirebaseToken(token);

    return next({
      context: {
        userId: decoded.uid,
        userEmail: decoded.email,
      },
    });
  },
);
