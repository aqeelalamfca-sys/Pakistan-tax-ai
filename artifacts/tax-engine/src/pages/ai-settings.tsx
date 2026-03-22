import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Settings2, Key, Zap, Brain, Shield, BarChart3, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function getToken() { return localStorage.getItem("tax_engine_token"); }

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...opts.headers },
  });
  if (!res.ok) throw new Error((await res.json()).message || res.statusText);
  return res.json();
}

export default function AiSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; durationMs?: number } | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [settings, setSettings] = useState({
    ai_provider: "openai",
    ai_model: "gpt-4o-mini",
    openai_api_key: "",
    gemini_api_key: "",
    ai_temperature: "0.3",
    ai_max_tokens: "3000",
    ai_system_prompt: "",
    vault_search_limit: "5",
    moderation_enabled: "true",
  });

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  async function loadSettings() {
    try {
      const data = await apiFetch("/api/ai/settings");
      setSettings(data.settings);
      setIsConfigured(data.isConfigured);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to load AI settings", description: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const data = await apiFetch("/api/ai/stats");
      setStats(data);
    } catch { }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch("/api/ai/settings", { method: "PUT", body: JSON.stringify(settings) });
      toast({ title: "AI settings saved successfully" });
      loadSettings();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save failed", description: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const apiKey = settings.ai_provider === "gemini" ? settings.gemini_api_key : settings.openai_api_key;
      const result = await apiFetch("/api/ai/test-connection", {
        method: "POST",
        body: JSON.stringify({ provider: settings.ai_provider, apiKey: apiKey.includes("••••") ? undefined : apiKey, model: settings.ai_model }),
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  function update(key: string, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  if (loading) return <div className="p-8 text-center animate-pulse">Loading AI settings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary" /> AI Configuration
          </h1>
          <p className="text-muted-foreground mt-1">Configure AI providers, models, and behavior for the Tax Intelligence Engine.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={isConfigured ? "default" : "destructive"} className="text-sm px-3 py-1">
            {isConfigured ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> AI Active</> : <><XCircle className="w-3.5 h-3.5 mr-1.5" /> Not Configured</>}
          </Badge>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Settings"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="flex items-center text-lg"><Key className="w-5 h-5 text-primary mr-2" /> Provider & API Keys</CardTitle>
              <CardDescription>Connect to OpenAI or Google Gemini for AI-powered tax analysis.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="space-y-2">
                <Label>AI Provider</Label>
                <Select value={settings.ai_provider} onValueChange={v => {
                  update("ai_provider", v);
                  update("ai_model", v === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini");
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={settings.ai_model} onValueChange={v => update("ai_model", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {settings.ai_provider === "openai" ? (
                      <>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fast & Cost-effective)</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o (Best Quality)</SelectItem>
                        <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Budget)</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</SelectItem>
                        <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (Best Quality)</SelectItem>
                        <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {settings.ai_provider === "openai" && (
                <div className="space-y-2">
                  <Label>OpenAI API Key</Label>
                  <Input type="password" value={settings.openai_api_key} onChange={e => update("openai_api_key", e.target.value)} placeholder="sk-..." className="font-mono text-sm" />
                  <p className="text-xs text-muted-foreground">Get your API key from platform.openai.com</p>
                </div>
              )}

              {settings.ai_provider === "gemini" && (
                <div className="space-y-2">
                  <Label>Google Gemini API Key</Label>
                  <Input type="password" value={settings.gemini_api_key} onChange={e => update("gemini_api_key", e.target.value)} placeholder="AI..." className="font-mono text-sm" />
                  <p className="text-xs text-muted-foreground">Get your API key from aistudio.google.com</p>
                </div>
              )}

              <div className="pt-2 flex items-center gap-3">
                <Button variant="outline" onClick={handleTestConnection} disabled={testing} className="border-primary text-primary hover:bg-primary/10">
                  {testing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</> : <><Zap className="w-4 h-4 mr-2" /> Test Connection</>}
                </Button>
                {testResult && (
                  <span className={`text-sm flex items-center gap-1.5 ${testResult.success ? "text-emerald-600" : "text-destructive"}`}>
                    {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {testResult.message}
                    {testResult.durationMs && <span className="text-muted-foreground ml-1">({testResult.durationMs}ms)</span>}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="flex items-center text-lg"><Settings2 className="w-5 h-5 text-primary mr-2" /> Generation Parameters</CardTitle>
              <CardDescription>Fine-tune how the AI generates tax advisory content.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Temperature</Label>
                  <Input type="number" min="0" max="1" step="0.1" value={settings.ai_temperature} onChange={e => update("ai_temperature", e.target.value)} />
                  <p className="text-xs text-muted-foreground">Lower = more precise (recommended: 0.2-0.4 for tax work)</p>
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input type="number" min="500" max="8000" step="500" value={settings.ai_max_tokens} onChange={e => update("ai_max_tokens", e.target.value)} />
                  <p className="text-xs text-muted-foreground">Max length of generated output</p>
                </div>
                <div className="space-y-2">
                  <Label>Vault References</Label>
                  <Input type="number" min="1" max="20" value={settings.vault_search_limit} onChange={e => update("vault_search_limit", e.target.value)} />
                  <p className="text-xs text-muted-foreground">Max vault docs per AI query</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea rows={4} value={settings.ai_system_prompt} onChange={e => update("ai_system_prompt", e.target.value)} className="font-mono text-xs bg-background" placeholder="AI system instructions..." />
                <p className="text-xs text-muted-foreground">Defines the AI's core persona and expertise areas</p>
              </div>

              <div className="flex items-center gap-3">
                <Label>Output Moderation</Label>
                <Select value={settings.moderation_enabled} onValueChange={v => update("moderation_enabled", v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Enabled</SelectItem>
                    <SelectItem value="false">Disabled</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Flags fabricated numbers and definitive legal conclusions</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="flex items-center text-lg"><BarChart3 className="w-5 h-5 text-primary mr-2" /> AI Usage</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {stats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-xl p-4 text-center border border-border/30">
                      <p className="text-2xl font-bold text-foreground">{stats.totalRuns}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total Runs</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 text-center border border-border/30">
                      <p className="text-2xl font-bold text-foreground">{stats.totalOutputs}</p>
                      <p className="text-xs text-muted-foreground mt-1">Outputs</p>
                    </div>
                    <div className="bg-primary/5 rounded-xl p-4 text-center col-span-2 border border-primary/20">
                      <p className="text-2xl font-bold text-primary">{stats.promotedOutputs}</p>
                      <p className="text-xs text-muted-foreground mt-1">Promoted to Final</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={loadStats}>
                    <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh Stats
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Loading stats...</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="flex items-center text-lg"><Shield className="w-5 h-5 text-primary mr-2" /> Quick Guide</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">1.</span>
                  <span>Choose your AI provider (OpenAI recommended for tax work)</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">2.</span>
                  <span>Enter your API key and test the connection</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">3.</span>
                  <span>Upload tax laws to the Knowledge Vault for grounded responses</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-primary shrink-0">4.</span>
                  <span>Team members can use AI Assistant in any engagement</span>
                </div>
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
                  <strong>Security:</strong> API keys are encrypted at rest. Only Super Admins can view or modify AI configuration.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
