import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { auth, db } from "@/integrations/firebase/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "forgot"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — DocBrain AI" },
      { name: "description", content: "Sign in to DocBrain AI to chat with your documents." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Asynchronously sync profile to Firestore without blocking navigation
        setDoc(
          doc(db, "profiles", user.uid),
          {
            email: user.email,
            full_name: user.displayName || name || "",
            updated_at: new Date().toISOString(),
          },
          { merge: true }
        ).catch(() => {});
        
        navigate({ to: "/dashboard", replace: true });
      }
    });
    return unsubscribe;
  }, [navigate, name]);

  function formatAuthError(err: unknown): string {
    if (typeof err === "object" && err !== null && "code" in err) {
      const code = String((err as { code: unknown }).code);
      switch (code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          return "Invalid email or password.";
        case "auth/email-already-in-use":
          return "An account with this email already exists. Try signing in instead.";
        case "auth/weak-password":
          return "Password should be at least 6 characters.";
        case "auth/invalid-email":
          return "Please enter a valid email address.";
      }
    }
    return err instanceof Error ? err.message : "Authentication failed.";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (cred.user) {
          setDoc(
            doc(db, "profiles", cred.user.uid),
            {
              email: cred.user.email,
              updated_at: new Date().toISOString(),
            },
            { merge: true }
          ).catch(() => {});
        }
        toast.success("Welcome back!");
        navigate({ to: "/dashboard", replace: true });
      } else if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name && cred.user) {
          await updateProfile(cred.user, { displayName: name });
        }
        if (cred.user) {
          setDoc(
            doc(db, "profiles", cred.user.uid),
            {
              email: cred.user.email,
              full_name: name || "",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { merge: true }
          ).catch(() => {});
        }
        toast.success("Account created successfully!");
        navigate({ to: "/dashboard", replace: true });
      } else {
        await sendPasswordResetEmail(auth, email);
        toast.success("Reset link sent — check your inbox.");
      }
    } catch (e) {
      toast.error(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="relative hidden md:block">
        <div className="absolute inset-0 hero-grid opacity-30" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold tracking-tight">DocBrain AI</span>
          </Link>
          <div>
            <div className="text-xs uppercase tracking-widest text-brand">Document Intelligence</div>
            <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-tight">
              Understand Every Document. Instantly.
            </h2>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Chat with your PDFs, notes, and research. Get grounded answers with clickable citations.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} DocBrain AI
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold tracking-tight">DocBrain AI</span>
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to continue to your workspace."
              : mode === "signup"
                ? "Start chatting with your documents in seconds."
                : "We'll email you a reset link."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5"
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                New to DocBrain?{" "}
                <button className="text-foreground underline" onClick={() => setMode("signup")}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="text-foreground underline" onClick={() => setMode("signin")}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
