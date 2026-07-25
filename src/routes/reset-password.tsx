import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { auth } from "@/integrations/firebase/firebase";
import { confirmPasswordReset, onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — DocBrain AI" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get the oobCode from URL query params (Firebase sends it as ?oobCode=xxx)
    const params = new URLSearchParams(window.location.search);
    const code = params.get("oobCode");
    setOobCode(code);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!oobCode) {
      toast.error("Invalid reset link. Please request a new one.");
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      toast.success("Password updated");
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset password");
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-brand">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight">DocBrain AI</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {oobCode ? "Choose a strong password." : "Invalid or expired reset link."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="pw">New password</Label>
            <Input
              id="pw"
              type="password"
              required
              minLength={6}
              className="mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy || !oobCode} className="w-full">
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
