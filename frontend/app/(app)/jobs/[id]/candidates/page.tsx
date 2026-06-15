"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, AlertTriangle, CheckCircle2, Clock, Video, ThumbsUp, ThumbsDown, RotateCcw } from "lucide-react";
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

const statusConfig: Record<string, { cls: string; label: string }> = {
  pending:     { cls: "bg-gray-100 text-gray-600 border border-gray-200",       label: "Pending" },
  parsing:     { cls: "bg-blue-50 text-blue-600 border border-blue-200",        label: "Parsing…" },
  scored:      { cls: "bg-indigo-50 text-indigo-700 border border-indigo-200",  label: "Scored" },
  shortlisted: { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", label: "Shortlisted" },
  rejected:    { cls: "bg-red-50 text-red-600 border border-red-200",           label: "Rejected" },
  hired:       { cls: "bg-green-100 text-green-800 border border-green-300",    label: "Hired 🎉" },
  no_hire:     { cls: "bg-red-100 text-red-700 border border-red-300",          label: "No Hire" },
  parse_error: { cls: "bg-orange-50 text-orange-600 border border-orange-200",  label: "Parse Error" },
};

const severityConfig: Record<string, { cls: string; dot: string }> = {
  high:   { cls: "bg-red-50 border border-red-200 text-red-800",       dot: "bg-red-500" },
  medium: { cls: "bg-amber-50 border border-amber-200 text-amber-800", dot: "bg-amber-500" },
  low:    { cls: "bg-blue-50 border border-blue-200 text-blue-800",    dot: "bg-blue-400" },
};

const scoreWeights: { key: keyof ScoreBreakdown; label: string; weight: number }[] = [
  { key: "skills_match",       label: "Skills Match",   weight: 35 },
  { key: "role_relevance",     label: "Role Relevance", weight: 25 },
  { key: "years_experience",   label: "Experience",     weight: 20 },
  { key: "education",          label: "Education",      weight: 10 },
  { key: "career_progression", label: "Career Growth",  weight: 5 },
  { key: "certifications",     label: "Certifications", weight: 5 },
];

const recConfig: Record<string, { cls: string; label: string }> = {
  hire:    { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", label: "Hire" },
  maybe:   { cls: "bg-amber-50 text-amber-700 border border-amber-200",       label: "Maybe" },
  no_hire: { cls: "bg-red-50 text-red-700 border border-red-200",             label: "No Hire" },
};

function ScoreRing({ score }: { score: number | null }) {
  if (score === null) return (
    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
      <span className="text-xs text-gray-400">N/A</span>
    </div>
  );
  const r = 22, circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const color = score >= 70 ? "#10b981" : score >= 50 ? "#6366f1" : "#f59e0b";
  const bg    = score >= 70 ? "#d1fae5" : score >= 50 ? "#e0e7ff" : "#fef3c7";
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={r} fill={bg} />
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
        strokeLinecap="round" transform="rotate(-90 28 28)" />
      <text x="28" y="32" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
        {score.toFixed(0)}
      </text>
    </svg>
  );
}

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

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3,4].map((i) => <div key={i} className="h-20 rounded-xl bg-white border border-gray-200 animate-pulse" />)}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" className="gap-1.5 text-gray-600" onClick={() => router.push("/jobs")}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
          <p className="text-sm text-gray-500 mt-0.5">{candidates.length} candidate{candidates.length !== 1 ? "s" : ""} ranked by AI score</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => router.push(`/jobs/${jobId}/upload`)}>
          <Upload className="w-4 h-4" /> Upload More
        </Button>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
          <p className="text-gray-500 font-medium">No candidates yet</p>
          <p className="text-gray-400 text-sm mt-1">Upload resumes to start screening</p>
        </div>
      ) : (
        <div className="space-y-2">
          {candidates.map((c, rank) => {
            const unacked = unackedFlags(c);
            const sc = statusConfig[c.status] ?? statusConfig.pending;
            return (
              <div key={c.id}
                className={`group bg-white rounded-xl border hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer ${unacked.length > 0 ? "border-amber-300 bg-amber-50/30" : "border-gray-200"}`}
                onClick={() => openCandidate(c)}>
                <div className="flex items-center gap-4 px-5 py-3.5">
                  {/* Rank */}
                  <span className="text-sm font-bold text-gray-300 w-6 shrink-0 text-center">#{rank + 1}</span>

                  {/* Score ring */}
                  <ScoreRing score={c.total_score ?? null} />

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{c.candidate_name || "Unknown Candidate"}</p>
                    <p className="text-sm text-gray-400 truncate">{c.email}</p>
                  </div>

                  {/* Bias warning */}
                  {unacked.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full shrink-0">
                      <AlertTriangle className="w-3 h-3" />
                      {unacked.length} flag{unacked.length > 1 ? "s" : ""}
                    </div>
                  )}

                  {/* Status */}
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${sc.cls}`}>{sc.label}</span>

                  {/* Arrow */}
                  <span className="text-gray-300 group-hover:text-indigo-400 transition-colors text-lg leading-none">›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              {/* Header with score ring */}
              <div className="flex items-center gap-4">
                <ScoreRing score={selected.total_score ?? null} />
                <div className="flex-1">
                  <DialogTitle className="text-lg">{selected.candidate_name || "Candidate"}</DialogTitle>
                  <p className="text-sm text-gray-400 mt-0.5">{selected.email}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${(statusConfig[selected.status] ?? statusConfig.pending).cls}`}>
                  {(statusConfig[selected.status] ?? statusConfig.pending).label}
                </span>
              </div>
            </DialogHeader>

            <div className="space-y-4 mt-1">
              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {(["score", "rounds", "history"] as const).map((tab) => (
                  <button key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab === "history" && selected && history.length === 0) loadHistory(selected.id);
                    }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      activeTab === tab
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab === "score" ? "Score & Flags"
                      : tab === "rounds" ? `Rounds${rounds.length ? ` (${rounds.length}/3)` : ""}`
                      : "History"}
                  </button>
                ))}
              </div>

              {/* ── Score tab ── */}
              {activeTab === "score" && (
                <>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                    {scoreWeights.map(({ key, label, weight }) => {
                      const val = selected.score_breakdown?.[key] ?? 0;
                      const barColor = val >= 70 ? "bg-emerald-500" : val >= 50 ? "bg-indigo-500" : "bg-amber-400";
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-600">{label}</span>
                            <span className="text-xs font-semibold text-gray-700">{val.toFixed(0)}<span className="text-gray-400 font-normal">/100</span>
                              <span className="text-gray-400 ml-1 font-normal">· {((val * weight) / 100).toFixed(1)}pt</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(val, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selected.bias_flags?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bias Flags</p>
                      {selected.bias_flags.map((flag) => {
                        const sc = severityConfig[flag.severity] ?? severityConfig.low;
                        return (
                          <div key={flag.id} className={`rounded-xl p-3 ${sc.cls}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${sc.dot}`} />
                                <div>
                                  <p className="text-xs font-semibold capitalize">{flag.flag_type.replace(/_/g, " ")}
                                    <span className="ml-1 font-normal opacity-70">({flag.severity})</span>
                                  </p>
                                  <p className="text-xs mt-0.5 opacity-80">{flag.explanation}</p>
                                </div>
                              </div>
                              {flag.acknowledged
                                ? <span className="text-xs text-emerald-600 flex items-center gap-1 shrink-0"><CheckCircle2 className="w-3 h-3" />Acked</span>
                                : <Button size="sm" variant="outline" className="text-xs h-7 shrink-0"
                                    onClick={(e) => { e.stopPropagation(); ackBiasFlag(flag.id); }}>Acknowledge</Button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div>
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recruiter Notes</Label>
                    <Textarea className="mt-1.5 bg-gray-50 resize-none text-sm" rows={3}
                      placeholder="Add notes on this candidate…"
                      value={justification} onChange={(e) => setJustification(e.target.value)} />
                    <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={saveJustification}>Save Notes</Button>
                  </div>
                </>
              )}

              {/* ── Rounds tab ── */}
              {activeTab === "rounds" && (
                <div className="space-y-3">
                  {roundsLoading ? (
                    <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}</div>
                  ) : rounds.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No interviews scheduled yet</p>
                    </div>
                  ) : (
                    rounds.map((r) => (
                      <div key={r.round_number} className="border border-gray-200 rounded-xl p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">Round {r.round_number}: {r.round_label}</p>
                            {r.scheduled_at && (
                              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" />{new Date(r.scheduled_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {r.teams_meeting_url && (
                              <a href={r.teams_meeting_url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                                <Video className="w-3 h-3" />Teams
                              </a>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              r.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                              r.status === "scheduled" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                            }`}>{r.status}</span>
                          </div>
                        </div>
                        {r.feedback ? (
                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              {[
                                ["Technical", r.feedback.technical_score],
                                ["Communication", r.feedback.communication_score],
                                ["Problem Solving", r.feedback.problem_solving_score],
                                ["Cultural Fit", r.feedback.cultural_fit_score],
                              ].map(([lbl, val]) => (
                                <div key={lbl as string} className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">{lbl}</span>
                                  <span className="text-xs font-bold text-gray-700">{val}/10</span>
                                </div>
                              ))}
                            </div>
                            <div className="pt-2 border-t border-gray-200">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${(recConfig[r.feedback.recommendation] ?? recConfig.maybe).cls}`}>
                                {(recConfig[r.feedback.recommendation] ?? recConfig.maybe).label}
                              </span>
                              {r.feedback.comments && <p className="text-xs text-gray-600 mt-2">{r.feedback.comments}</p>}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {r.feedback.strengths?.map((s) => (
                                  <span key={s} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md">✓ {s}</span>
                                ))}
                                {r.feedback.weaknesses?.map((w) => (
                                  <span key={w} className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-md">✗ {w}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : <p className="text-xs text-gray-400 italic">Awaiting interviewer feedback…</p>}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── History tab ── */}
              {activeTab === "history" && (
                <div>
                  {historyLoading ? (
                    <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}</div>
                  ) : history.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No audit events recorded yet.</p>
                  ) : (
                    <div className="space-y-0 relative">
                      <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-200" />
                      {history.map((entry, i) => (
                        <div key={i} className="flex items-start gap-4 py-2.5 pl-2 relative">
                          <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-400 shrink-0 relative z-10 ring-2 ring-white" />
                          <div>
                            <p className="text-sm font-medium text-gray-800 capitalize">{entry.action.replace(/_/g, " ")}</p>
                            <p className="text-xs text-gray-400">{new Date(entry.at).toLocaleString()}</p>
                            {entry.payload && Object.keys(entry.payload).length > 0 && (
                              <p className="text-xs text-gray-500 mt-0.5">{Object.entries(entry.payload).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Action buttons ── */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                {selected.status === "parse_error" && (
                  <Button className="w-full gap-2 bg-orange-500 hover:bg-orange-600" disabled={actionLoading} onClick={() => retryParse(selected.id)}>
                    <RotateCcw className="w-4 h-4" />Retry Parsing
                  </Button>
                )}

                {(selected.status === "scored" || selected.status === "pending") && (
                  <div className="flex gap-2">
                    <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                      disabled={actionLoading || unackedFlags(selected).length > 0}
                      onClick={() => approve(selected.id)}>
                      <ThumbsUp className="w-4 h-4" />
                      {unackedFlags(selected).length > 0 ? "Ack Bias Flags First" : "Shortlist"}
                    </Button>
                    <Button variant="outline" className="flex-1 gap-2 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={actionLoading} onClick={() => reject(selected.id)}>
                      <ThumbsDown className="w-4 h-4" />Reject
                    </Button>
                  </div>
                )}

                {selected.status === "shortlisted" && allRoundsComplete && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2 text-center">All 3 rounds complete — final decision</p>
                    <div className="flex gap-2">
                      <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={actionLoading} onClick={() => finalDecision(selected.id, "hire")}>
                        <CheckCircle2 className="w-4 h-4" />Hire
                      </Button>
                      <Button variant="outline" className="flex-1 gap-2 text-red-600 border-red-200 hover:bg-red-50" disabled={actionLoading} onClick={() => finalDecision(selected.id, "no_hire")}>
                        No Hire
                      </Button>
                    </div>
                  </div>
                )}

                {selected.status === "shortlisted" && !allRoundsComplete && rounds.length > 0 && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                      disabled={actionLoading} onClick={() => finalDecision(selected.id, "hire")}>
                      <CheckCircle2 className="w-3.5 h-3.5" />Mark Hired
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={actionLoading} onClick={() => finalDecision(selected.id, "no_hire")}>
                      Mark No Hire
                    </Button>
                    <span className="text-xs text-gray-400 self-center ml-1">Override before all rounds complete</span>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
