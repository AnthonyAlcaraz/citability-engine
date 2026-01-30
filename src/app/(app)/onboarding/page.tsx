"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Key,
  Search,
  Play,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Competitor {
  name: string;
  domain: string;
}

interface ProbeItem {
  query: string;
  category: string;
}

interface ProviderKey {
  provider: string;
  apiKey: string;
  tested: boolean;
}

interface FirstRunResult {
  probesRun: number;
  citationsFound: number;
  citationRate: number;
}

const STEPS = [
  { label: "Brand Setup", icon: Building2 },
  { label: "Connect Providers", icon: Key },
  { label: "Create Probes", icon: Search },
  { label: "First Run", icon: Play },
];

const PROVIDERS = [
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { id: "google", label: "Google", placeholder: "AIza..." },
  { id: "perplexity", label: "Perplexity", placeholder: "pplx-..." },
];

const PROBE_CATEGORIES = [
  "general",
  "comparison",
  "recommendation",
  "how-to",
  "review",
  "pricing",
  "alternatives",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Step 1: Brand
  const [brandName, setBrandName] = useState("");
  const [brandDomain, setBrandDomain] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [brandKeywords, setBrandKeywords] = useState("");
  const [competitors, setCompetitors] = useState<Competitor[]>([
    { name: "", domain: "" },
  ]);

  // Step 2: Providers
  const [providerKeys, setProviderKeys] = useState<ProviderKey[]>(
    PROVIDERS.map((p) => ({ provider: p.id, apiKey: "", tested: false }))
  );

  // Step 3: Probes
  const [probes, setProbes] = useState<ProbeItem[]>([]);
  const [probesGenerated, setProbesGenerated] = useState(false);

  // Step 4: First Run
  const [firstRunRunning, setFirstRunRunning] = useState(false);
  const [firstRunResult, setFirstRunResult] = useState<FirstRunResult | null>(null);
  const [runProgress, setRunProgress] = useState<string[]>([]);

  // -------------------------------------------------------------------------
  // Competitors Management
  // -------------------------------------------------------------------------

  const addCompetitor = () => {
    setCompetitors((prev) => [...prev, { name: "", domain: "" }]);
  };

  const removeCompetitor = (idx: number) => {
    setCompetitors((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCompetitor = (idx: number, field: keyof Competitor, value: string) => {
    setCompetitors((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  };

  // -------------------------------------------------------------------------
  // Provider Key Management
  // -------------------------------------------------------------------------

  const updateProviderKey = (provider: string, apiKey: string) => {
    setProviderKeys((prev) =>
      prev.map((p) => (p.provider === provider ? { ...p, apiKey, tested: false } : p))
    );
  };

  const testProviderKey = (provider: string) => {
    setProviderKeys((prev) =>
      prev.map((p) => (p.provider === provider && p.apiKey.length > 5 ? { ...p, tested: true } : p))
    );
  };

  const hasAtLeastOneKey = providerKeys.some((p) => p.apiKey.length > 5);

  // -------------------------------------------------------------------------
  // Probes Management
  // -------------------------------------------------------------------------

  const generateSuggestedProbes = () => {
    const keywords = brandKeywords
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const templates = [
      { template: (kw: string) => `What are the best ${kw}?`, category: "recommendation" },
      { template: (kw: string) => `How to choose a ${kw}?`, category: "how-to" },
      { template: (kw: string) => `${kw} comparison`, category: "comparison" },
      { template: (kw: string) => `Top ${kw} tools`, category: "recommendation" },
      { template: (kw: string) => `${kw} alternatives`, category: "alternatives" },
    ];

    const suggested: ProbeItem[] = [];
    for (const kw of keywords.slice(0, 5)) {
      for (const t of templates.slice(0, 3)) {
        suggested.push({ query: t.template(kw), category: t.category });
      }
    }

    if (suggested.length === 0 && brandName) {
      suggested.push(
        { query: `What is ${brandName}?`, category: "general" },
        { query: `${brandName} alternatives`, category: "alternatives" },
        { query: `Is ${brandName} good?`, category: "review" }
      );
    }

    setProbes(suggested);
    setProbesGenerated(true);
  };

  const addProbe = () => {
    setProbes((prev) => [...prev, { query: "", category: "general" }]);
  };

  const removeProbe = (idx: number) => {
    setProbes((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateProbe = (idx: number, field: keyof ProbeItem, value: string) => {
    setProbes((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  // -------------------------------------------------------------------------
  // Step Navigation
  // -------------------------------------------------------------------------

  const saveStep = async (step: string) => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { step };

      if (step === "brand") {
        body.brand = {
          name: brandName,
          domain: brandDomain,
          description: brandDescription,
          keywords: brandKeywords.split(",").map((k) => k.trim()).filter(Boolean),
          competitors: competitors.filter((c) => c.name && c.domain),
        };
      } else if (step === "providers") {
        body.providers = providerKeys
          .filter((p) => p.apiKey.length > 0)
          .reduce(
            (acc, p) => {
              acc[p.provider] = p.apiKey;
              return acc;
            },
            {} as Record<string, string>
          );
      } else if (step === "probes") {
        body.probes = probes.filter((p) => p.query.length > 0);
      } else if (step === "first-run") {
        body.completed = true;
      }

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save step");

      if (step === "first-run") {
        router.replace("/dashboard");
        return;
      }

      setCurrentStep((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const runFirstCheck = async () => {
    setFirstRunRunning(true);
    setError(null);
    setRunProgress([]);

    const enabledProviders = providerKeys
      .filter((p) => p.apiKey.length > 5)
      .map((p) => p.provider);

    for (const provider of enabledProviders) {
      setRunProgress((prev) => [...prev, `Querying ${provider}...`]);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step: "first-run",
          run: true,
        }),
      });

      if (!res.ok) throw new Error("First run failed");

      const data = await res.json();
      setFirstRunResult(
        data.result ?? {
          probesRun: probes.length,
          citationsFound: 0,
          citationRate: 0,
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "First run failed");
      setFirstRunResult({
        probesRun: probes.length,
        citationsFound: 0,
        citationRate: 0,
      });
    } finally {
      setFirstRunRunning(false);
      setRunProgress([]);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, idx) => {
          const StepIcon = step.icon;
          const isActive = idx === currentStep;
          const isDone = idx < currentStep;

          return (
            <div key={idx} className="flex items-center gap-2">
              {idx > 0 && (
                <div
                  className={`h-0.5 w-8 ${isDone ? "bg-blue-500" : "bg-gray-200"}`}
                />
              )}
              <div
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-100 text-blue-700"
                    : isDone
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {isDone ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <StepIcon className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{idx + 1}</span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Brand Setup */}
      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tell us about your brand</CardTitle>
            <CardDescription>
              This information helps us create relevant citation probes and track your AI visibility.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand Name</Label>
                <Input
                  id="brandName"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Acme Inc"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandDomain">Domain</Label>
                <Input
                  id="brandDomain"
                  value={brandDomain}
                  onChange={(e) => setBrandDomain(e.target.value)}
                  placeholder="acme.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brandDescription">Description</Label>
              <Textarea
                id="brandDescription"
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value)}
                placeholder="What does your company do?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Input
                id="keywords"
                value={brandKeywords}
                onChange={(e) => setBrandKeywords(e.target.value)}
                placeholder="CRM, project management, collaboration"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Competitors</Label>
                <Button variant="outline" size="sm" onClick={addCompetitor}>
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              </div>
              {competitors.map((comp, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={comp.name}
                    onChange={(e) => updateCompetitor(idx, "name", e.target.value)}
                    placeholder="Competitor name"
                    className="flex-1"
                  />
                  <Input
                    value={comp.domain}
                    onChange={(e) => updateCompetitor(idx, "domain", e.target.value)}
                    placeholder="competitor.com"
                    className="flex-1"
                  />
                  {competitors.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCompetitor(idx)}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => saveStep("brand")}
                disabled={saving || !brandName || !brandDomain}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Connect Providers */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Connect at least one AI provider</CardTitle>
            <CardDescription>
              Add API keys for the AI providers you want to monitor. You need at least one to proceed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {PROVIDERS.map((provider) => {
              const keyState = providerKeys.find((p) => p.provider === provider.id);
              const hasKey = (keyState?.apiKey.length ?? 0) > 5;
              return (
                <div
                  key={provider.id}
                  className={`rounded-lg border p-4 transition-colors ${hasKey ? "border-green-200 bg-green-50" : ""}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">{provider.label}</span>
                    </div>
                    {hasKey && keyState?.tested && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder={provider.placeholder}
                      value={keyState?.apiKey ?? ""}
                      onChange={(e) => updateProviderKey(provider.id, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testProviderKey(provider.id)}
                      disabled={!hasKey}
                    >
                      Test
                    </Button>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => saveStep("providers")}
                disabled={saving || !hasAtLeastOneKey}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Create Probes */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Create your first citation probes</CardTitle>
            <CardDescription>
              Probes are questions that will be sent to AI engines to check if your brand is cited.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!probesGenerated && (
              <Button variant="outline" onClick={generateSuggestedProbes}>
                <Sparkles className="h-4 w-4" />
                Generate Suggested Probes
              </Button>
            )}

            {probes.length > 0 && (
              <div className="space-y-3">
                {probes.map((probe, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Input
                      value={probe.query}
                      onChange={(e) => updateProbe(idx, "query", e.target.value)}
                      placeholder="Enter a probe query..."
                      className="flex-1"
                    />
                    <div className="w-40">
                      <Select
                        value={probe.category}
                        onValueChange={(val) => updateProbe(idx, "category", val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROBE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProbe(idx)}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" onClick={addProbe}>
              <Plus className="h-3 w-3" />
              Add Probe
            </Button>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => saveStep("probes")}
                disabled={saving || probes.filter((p) => p.query.length > 0).length === 0}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: First Run */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Run your first citation check</CardTitle>
            <CardDescription>
              Query AI providers with your probes and see how often your brand is cited.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!firstRunResult && !firstRunRunning && (
              <div className="flex flex-col items-center py-8">
                <Button size="lg" onClick={runFirstCheck}>
                  <Play className="h-5 w-5" />
                  Run Now
                </Button>
              </div>
            )}

            {firstRunRunning && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-blue-400" />
                <p className="mb-4 text-lg font-medium text-gray-600">Running citation check...</p>
                <div className="space-y-1">
                  {runProgress.map((msg, idx) => (
                    <p key={idx} className="text-sm text-gray-500">
                      {msg}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {firstRunResult && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-blue-50 p-6 text-center">
                    <p className="text-3xl font-bold text-blue-700">
                      {firstRunResult.probesRun}
                    </p>
                    <p className="mt-1 text-sm text-blue-600">Probes Run</p>
                  </div>
                  <div className="rounded-lg bg-green-50 p-6 text-center">
                    <p className="text-3xl font-bold text-green-700">
                      {firstRunResult.citationsFound}
                    </p>
                    <p className="mt-1 text-sm text-green-600">Citations Found</p>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-6 text-center">
                    <p className="text-3xl font-bold text-purple-700">
                      {firstRunResult.citationRate.toFixed(1)}%
                    </p>
                    <p className="mt-1 text-sm text-purple-600">Citation Rate</p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button size="lg" onClick={() => saveStep("first-run")}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Go to Dashboard
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {!firstRunRunning && !firstRunResult && (
              <div className="flex justify-start">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
