"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Eye, EyeOff, Save, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderConfig {
  enabled: boolean;
  apiKey: string;
  dailyBudget: number;
}

interface MonitoringConfig {
  defaultSchedule: string;
  batchSize: number;
  alertsEnabled: boolean;
  emailNotifications: boolean;
  notificationEmail: string;
}

interface ScoringConfig {
  structuralWeight: number;
  citationWeight: number;
  competitiveWeight: number;
  autoValidate: boolean;
  validationProviders: string[];
}

interface Settings {
  providers: Record<string, ProviderConfig>;
  monitoring: MonitoringConfig;
  scoring: ScoringConfig;
}

const PROVIDERS = ["openai", "anthropic", "google", "perplexity"] as const;

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  perplexity: "Perplexity",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cronToHuman(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid cron expression";

  const [minute, hour, , , dayOfWeek] = parts;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  let desc = "Every ";

  if (dayOfWeek === "*") {
    desc += "day";
  } else {
    const dayIdx = parseInt(dayOfWeek, 10);
    if (!isNaN(dayIdx) && dayIdx >= 0 && dayIdx <= 6) {
      desc += days[dayIdx];
    } else {
      desc += dayOfWeek;
    }
  }

  if (hour !== "*" && minute !== "*") {
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const ampm = h >= 12 ? "pm" : "am";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    desc += ` at ${displayH}:${m.toString().padStart(2, "0")}${ampm}`;
  }

  return desc;
}

