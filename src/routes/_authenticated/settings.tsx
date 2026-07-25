import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { auth } from "@/integrations/firebase/firebase";
import { updateProfile } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Cpu, RefreshCw, Server, Sparkles, CheckCircle2, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  OllamaConfig,
  DEFAULT_OLLAMA_CONFIG,
  fetchInstalledOllamaModels,
  generateOllamaAnswer,
} from "@/lib/ollama-rag";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — DocBrain AI" }] }),
  component: SettingsPage,
});

export function getOllamaConfig(): OllamaConfig {
  if (typeof window !== "undefined") {
    const savedUrl = localStorage.getItem("docbrain_ollama_url");
    const savedModel = localStorage.getItem("docbrain_ollama_model");
    return {
      baseUrl: savedUrl ? savedUrl.trim() : "http://localhost:11434",
      model: savedModel ? savedModel.trim() : "llama3.2:latest",
    };
  }
  return DEFAULT_OLLAMA_CONFIG;
}

function SettingsPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3.2:latest");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [testingModel, setTestingModel] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setEmail(user.email ?? "");
      setName(user.displayName ?? "");
    }

    const conf = getOllamaConfig();
    setOllamaUrl(conf.baseUrl);
    setOllamaModel(conf.model);

    // Auto-detect installed models
    detectModels(conf.baseUrl, conf.model);
  }, []);

  async function detectModels(url: string, currentModel = ollamaModel) {
    setCheckingOllama(true);
    const models = await fetchInstalledOllamaModels(url);
    setAvailableModels(models);
    const connected = models.length > 0;
    setIsConnected(connected);

    if (connected) {
      if (models.includes(currentModel)) {
        setOllamaModel(currentModel);
      } else {
        const preferred = models.find((m) => m.includes("llama3.2")) || models[0];
        setOllamaModel(preferred);
      }
    }
    setCheckingOllama(false);
  }

  async function testConnection() {
    setTestingModel(true);
    try {
      const start = Date.now();
      const res = await generateOllamaAnswer(
        "Say 'DocBrain connected successfully!'",
        [],
        { baseUrl: ollamaUrl, model: ollamaModel }
      );
      const elapsed = Date.now() - start;
      toast.success(`Ollama responded in ${elapsed}ms: "${res.answer.slice(0, 100)}..."`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTestingModel(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    const user = auth.currentUser;
    if (user) {
      try {
        await updateProfile(user, { displayName: name });
        toast.success("Profile updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update profile");
      }
    }
    setSaving(false);
  }

  function saveOllamaSettings() {
    if (typeof window !== "undefined") {
      localStorage.setItem("docbrain_ollama_url", ollamaUrl.trim());
      localStorage.setItem("docbrain_ollama_model", ollamaModel.trim());
      toast.success(`Ollama settings saved! Selected model: ${ollamaModel.trim()}`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your account and local AI model preferences.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6 border-brand/40">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-brand" /> Ollama Local AI Model Configuration
          </CardTitle>
          {isConnected === true && (
            <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </Badge>
          )}
          {isConnected === false && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" /> Offline
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            DocBrain runs locally with <strong>Ollama</strong>. Connect your local Ollama server to ask questions about your documents 100% offline & private.
          </p>

          <div>
            <Label htmlFor="ollama-url" className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-muted-foreground" /> Ollama Server URL
            </Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="ollama-url"
                type="text"
                placeholder="http://localhost:11434"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => detectModels(ollamaUrl)}
                disabled={checkingOllama}
                title="Refresh installed models"
              >
                <RefreshCw className={`h-4 w-4 ${checkingOllama ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="ollama-model" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" /> Ollama Model Name
            </Label>
            {availableModels.length > 0 ? (
              <select
                id="ollama-model"
                value={ollamaModel}
                onChange={(e) => {
                  setOllamaModel(e.target.value);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("docbrain_ollama_model", e.target.value.trim());
                  }
                }}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="ollama-model"
                type="text"
                placeholder="llama3.2:latest, qwen3.5:latest, mistral"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="mt-1.5 font-mono text-sm"
              />
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Run <code className="bg-muted px-1.5 py-0.5 rounded">ollama run llama3.2</code> or <code className="bg-muted px-1.5 py-0.5 rounded">ollama serve</code> in your terminal.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={saveOllamaSettings}>
              Save Settings
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testingModel || checkingOllama}>
              {testingModel ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4 text-amber-500" />
              )}
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

