"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  AlertTriangle,
  Shield,
  Target,
  Loader2,
  Swords,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Brand {
  id: string;
  name: string;
  domain: string;
}

interface CompetitorProfile {
  name: string;
  domain: string;
  citationRate: number;
  avgPosition: number | null;
  avgSentiment: "positive" | "neutral" | "negative";
  strongCategories: string[];
  weakCategories: string[];
}

interface CompetitiveInsight {
  type: "opportunity" | "threat" | "strength" | "weakness";
  title: string;
  description: string;
  relatedCompetitor: string | null;
  suggestedAction: string;
}

interface CompetitiveAnalysis {
  brandCitationRate: number;
  competitors: CompetitorProfile[];
  insights: CompetitiveInsight[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rateColor(rate: number): string {
  if (rate >= 60) return "text-green-600";
  if (rate >= 30) return "text-yellow-600";
  return "text-red-600";
}

function rateBg(rate: number): string {
  if (rate >= 60) return "bg-green-50";
  if (rate >= 30) return "bg-yellow-50";
  return "bg-red-50";
}

function sentimentBadgeColor(sentiment: string): string {
  if (sentiment === "positive") return "bg-green-100 text-green-800";
  if (sentiment === "negative") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}

const insightConfig: Record<
  string,
  { color: string; bg: string; border: string; icon: typeof TrendingUp }
> = {
  opportunity: { color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: TrendingUp },
  threat: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: AlertTriangle },
  strength: { color: "text-green-700", bg: "bg-green-50", border: "border-green-200", icon: Shield },
  weakness: { color: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-200", icon: Target },
};

const insightBadgeColor: Record<string, string> = {
  opportunity: "bg-blue-100 text-blue-800",
  threat: "bg-red-100 text-red-800",
  strength: "bg-green-100 text-green-800",
  weakness: "bg-yellow-100 text-yellow-800",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CompetitivePage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [analysis, setAnalysis] = useState<CompetitiveAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBrands() {
      try {
        const res = await fetch("/api/brand");
        if (!res.ok) throw new Error("Failed to load brands");
        const data = await res.json();
        const brandList = Array.isArray(data) ? data : data.brands ?? [];
        setBrands(brandList);
        if (brandList.length > 0) {
          setSelectedBrandId(brandList[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load brands");
      } finally {
        setLoading(false);
      }
    }
    loadBrands();
  }, []);

  const runAnalysis = async () => {
    if (!selectedBrandId) return;
    setRunning(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch("/api/competitive/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: selectedBrandId }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data: CompetitiveAnalysis = await res.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setRunning(false);
    }
  };

  const topCompetitor = analysis?.competitors.reduce<CompetitorProfile | null>(
    (top, c) => (!top || c.citationRate > top.citationRate ? c : top),
    null
  );

  const totalProbes = analysis
    ? analysis.competitors.length > 0
      ? analysis.competitors.length
      : 0
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Swords className="h-6 w-6" />
            Competitive Analysis
          </h1>
          <p className="text-sm text-gray-500">
            Compare your brand citation performance against competitors
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-48">
            <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
              <SelectTrigger>
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={runAnalysis} disabled={running || !selectedBrandId}>
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Swords className="h-4 w-4" />
            )}
            {running ? "Running..." : "Run Analysis"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!analysis && !running && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Swords className="mb-4 h-12 w-12 text-gray-300" />
            <p className="text-lg font-medium text-gray-500">No analysis yet</p>
            <p className="mt-1 text-sm text-gray-400">
              Run a competitive analysis to see how your brand stacks up against competitors
            </p>
          </CardContent>
        </Card>
      )}

      {/* Running State */}
      {running && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-blue-400" />
            <p className="text-lg font-medium text-gray-600">
              Running competitive analysis...
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Querying AI providers and analyzing citation patterns
            </p>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && !running && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className={rateBg(analysis.brandCitationRate)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Your Citation Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${rateColor(analysis.brandCitationRate)}`}>
                  {analysis.brandCitationRate}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Top Competitor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topCompetitor ? (
                  <>
                    <p className="text-lg font-bold text-gray-900">{topCompetitor.name}</p>
                    <p className={`text-2xl font-bold ${rateColor(topCompetitor.citationRate)}`}>
                      {topCompetitor.citationRate}%
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No competitors found</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Gap</CardTitle>
              </CardHeader>
              <CardContent>
                {topCompetitor ? (
                  <p
                    className={`text-3xl font-bold ${
                      analysis.brandCitationRate >= topCompetitor.citationRate
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {analysis.brandCitationRate >= topCompetitor.citationRate ? "+" : ""}
                    {analysis.brandCitationRate - topCompetitor.citationRate}%
                  </p>
                ) : (
                  <p className="text-3xl font-bold text-gray-400">--</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Competitors Analyzed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">
                  {analysis.competitors.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Competitor Profiles Table */}
          <Card>
            <CardHeader>
              <CardTitle>Competitor Profiles</CardTitle>
              <CardDescription>Citation performance breakdown by competitor</CardDescription>
            </CardHeader>
            <CardContent>
              {analysis.competitors.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  No competitor data available.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-3 pr-4 font-medium">Competitor</th>
                        <th className="pb-3 pr-4 font-medium">Citation Rate</th>
                        <th className="pb-3 pr-4 font-medium">Avg Position</th>
                        <th className="pb-3 pr-4 font-medium">Sentiment</th>
                        <th className="pb-3 pr-4 font-medium">Strong Categories</th>
                        <th className="pb-3 font-medium">Weak Categories</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.competitors.map((comp) => (
                        <tr key={comp.name} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium text-gray-900">{comp.name}</td>
                          <td className="py-3 pr-4">
                            <span className={`font-semibold ${rateColor(comp.citationRate)}`}>
                              {comp.citationRate}%
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-gray-600">
                            {comp.avgPosition !== null ? `#${comp.avgPosition}` : "--"}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sentimentBadgeColor(comp.avgSentiment)}`}
                            >
                              {comp.avgSentiment}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-1">
                              {comp.strongCategories.length > 0 ? (
                                comp.strongCategories.map((cat) => (
                                  <Badge key={cat} className="bg-green-100 text-green-800">
                                    {cat}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap gap-1">
                              {comp.weakCategories.length > 0 ? (
                                comp.weakCategories.map((cat) => (
                                  <Badge key={cat} className="bg-red-100 text-red-800">
                                    {cat}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insights */}
          {analysis.insights.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Insights</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {analysis.insights.map((insight, idx) => {
                  const config = insightConfig[insight.type];
                  const IconComponent = config.icon;
                  return (
                    <Card key={idx} className={`border ${config.border} ${config.bg}`}>
                      <CardContent className="pt-6">
                        <div className="mb-3 flex items-start gap-3">
                          <IconComponent className={`mt-0.5 h-5 w-5 ${config.color}`} />
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${insightBadgeColor[insight.type]}`}
                              >
                                {insight.type}
                              </span>
                            </div>
                            <h3 className={`font-semibold ${config.color}`}>{insight.title}</h3>
                            <p className="mt-1 text-sm text-gray-600">{insight.description}</p>
                            <p className="mt-2 text-sm font-medium text-gray-700">
                              Action: {insight.suggestedAction}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>Prioritized actions to improve your AI citation performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {analysis.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {idx + 1}
                      </span>
                      <p className="text-sm text-gray-700">{rec}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