function defaultSettings(): Settings {
  const providers: Record<string, ProviderConfig> = {};
  for (const p of PROVIDERS) {
    providers[p] = { enabled: false, apiKey: "", dailyBudget: 10 };
  }
  return {
    providers,
    monitoring: {
      defaultSchedule: "0 9 * * 1",
      batchSize: 10,
      alertsEnabled: true,
      emailNotifications: false,
      notificationEmail: "",
    },
    scoring: {
      structuralWeight: 0.4,
      citationWeight: 0.4,
      competitiveWeight: 0.2,
      autoValidate: false,
      validationProviders: ["openai"],
    },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Failed to load settings");
        const data = await res.json();
        setSettings({ ...defaultSettings(), ...data });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setSuccessMsg("Settings saved successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const toggleKeyVisibility = (provider: string) => {
    setVisibleKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const updateProvider = (provider: string, field: keyof ProviderConfig, value: string | number | boolean) => {
    setSettings((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [provider]: { ...prev.providers[provider], [field]: value },
      },
    }));
  };

  const updateMonitoring = (field: keyof MonitoringConfig, value: string | number | boolean) => {
    setSettings((prev) => ({
      ...prev,
      monitoring: { ...prev.monitoring, [field]: value },
    }));
  };

  const updateScoringWeight = (field: "structuralWeight" | "citationWeight" | "competitiveWeight", value: number) => {
    setSettings((prev) => {
      const updated = { ...prev.scoring, [field]: value };
      const sum = updated.structuralWeight + updated.citationWeight + updated.competitiveWeight;
      if (sum > 0) {
        updated.structuralWeight = Math.round((updated.structuralWeight / sum) * 100) / 100;
        updated.citationWeight = Math.round((updated.citationWeight / sum) * 100) / 100;
        updated.competitiveWeight = Math.round((1 - updated.structuralWeight - updated.citationWeight) * 100) / 100;
      }
      return { ...prev, scoring: updated };
    });
  };

  const toggleValidationProvider = (provider: string) => {
    setSettings((prev) => {
      const current = prev.scoring.validationProviders;
      const next = current.includes(provider)
        ? current.filter((p) => p !== provider)
        : [...current, provider];
      return { ...prev, scoring: { ...prev.scoring, validationProviders: next } };
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Configure your AEO Engine</p>
        </div>
        <Skeleton className="h-10 w-80" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Configure your AEO Engine</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
        </TabsList>

        {/* Providers Tab */}
        <TabsContent value="providers">
          <div className="space-y-4">
            {PROVIDERS.map((provider) => {
              const config = settings.providers[provider];
              return (
                <Card key={provider}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{PROVIDER_LABELS[provider]}</CardTitle>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={config.enabled}
                          onChange={(e) => updateProvider(provider, "enabled", e.target.checked)}
                        />
                        <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-blue-300" />
                      </label>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${provider}-key`}>API Key</Label>
                      <div className="relative">
                        <Input
                          id={`${provider}-key`}
                          type={visibleKeys[provider] ? "text" : "password"}
                          placeholder={`Enter ${PROVIDER_LABELS[provider]} API key`}
                          value={config.apiKey}
                          onChange={(e) => updateProvider(provider, "apiKey", e.target.value)}
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          onClick={() => toggleKeyVisibility(provider)}
                        >
                          {visibleKeys[provider] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${provider}-budget`}>Daily Budget ($)</Label>
                      <Input
                        id={`${provider}-budget`}
                        type="number"
                        min={0}
                        step={1}
                        value={config.dailyBudget}
                        onChange={(e) => updateProvider(provider, "dailyBudget", parseFloat(e.target.value) || 0)}
                        className="w-32"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle>Monitoring Configuration</CardTitle>
              <CardDescription>Configure how probes are scheduled and how you receive alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="cron">Default Schedule (cron expression)</Label>
                <Input
                  id="cron"
                  value={settings.monitoring.defaultSchedule}
                  onChange={(e) => updateMonitoring("defaultSchedule", e.target.value)}
                  placeholder="0 9 * * 1"
                  className="w-64"
                />
                <p className="text-xs text-gray-500">
                  {cronToHuman(settings.monitoring.defaultSchedule)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batchSize">Batch Size</Label>
                <Input
                  id="batchSize"
                  type="number"
                  min={1}
                  max={100}
                  value={settings.monitoring.batchSize}
                  onChange={(e) => updateMonitoring("batchSize", parseInt(e.target.value, 10) || 1)}
                  className="w-32"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Alerts Enabled</Label>
                  <p className="text-xs text-gray-500">Generate alerts when citation rates change significantly</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={settings.monitoring.alertsEnabled}
                    onChange={(e) => updateMonitoring("alertsEnabled", e.target.checked)}
                  />
                  <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-blue-300" />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-xs text-gray-500">Receive alerts via email</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={settings.monitoring.emailNotifications}
                      onChange={(e) => updateMonitoring("emailNotifications", e.target.checked)}
                    />
                    <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-blue-300" />
                  </label>
                </div>
                {settings.monitoring.emailNotifications && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Notification Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="alerts@example.com"
                      value={settings.monitoring.notificationEmail}
                      onChange={(e) => updateMonitoring("notificationEmail", e.target.value)}
                      className="w-80"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scoring Tab */}
        <TabsContent value="scoring">
          <Card>
            <CardHeader>
              <CardTitle>Scoring Weights</CardTitle>
              <CardDescription>
                Adjust how the AEO score is calculated. Weights are automatically normalized to sum to 1.0.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {(
                  [
                    { key: "structuralWeight", label: "Structural" },
                    { key: "citationWeight", label: "Citation Validation" },
                    { key: "competitiveWeight", label: "Competitive Gap" },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{label}</Label>
                      <span className="text-sm font-medium text-gray-700">
                        {(settings.scoring[key] * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(settings.scoring[key] * 100)}
                      onChange={(e) => updateScoringWeight(key, parseInt(e.target.value, 10) / 100)}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
                    />
                  </div>
                ))}

                <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                  Total:{" "}
                  <span className="font-semibold">
                    {(
                      (settings.scoring.structuralWeight +
                        settings.scoring.citationWeight +
                        settings.scoring.competitiveWeight) *
                      100
                    ).toFixed(0)}
                    %
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Validate</Label>
                  <p className="text-xs text-gray-500">Run citation tests automatically on content generation</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={settings.scoring.autoValidate}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        scoring: { ...prev.scoring, autoValidate: e.target.checked },
                      }))
                    }
                  />
                  <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-4 peer-focus:ring-blue-300" />
                </label>
              </div>

              <div className="space-y-2">
                <Label>Validation Providers</Label>
                <p className="text-xs text-gray-500">Which providers to use for citation validation tests</p>
                <div className="flex flex-wrap gap-3 pt-1">
                  {PROVIDERS.map((provider) => (
                    <label key={provider} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.scoring.validationProviders.includes(provider)}
                        onChange={() => toggleValidationProvider(provider)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{PROVIDER_LABELS[provider]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
