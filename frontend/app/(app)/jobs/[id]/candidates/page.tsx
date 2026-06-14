"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";

interface BiasFlag {
  id: string;
  flag_type: string;
  severity: string;
  explanation: string;
  acknowledged: boolean;
}

interface ScoreBreakdown {
  skills_match: number;
  role_relevance: number;
  years_experience: number;
  education: number;
  career_progression: number;
  certifications: number;
}

interface Candidate {
  id: string;
  candidate_name: string;
  email: string;
  status: string;
  total_score: number;
  score_breakdown: ScoreBreakdown;
  bias_flags: BiasFlag[];
  justification: string | null;
  created_at: string;
}

interface RoundFeedback {
  round_number: number;
  round_label: string;
  scheduled_at: string | null;
  status: string;
  teams_meeting_url: string | null;
  feedback: {
    technical_score: number;
    communication_score: number;
    problem_solving_score: number;
    cultural_fit_score: number;
    recommendation: string;
    comments: string;
    strengths: string[];
    weaknesses: string[];
  } | null;
}

const statusColor: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  parsing: "bg-blue-100 text-blue-600",
  scored: "bg-purple-100 text-purple-600",
  shortlisted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  hired: "bg-emerald-100 text-emerald-700",
  no_hire: "bg-red-100 text-red-700",
  parse_error: "bg-orange-100 text-orange-600",
};

const severityColor: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

const scoreWeights: { key: keyof ScoreBreakdown; label: string; weight: number }[] = [
  { key: "skills_match", label: "Skills Match", weight: 35 },
  { key: "role_relevance", label: "Role Relevance", weight: 25 },
  { key: "years_experience", label: "Experience", weight: 20 },
  { key: "education", label: "Education", weight: 10 },
  { key: "career_progression", label: "Career Growth", weight: 5 },
  { key: "certifications", label: "Certifications", weight: 5 },
];

const recColor: Record<string, string> = {
  hire: "text-green-600", maybe: "text-yellow-600", no_hire: "text-red-600",
};

