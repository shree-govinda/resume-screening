"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Star, TrendingUp, Briefcase, Calendar, AlertTriangle, UserCheck, Clock } from "lucide-react";
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

type LucideIcon = React.ComponentType<{ className?: string }>;

function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor }: {
  label: string; value: string | number; sub?: string;
  icon: LucideIcon; iconBg: string; iconColor: string;
}) {
  return (
    <Card className="bg-white border border-gray-200 hover:shadow-sm transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Bar({ pct, color = "bg-indigo-500" }: { pct: number; color?: string }) {
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
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

  if (loading) return (
    <div>
      <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1,2,3,4,5,6,7,8].map((i) => <div key={i} className="h-24 bg-white rounded-xl border border-gray-200 animate-pulse" />)}
      </div>
    </div>
  );

  const maxPipeline = Math.max(...pipeline.map((r) => r.count), 1);
  const maxScore = Math.max(...scores.map((r) => r.count), 1);
  const totalBias = bias.reduce((s, r) => s + r.count, 0);
  const unackedTotal = overview
    ? Object.values(overview.unacknowledged_bias_flags).reduce((s, v) => s + v, 0)
    : 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Live pipeline metrics powered by AI screening</p>
      </div>

      {/* KPI Cards */}
      {overview ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Candidates" value={overview.total_candidates} icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
          <StatCard label="Avg Match Score" value={overview.avg_score ? `${overview.avg_score}` : "—"} sub="out of 100" icon={Star} iconBg="bg-amber-50" iconColor="text-amber-600" />
          <StatCard label="Shortlist Rate" value={`${overview.shortlist_rate_pct}%`} sub="of scored candidates" icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Hired" value={overview.hired} sub={`${overview.rejected} rejected`} icon={UserCheck} iconBg="bg-green-50" iconColor="text-green-600" />
          <StatCard label="Active Jobs" value={overview.active_jobs} icon={Briefcase} iconBg="bg-blue-50" iconColor="text-blue-600" />
          <StatCard label="Interviews This Week" value={overview.interviews_this_week} icon={Calendar} iconBg="bg-violet-50" iconColor="text-violet-600" />
          <StatCard label="Unacked Bias Flags" value={unackedTotal} sub={unackedTotal > 0 ? "require review" : "all clear"} icon={AlertTriangle} iconBg={unackedTotal > 0 ? "bg-red-50" : "bg-gray-50"} iconColor={unackedTotal > 0 ? "text-red-500" : "text-gray-400"} />
          <StatCard label="Pending Review" value={overview.by_status["scored"] ?? 0} sub="awaiting recruiter decision" icon={Clock} iconBg="bg-orange-50" iconColor="text-orange-500" />
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3 mb-8 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Overview metrics unavailable — check API connectivity.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Pipeline */}
        <Card className="bg-white border border-gray-200">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-gray-700">Candidate Pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-0">
            {pipeline.filter((r) => r.count > 0 || ["scored","shortlisted","hired"].includes(r.stage)).map((r) => (
              <div key={r.stage} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24 shrink-0">{stageLabel[r.stage] ?? r.stage}</span>
                <Bar pct={(r.count / maxPipeline) * 100} color={
                  r.stage === "hired" ? "bg-emerald-500" :
                  r.stage === "rejected" || r.stage === "no_hire" ? "bg-red-400" :
                  r.stage === "shortlisted" ? "bg-indigo-500" :
                  r.stage === "parse_error" ? "bg-orange-400" : "bg-gray-300"
                } />
                <span className="text-xs font-bold text-gray-600 w-6 text-right shrink-0">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card className="bg-white border border-gray-200">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-gray-700">Score Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-0">
            {scores.map((r) => (
              <div key={r.range} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-14 shrink-0 font-mono">{r.range}</span>
                <Bar pct={(r.count / maxScore) * 100} color={
                  r.range.startsWith("8") || r.range.startsWith("9") || r.range.startsWith("100") ? "bg-emerald-500" :
                  r.range.startsWith("6") || r.range.startsWith("7") ? "bg-indigo-500" :
                  "bg-gray-300"
                } />
                <span className="text-xs font-bold text-gray-600 w-6 text-right shrink-0">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Bias Flags */}
        <Card className="bg-white border border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-700">Bias Flags</CardTitle>
              {unackedTotal > 0 && (
                <span className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">{unackedTotal} unacked</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {bias.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No bias flags — all clear ✓</p>
            ) : (
              <div className="space-y-2">
                {bias.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-sm font-medium text-gray-700 capitalize">{r.flag_type.replace(/_/g, " ")}</p>
                      <p className={`text-xs font-medium ${r.severity === "high" ? "text-red-500" : r.severity === "medium" ? "text-amber-500" : "text-blue-500"}`}>{r.severity}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-600">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interviewer Load */}
        <Card className="bg-white border border-gray-200">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-gray-700">Interviewer Load</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {ivLoad.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No interviewers assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {ivLoad.map((iv, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{iv.name}</p>
                      <p className="text-xs text-gray-400">{iv.department}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-700">{iv.total_interviews}</p>
                      <p className="text-xs text-emerald-600">{iv.hire_recommendations} hire rec{iv.hire_recommendations !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-Job Summary */}
      <Card className="bg-white border border-gray-200">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-gray-700">Jobs Summary</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {jobs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No jobs created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-400 border-b border-gray-100">
                    <th className="pb-3">Job Title</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Candidates</th>
                    <th className="pb-3 text-right">Avg Score</th>
                    <th className="pb-3 text-right">Shortlisted</th>
                    <th className="pb-3 text-right">Hired</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 font-medium text-gray-800">{j.title}</td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${j.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>{j.status}</span>
                      </td>
                      <td className="py-3 text-right text-gray-600">{j.total_candidates}</td>
                      <td className="py-3 text-right text-gray-600 font-mono">{j.avg_score ?? "—"}</td>
                      <td className="py-3 text-right text-indigo-600 font-semibold">{j.shortlisted}</td>
                      <td className="py-3 text-right text-emerald-600 font-semibold">{j.hired}</td>
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
