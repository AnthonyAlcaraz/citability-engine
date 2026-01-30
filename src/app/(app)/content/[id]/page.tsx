"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Pencil,
  Save,
  RefreshCw,
  Zap,
  ChevronRight,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentItem {
  id: string;
  title: string;
  body: string;
  status: string;
  aeoScore: number | null;
  scoring: ScoringResult | null;
}

interface ScoringResult {
  overallScore: number;
  structural: SubScore;
  citation: SubScore;
  competitive: SubScore;
  recommendations: Recommendation[];
}

interface SubScore {
  score: number;
  weight: number;
  factors?: StructuralFactor[];
  probeResults?: ProbeResultItem[];
  brandRate?: number;
  competitorAvgRate?: number;
}

interface StructuralFactor {
  name: string;
  passed: boolean;
  detail: string;
}

interface ProbeResultItem {
  query: string;
  provider: string;
  cited: boolean;
  position: number | null;
  sentiment: string;
}

interface Recommendation {
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  impact: string;
}

interface OptimizationResult {
  estimatedImprovement: number;
  optimizedContent: string;
  changes: OptimizationChange[];
}

interface OptimizationChange {
  section: string;
  reason: string;
  before: string;
  after: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

function scoreBgColor(score: number): string {
  if (score >= 70) return "bg-green-100 border-green-300";
  if (score >= 40) return "bg-yellow-100 border-yellow-300";
  return "bg-red-100 border-red-300";
}

function scoreRingColor(score: number): string {
  if (score >= 70) return "ring-green-400";
  if (score >= 40) return "ring-yellow-400";
  return "ring-red-400";
}

const priorityConfig: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-gray-100 text-gray-700",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [content, setContent] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [savingContent, setSavingContent] = useState(false);

  // Scoring state
  const [scoring, setScoring] = useState(false);

