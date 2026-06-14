"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import api from "@/lib/api";

interface Overview {
  total_candidates: number;
  by_status: Record<string, number>;
  avg_score: number | null;
  shortlist_rate_pct: number;
  active_jobs: number;
  interviews_this_week: number;
  hired: number;
  rejected: number;
  unacknowledged_bias_flags: Record<string, number>;
}

interface PipelineRow { stage: string; count: number }
interface ScoreRow { range: string; count: number }
interface BiasRow { flag_type: string; severity: string; count: number }
interface IVRow { name: string; department: string; total_interviews: number; hire_recommendations: number }
interface JobRow { id: string; title: string; status: string; total_candidates: number; avg_score: number | null; shortlisted: number; hired: number }

const stageLabel: Record<string, string> = {
  pending: "Pending", parsing: "Parsing", scored: "Scored",
  shortlisted: "Shortlisted", hired: "Hired", rejected: "Rejected",
  no_hire: "No Hire", parse_error: "Parse Error",
};

const severityColor: Record<string, string> = {
  high: "text-red-600", medium: "text-yellow-600", low: "text-blue-600",
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        {sub && <p className="text-sm text-gray-400 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Bar({ pct, color = "bg-blue-500" }: { pct: number; color?: string }) {
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-3">
      <div className={`${color} h-3 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function ReportsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [bias, setBias] = useState<BiasRow[]>([]);
  const [ivLoad, setIvLoad] = useState<IVRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get("/analytics/overview"),
      api.get("/analytics/pipeline"),
      api.get("/analytics/scores"),
      api.get("/analytics/bias"),
      api.get("/analytics/interviewers"),
      api.get("/analytics/jobs"),
    ]).then(([ov, pl, sc, bi, iv, jb]) => {
      if (ov.status === "fulfilled") setOverview(ov.value.data);
      if (pl.status === "fulfilled") setPipeline(pl.value.data);
      if (sc.status === "fulfilled") setScores(sc.value.data);
      if (bi.status === "fulfilled") setBias(bi.value.data);
      if (iv.status === "fulfilled") setIvLoad(iv.value.data);
      if (jb.status === "fulfilled") setJobs(jb.value.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading reports...</p>;

  const maxPipeline = Math.max(...pipeline.map((r) => r.count), 1);
  const maxScore = Math.max(...scores.map((r) => r.count), 1);
  const totalBias = bias.reduce((s, r) => s + r.count, 0);
  const unackedTotal = overview
    ? Object.values(overview.unacknowledged_bias_flags).reduce((s, v) => s + v, 0)
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports & Analytics</h1>

      {/* KPI Cards */}
      {overview ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Candidates" value={overview.total_candidates} />
          <StatCard label="Avg Match Score" value={overview.avg_score ? `${overview.avg_score}/100` : "—"} />
          <StatCard label="Shortlist Rate" value={`${overview.shortlist_rate_pct}%`} sub="of scored candidates" />
          <StatCard label="Hired" value={overview.hired} sub={`${overview.rejected} rejected`} />
          <StatCard label="Active Jobs" value={overview.active_jobs} />
          <StatCard label="Interviews This Week" value={overview.interviews_this_week} />
          <StatCard
            label="Unacked Bias Flags"
            value={unackedTotal}
            sub={unackedTotal > 0 ? "require review" : "all clear"}
          />
          <StatCard
            label="Pending Review"
            value={overview.by_status["scored"] ?? 0}
            sub="awaiting recruiter decision"
          />
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm rounded-lg px-4 py-3 mb-8">
          Overview metrics unavailable — check API connectivity.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Pipeline Funnel */}
        <Card>
          <CardHeader><CardTitle className="text-base">Candidate Pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pipeline.filter((r) => r.count > 0 || ["scored", "shortlisted", "hired"].includes(r.stage)).map((r) => (
              <div key={r.stage} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-28">{stageLabel[r.stage] ?? r.stage}</span>
                <Bar pct={(r.count / maxPipeline) * 100} color={
                  r.stage === "hired" ? "bg-green-500" :
                  r.stage === "rejected" || r.stage === "no_hire" ? "bg-red-400" :
                  r.stage === "shortlisted" ? "bg-blue-500" :
                  r.stage === "parse_error" ? "bg-orange-400" : "bg-gray-400"
                } />
                <span className="text-sm font-semibold text-gray-700 w-8 text-right">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card>
          <CardHeader><CardTitle className="text-base">Score Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {scores.map((r) => (
              <div key={r.range} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16">{r.range}</span>
                <Bar pct={(r.count / maxScore) * 100} color={
                  r.range.startsWith("8") || r.range.startsWith("9") ? "bg-green-500" :
                  r.range.startsWith("6") || r.range.startsWith("7") ? "bg-blue-500" :
                  "bg-gray-400"
                } />
                <span className="text-sm font-semibold text-gray-700 w-8 text-right">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Bias Flags */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Bias Flag Breakdown</CardTitle>
              {unackedTotal > 0 && (
                <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded-full">
                  {unackedTotal} unacknowledged
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {bias.length === 0 ? (
              <p className="text-sm text-gray-400">No bias flags detected.</p>
            ) : (
              <div className="space-y-2">
                {bias.map((r, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{r.flag_type.replace(/_/g, " ")}</p>
                      <p className={`text-xs ${severityColor[r.severity] ?? "text-gray-500"}`}>{r.severity}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interviewer Load */}
        <Card>
          <CardHeader><CardTitle className="text-base">Interviewer Load</CardTitle></CardHeader>
          <CardContent>
            {ivLoad.length === 0 ? (
              <p className="text-sm text-gray-400">No interviewers assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {ivLoad.map((iv, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{iv.name}</p>
                      <p className="text-xs text-gray-400">{iv.department}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-700">{iv.total_interviews} interviews</p>
                      <p className="text-xs text-green-600">{iv.hire_recommendations} hire recs</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-Job Summary */}
      <Card>
        <CardHeader><CardTitle className="text-base">Jobs Summary</CardTitle></CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-gray-400">No jobs created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b">
                    <th className="pb-2 font-medium">Job Title</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Candidates</th>
                    <th className="pb-2 font-medium text-right">Avg Score</th>
                    <th className="pb-2 font-medium text-right">Shortlisted</th>
                    <th className="pb-2 font-medium text-right">Hired</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jobs.map((j) => (
                    <tr key={j.id} className="py-2">
                      <td className="py-2 font-medium text-gray-800">{j.title}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          j.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                        }`}>{j.status}</span>
                      </td>
                      <td className="py-2 text-right text-gray-600">{j.total_candidates}</td>
                      <td className="py-2 text-right text-gray-600">{j.avg_score ?? "—"}</td>
                      <td className="py-2 text-right text-blue-600 font-medium">{j.shortlisted}</td>
                      <td className="py-2 text-right text-green-600 font-medium">{j.hired}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