export default function CandidatesPage() {
  const { id: jobId } = useParams<{ id: string }>();
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [justification, setJustification] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [rounds, setRounds] = useState<RoundFeedback[]>([]);
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"score" | "rounds" | "history">("score");
  const [history, setHistory] = useState<{ action: string; performed_by: string; at: string; payload: Record<string, unknown> }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = () => {
    api.get(`/jobs/${jobId}/candidates`)
      .then((r) => setCandidates(r.data.sort((a: Candidate, b: Candidate) => b.total_score - a.total_score)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [jobId]);

  const openCandidate = async (c: Candidate) => {
    setSelected(c);
    setJustification(c.justification ?? "");
    setActiveTab("score");
    setHistory([]);
    setRoundsLoading(true);
    try {
      const res = await api.get(`/resumes/${c.id}/feedback`);
      setRounds(res.data);
    } catch { setRounds([]); }
    finally { setRoundsLoading(false); }
  };

  const loadHistory = async (candidateId: string) => {
    setHistoryLoading(true);
    try {
      const res = await api.get(`/resumes/${candidateId}/audit`);
      setHistory(res.data);
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  };

  const retryParse = async (candidateId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/resumes/${candidateId}/retry`);
      toast.success("Re-queued for parsing — refresh in a moment");
      load(); setSelected(null);
    } catch { toast.error("Failed to retry"); }
    finally { setActionLoading(false); }
  };

  const ackBiasFlag = async (flagId: string) => {
    await api.patch(`/bias-flags/${flagId}/ack`);
    toast.success("Flag acknowledged");
    load();
    if (selected) {
      const res = await api.get(`/jobs/${jobId}/candidates`);
      const updated = res.data.find((c: Candidate) => c.id === selected.id);
      if (updated) setSelected(updated);
    }
  };

  const saveJustification = async () => {
    if (!selected) return;
    await api.patch(`/resumes/${selected.id}/justification`, { justification });
    toast.success("Notes saved");
  };

  const approve = async (candidateId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/resumes/${candidateId}/approve`);
      toast.success("Shortlisted — Round 1 interview scheduling triggered!");
      load(); setSelected(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Failed to approve");
    } finally { setActionLoading(false); }
  };

  const reject = async (candidateId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/resumes/${candidateId}/reject`);
      toast.success("Candidate rejected");
      load(); setSelected(null);
    } catch { toast.error("Failed to reject"); }
    finally { setActionLoading(false); }
  };

  const finalDecision = async (candidateId: string, decision: "hire" | "no_hire") => {
    setActionLoading(true);
    try {
      await api.post(`/resumes/${candidateId}/decision`, { decision });
      toast.success(decision === "hire" ? "Marked as Hired!" : "Marked as No Hire");
      load(); setSelected(null);
    } catch { toast.error("Failed to record decision"); }
    finally { setActionLoading(false); }
  };

  const unackedFlags = (c: Candidate) => c.bias_flags?.filter((f) => !f.acknowledged) ?? [];
  const allRoundsComplete = rounds.length === 3 && rounds.every((r) => r.feedback !== null);

  if (loading) return <p className="text-gray-500">Loading candidates...</p>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push("/jobs")}>← Back</Button>
        <h1 className="text-2xl font-bold text-gray-900">Candidates ({candidates.length})</h1>
        <Button size="sm" variant="outline" onClick={() => router.push(`/jobs/${jobId}/upload`)}>+ Upload More</Button>
      </div>

      {candidates.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">No candidates yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {candidates.map((c, rank) => {
            const unacked = unackedFlags(c);
            return (
              <Card key={c.id} className={`cursor-pointer hover:shadow-md transition-shadow ${unacked.length > 0 ? "border-yellow-300" : ""}`}
                onClick={() => openCandidate(c)}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-gray-300 w-8">#{rank + 1}</span>
                    <div>
                      <p className="font-semibold text-gray-900">{c.candidate_name || "Unknown"}</p>
                      <p className="text-sm text-gray-500">{c.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {unacked.length > 0 && (
                      <span className="text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-300 px-2 py-1 rounded-full">
                        {unacked.length} bias flag{unacked.length > 1 ? "s" : ""}
                      </span>
                    )}
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{c.total_score?.toFixed(1) ?? "–"}</p>
                      <p className="text-xs text-gray-400">/ 100</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {c.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selected.candidate_name || "Candidate"}</DialogTitle>
              <p className="text-sm text-gray-500">{selected.email}</p>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Status + Score row */}
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold text-blue-600">
                  {selected.total_score?.toFixed(1) ?? "–"}
                  <span className="text-lg text-gray-400"> / 100</span>
                </p>
                <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${statusColor[selected.status] ?? ""}`}>
                  {selected.status}
                </span>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 border-b">
                {(["score", "rounds", "history"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab === "history" && selected && history.length === 0) loadHistory(selected.id);
                    }}
                    className={`pb-2 px-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                      activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab === "score" ? "Score & Flags"
                      : tab === "rounds" ? `Rounds${rounds.length ? ` (${rounds.length}/3)` : ""}`
                      : "History"}
                  </button>
                ))}
              </div>

              {/* Score tab */}
              {activeTab === "score" && (
                <>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Score Breakdown</p>
                    <div className="space-y-1.5">
                      {scoreWeights.map(({ key, label, weight }) => {
                        const val = selected.score_breakdown?.[key] ?? 0;
                        const contribution = (val * weight) / 100;
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 w-28">{label}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${val >= 70 ? "bg-green-500" : val >= 40 ? "bg-blue-500" : "bg-red-400"}`}
                                style={{ width: `${Math.min(val, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700 w-20 text-right">
                              {val.toFixed(0)}/100
                              <span className="text-gray-400 ml-1">({contribution.toFixed(1)}pt)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selected.bias_flags?.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Bias Flags</p>
                      <div className="space-y-2">
                        {selected.bias_flags.map((flag) => (
                          <div key={flag.id} className={`border rounded-lg p-3 ${severityColor[flag.severity] ?? ""}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-semibold uppercase">{flag.flag_type.replace(/_/g, " ")} — {flag.severity}</p>
                                <p className="text-xs mt-1">{flag.explanation}</p>
                              </div>
                              {!flag.acknowledged ? (
                                <Button size="sm" variant="outline" className="text-xs shrink-0"
                                  onClick={(e) => { e.stopPropagation(); ackBiasFlag(flag.id); }}>
                                  Acknowledge
                                </Button>
                              ) : <span className="text-xs text-green-600 shrink-0">✓ Acked</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Recruiter Notes</Label>
                    <Textarea className="mt-1" rows={3} placeholder="Notes on selection or rejection..."
                      value={justification} onChange={(e) => setJustification(e.target.value)} />
                    <Button size="sm" variant="outline" className="mt-2" onClick={saveJustification}>Save Notes</Button>
                  </div>
                </>
              )}

              {/* Rounds tab */}
              {activeTab === "rounds" && (
                <div className="space-y-3">
                  {roundsLoading ? (
                    <p className="text-sm text-gray-400">Loading rounds...</p>
                  ) : rounds.length === 0 ? (
                    <p className="text-sm text-gray-400">No interviews scheduled yet.</p>
                  ) : (
                    rounds.map((r) => (
                      <div key={r.round_number} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-gray-800">Round {r.round_number}: {r.round_label}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            r.status === "completed" ? "bg-green-100 text-green-700" :
                            r.status === "scheduled" ? "bg-blue-100 text-blue-600" :
                            "bg-gray-100 text-gray-600"
                          }`}>{r.status}</span>
                        </div>
                        {r.scheduled_at && (
                          <p className="text-xs text-gray-500 mb-2">
                            {new Date(r.scheduled_at).toLocaleString()}
                            {r.teams_meeting_url && (
                              <a href={r.teams_meeting_url} target="_blank" rel="noreferrer"
                                className="ml-2 text-blue-600 underline">Join Teams</a>
                            )}
                          </p>
                        )}
                        {r.feedback ? (
                          <div className="bg-gray-50 rounded p-3 mt-2 space-y-1">
                            <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                              <span>Technical: <strong>{r.feedback.technical_score}/10</strong></span>
                              <span>Communication: <strong>{r.feedback.communication_score}/10</strong></span>
                              <span>Problem Solving: <strong>{r.feedback.problem_solving_score}/10</strong></span>
                              <span>Cultural Fit: <strong>{r.feedback.cultural_fit_score}/10</strong></span>
                            </div>
                            <p className={`text-sm font-semibold mt-1 ${recColor[r.feedback.recommendation] ?? ""}`}>
                              Recommendation: {r.feedback.recommendation.replace("_", " ")}
                            </p>
                            {r.feedback.comments && <p className="text-xs text-gray-600 mt-1">{r.feedback.comments}</p>}
                            {r.feedback.strengths?.length > 0 && (
                              <p className="text-xs text-green-700">✓ {r.feedback.strengths.join(", ")}</p>
                            )}
                            {r.feedback.weaknesses?.length > 0 && (
                              <p className="text-xs text-red-600">✗ {r.feedback.weaknesses.join(", ")}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 mt-1">Awaiting feedback...</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* History tab */}
              {activeTab === "history" && (
                <div className="space-y-2">
                  {historyLoading ? (
                    <p className="text-sm text-gray-400">Loading history...</p>
                  ) : history.length === 0 ? (
                    <p className="text-sm text-gray-400">No audit events recorded yet.</p>
                  ) : (
                    history.map((entry, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{entry.action.replace(/_/g, " ")}</p>
                          <p className="text-xs text-gray-400">{new Date(entry.at).toLocaleString()}</p>
                          {entry.payload && Object.keys(entry.payload).length > 0 && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {Object.entries(entry.payload).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Action buttons */}
              {selected.status === "parse_error" && (
                <div className="flex gap-3 pt-2 border-t">
                  <Button
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                    disabled={actionLoading}
                    onClick={() => retryParse(selected.id)}
                  >
                    Retry Parsing
                  </Button>
                </div>
              )}

              {(selected.status === "scored" || selected.status === "pending") && (
                <div className="flex gap-3 pt-2 border-t">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={actionLoading || unackedFlags(selected).length > 0}
                    onClick={() => approve(selected.id)}>
                    {unackedFlags(selected).length > 0 ? "Acknowledge Bias Flags First" : "Shortlist & Schedule Interview"}
                  </Button>
                  <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    disabled={actionLoading} onClick={() => reject(selected.id)}>
                    Reject
                  </Button>
                </div>
              )}

              {/* Final decision after all 3 rounds complete */}
              {selected.status === "shortlisted" && allRoundsComplete && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-semibold text-gray-700 mb-3">All 3 rounds complete — final decision:</p>
                  <div className="flex gap-3">
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      disabled={actionLoading} onClick={() => finalDecision(selected.id, "hire")}>
                      Hire
                    </Button>
                    <Button variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={actionLoading} onClick={() => finalDecision(selected.id, "no_hire")}>
                      No Hire
                    </Button>
                  </div>
                </div>
              )}

              {/* Manual final decision for shortlisted candidates (override) */}
              {selected.status === "shortlisted" && !allRoundsComplete && rounds.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-400 mb-2">Override: record decision before all rounds complete</p>
                  <div className="flex gap-3">
                    <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200"
                      disabled={actionLoading} onClick={() => finalDecision(selected.id, "hire")}>
                      Mark Hired
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200"
                      disabled={actionLoading} onClick={() => finalDecision(selected.id, "no_hire")}>
                      Mark No Hire
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