  // Optimization state
  const [optimizing, setOptimizing] = useState(false);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [applyingChanges, setApplyingChanges] = useState(false);

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch(`/api/content/${id}`);
      if (!res.ok) throw new Error("Failed to load content");
      const data: ContentItem = await res.json();
      setContent(data);
      setEditBody(data.body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const saveContent = async () => {
    setSavingContent(true);
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody }),
      });
      if (!res.ok) throw new Error("Failed to save content");
      const updated = await res.json();
      setContent(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingContent(false);
    }
  };

  const runScoring = async (quickOnly = false) => {
    setScoring(true);
    setError(null);
    try {
      const res = await fetch("/api/scoring/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: id,
          skipCitationTest: quickOnly,
        }),
      });
      if (!res.ok) throw new Error("Scoring failed");
      const result = await res.json();
      setContent((prev) =>
        prev ? { ...prev, aeoScore: result.overallScore, scoring: result } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setScoring(false);
    }
  };

  const runOptimization = async () => {
    setOptimizing(true);
    setError(null);
    setOptimization(null);
    try {
      const res = await fetch("/api/content/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: id }),
      });
      if (!res.ok) throw new Error("Optimization failed");
      const result: OptimizationResult = await res.json();
      setOptimization(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Optimization failed");
    } finally {
      setOptimizing(false);
    }
  };

  const applyOptimization = async () => {
    if (!optimization) return;
    setApplyingChanges(true);
    try {
      const res = await fetch(`/api/content/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: optimization.optimizedContent }),
      });
      if (!res.ok) throw new Error("Failed to apply changes");
      const updated = await res.json();
      setContent(updated);
      setEditBody(updated.body);
      setOptimization(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply changes");
    } finally {
      setApplyingChanges(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Content not found.</p>
      </div>
    );
  }

  const scoring_ = content.scoring;
  const aeoScore = content.aeoScore ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{content.title}</h1>
            <Badge variant="outline" className="mt-1">
              {content.status}
            </Badge>
          </div>
        </div>
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full border-4 ${scoreBgColor(aeoScore)} ring-2 ${scoreRingColor(aeoScore)}`}
        >
          <span className={`text-xl font-bold ${scoreColor(aeoScore)}`}>
            {aeoScore}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="scoring">AEO Score Breakdown</TabsTrigger>
          <TabsTrigger value="optimize">Optimize</TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Content Body</CardTitle>
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <Button variant="outline" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                      <Button onClick={saveContent} disabled={savingContent}>
                        {savingContent ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={20}
                  className="min-h-[400px] font-mono text-sm"
                />
              ) : (
                <div className="prose max-w-none whitespace-pre-wrap text-sm text-gray-700">
                  {content.body}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scoring Tab */}
        <TabsContent value="scoring">
          <div className="space-y-4">
            {/* Score Actions */}
            <div className="flex gap-3">
              <Button onClick={() => runScoring(false)} disabled={scoring}>
                {scoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Re-Score
              </Button>
              <Button variant="outline" onClick={() => runScoring(true)} disabled={scoring}>
                {scoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Quick Score (structural only)
              </Button>
            </div>

            {/* Overall Score */}
            <Card>
              <CardContent className="flex items-center gap-6 pt-6">
                <div
                  className={`flex h-24 w-24 items-center justify-center rounded-full border-4 ${scoreBgColor(aeoScore)}`}
                >
                  <span className={`text-3xl font-bold ${scoreColor(aeoScore)}`}>
                    {aeoScore}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">Overall AEO Score</p>
                  <p className="text-sm text-gray-500">
                    Composite score based on structural quality, citation validation, and competitive gap
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Sub-Scores */}
            {scoring_ && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Structural */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Structural</CardTitle>
                    <CardDescription>
                      Weight: {(scoring_.structural.weight * 100).toFixed(0)}% | Score:{" "}
                      <span className={scoreColor(scoring_.structural.score)}>
                        {scoring_.structural.score.toFixed(1)}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {scoring_.structural.factors && scoring_.structural.factors.length > 0 ? (
                      <ul className="space-y-2">
                        {scoring_.structural.factors.map((factor, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            {factor.passed ? (
                              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                            ) : (
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                            )}
                            <div>
                              <span className="font-medium">{factor.name}</span>
                              <p className="text-xs text-gray-500">{factor.detail}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-400">No structural factors available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Citation Validation */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Citation Validation</CardTitle>
                    <CardDescription>
                      Weight: {(scoring_.citation.weight * 100).toFixed(0)}% | Score:{" "}
                      <span className={scoreColor(scoring_.citation.score)}>
                        {scoring_.citation.score.toFixed(1)}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {scoring_.citation.probeResults && scoring_.citation.probeResults.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-left text-gray-500">
                              <th className="pb-2 pr-2 font-medium">Query</th>
                              <th className="pb-2 pr-2 font-medium">Provider</th>
                              <th className="pb-2 pr-2 font-medium">Cited?</th>
                              <th className="pb-2 pr-2 font-medium">Pos</th>
                              <th className="pb-2 font-medium">Sentiment</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scoring_.citation.probeResults.map((probe, idx) => (
                              <tr key={idx} className="border-b last:border-0">
                                <td className="py-2 pr-2 text-gray-700">{probe.query}</td>
                                <td className="py-2 pr-2 text-gray-600">{probe.provider}</td>
                                <td className="py-2 pr-2">
                                  {probe.cited ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-400" />
                                  )}
                                </td>
                                <td className="py-2 pr-2 text-gray-600">
                                  {probe.position !== null ? `#${probe.position}` : "--"}
                                </td>
                                <td className="py-2 text-gray-600">{probe.sentiment}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">
                        No citation test results. Run a full re-score to generate them.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Competitive Gap */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Competitive Gap</CardTitle>
                    <CardDescription>
                      Weight: {(scoring_.competitive.weight * 100).toFixed(0)}% | Score:{" "}
                      <span className={scoreColor(scoring_.competitive.score)}>
                        {scoring_.competitive.score.toFixed(1)}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Your Rate</span>
                      <span className="font-semibold">
                        {scoring_.competitive.brandRate !== undefined
                          ? `${scoring_.competitive.brandRate}%`
                          : "--"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Competitor Avg</span>
                      <span className="font-semibold">
                        {scoring_.competitive.competitorAvgRate !== undefined
                          ? `${scoring_.competitive.competitorAvgRate}%`
                          : "--"}
                      </span>
                    </div>
                    {scoring_.competitive.brandRate !== undefined &&
                      scoring_.competitive.competitorAvgRate !== undefined && (
                        <div className="rounded-md bg-gray-50 p-3 text-center">
                          <span className="text-sm text-gray-500">Gap: </span>
                          <span
                            className={`text-lg font-bold ${
                              scoring_.competitive.brandRate >= scoring_.competitive.competitorAvgRate
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {scoring_.competitive.brandRate >= scoring_.competitive.competitorAvgRate
                              ? "+"
                              : ""}
                            {(
                              scoring_.competitive.brandRate - scoring_.competitive.competitorAvgRate
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                      )}
                  </CardContent>
                </Card>
              </div>
            )}

            {!scoring_ && (
              <Card>
                <CardContent className="py-12 text-center text-sm text-gray-400">
                  No scoring data available. Run a score to see the breakdown.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Optimize Tab */}
        <TabsContent value="optimize">
          <div className="space-y-4">
            <Button onClick={runOptimization} disabled={optimizing}>
              {optimizing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {optimizing ? "Optimizing..." : "Optimize Content"}
            </Button>

            {optimizing && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="mb-4 h-12 w-12 animate-spin text-blue-400" />
                  <p className="text-lg font-medium text-gray-600">Optimizing content...</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Analyzing structure and generating improvements
                  </p>
                </CardContent>
              </Card>
            )}

            {optimization && (
              <>
                {/* Improvement estimate */}
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="flex items-center gap-4 pt-6">
                    <TrendingUp className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-lg font-semibold text-green-800">
                        Estimated Improvement: +{optimization.estimatedImprovement} points
                      </p>
                      <p className="text-sm text-green-700">
                        {optimization.changes.length} change{optimization.changes.length !== 1 ? "s" : ""}{" "}
                        recommended
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Changes list */}
                <Card>
                  <CardHeader>
                    <CardTitle>Proposed Changes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {optimization.changes.map((change, idx) => (
                      <div key={idx} className="rounded-md border p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant="outline">{change.section}</Badge>
                          <span className="text-sm text-gray-500">{change.reason}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs font-medium text-red-600">Before</p>
                            <pre className="overflow-x-auto rounded bg-red-50 p-3 text-xs text-gray-700">
                              {change.before}
                            </pre>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-medium text-green-600">After</p>
                            <pre className="overflow-x-auto rounded bg-green-50 p-3 text-xs text-gray-700">
                              {change.after}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button onClick={applyOptimization} disabled={applyingChanges}>
                    {applyingChanges ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Apply Changes
                  </Button>
                  <Button variant="outline" onClick={() => setOptimization(null)}>
                    Discard
                  </Button>
                </div>
              </>
            )}

            {!optimization && !optimizing && (
              <Card>
                <CardContent className="py-12 text-center text-sm text-gray-400">
                  Click "Optimize Content" to generate AI-powered improvements for this content.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Recommendations Section */}
      {scoring_ && scoring_.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>Actions to improve your AEO score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scoring_.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-md border p-4">
                  <div className="flex shrink-0 flex-col items-start gap-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${priorityConfig[rec.priority] ?? priorityConfig.low}`}
                    >
                      {rec.priority}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {rec.category}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{rec.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{rec.description}</p>
                    <p className="mt-1 text-xs text-gray-500">Impact: {rec.impact}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
