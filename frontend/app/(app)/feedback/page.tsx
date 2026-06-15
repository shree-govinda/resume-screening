"use client";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquarePlus, Calendar, CheckCircle2, Clock, ThumbsUp, ThumbsDown, Minus, Video } from "lucide-react";
import api from "@/lib/api";

interface Round {
  id: string;
  round_number: number;
  candidate_name: string;
  job_title: string;
  scheduled_at: string;
  status: string;
  feedback_submitted: boolean;
}

const feedbackSchema = z.object({
  technical_score: z.coerce.number().min(1).max(10),
  communication_score: z.coerce.number().min(1).max(10),
  problem_solving_score: z.coerce.number().min(1).max(10),
  cultural_fit_score: z.coerce.number().min(1).max(10),
  recommendation: z.enum(["hire", "no_hire", "maybe"]),
  comments: z.string().min(10, "Please provide at least 10 characters of feedback"),
  strengths: z.string(),
  weaknesses: z.string(),
});
type FeedbackForm = z.infer<typeof feedbackSchema>;

const roundLabel = ["", "Technical Screen", "Technical Deep-Dive", "Final Managerial"];

const statusConfig: Record<string, { cls: string; dot: string; label: string }> = {
  scheduled:   { cls: "bg-indigo-50 text-indigo-700 border border-indigo-200", dot: "bg-indigo-500", label: "Scheduled" },
  completed:   { cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", label: "Completed" },
  cancelled:   { cls: "bg-red-50 text-red-600 border border-red-200", dot: "bg-red-500", label: "Cancelled" },
  rescheduled: { cls: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500", label: "Rescheduled" },
};

function ScoreInput({ label, name, register, error }: { label: string; name: keyof FeedbackForm; register: ReturnType<typeof useForm<FeedbackForm>>["register"]; error?: string }) {
  return (
    <div>
      <Label className="text-xs font-medium text-gray-600">{label}</Label>
      <Input type="number" min="1" max="10" className="mt-1 h-9 text-center font-semibold" {...register(name)} />
      {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
    </div>
  );
}

export default function FeedbackPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Round | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rec, setRec] = useState<"hire" | "maybe" | "no_hire">("maybe");

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FeedbackForm>({
    resolver: zodResolver(feedbackSchema) as Resolver<FeedbackForm>,
    defaultValues: { recommendation: "maybe" },
  });

  const load = () => {
    api.get("/rounds").then((r) => setRounds(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openFeedback = (round: Round) => {
    reset({ recommendation: "maybe" });
    setRec("maybe");
    setSelected(round);
  };

  const onSubmit = async (data: FeedbackForm) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.post(`/rounds/${selected.id}/feedback`, {
        ...data,
        strengths: data.strengths.split(",").map((s) => s.trim()).filter(Boolean),
        weaknesses: data.weaknesses.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Feedback submitted! Next round scheduling triggered if applicable.");
      setSelected(null);
      load();
    } catch {
      toast.error("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const upcoming = rounds.filter((r) => r.status === "scheduled" && !r.feedback_submitted);
  const past = rounds.filter((r) => r.status !== "scheduled" || r.feedback_submitted);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Interviews</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review your assigned interviews and submit feedback</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-white border border-gray-200 animate-pulse" />)}
        </div>
      ) : rounds.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Video className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-gray-700 font-semibold">No interviews assigned yet</p>
          <p className="text-gray-400 text-sm mt-1">You'll see scheduled interviews here once assigned by a recruiter.</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Pending Feedback</p>
              <div className="space-y-3">
                {upcoming.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl border border-indigo-200 hover:border-indigo-300 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                        <MessageSquarePlus className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{r.candidate_name}</p>
                        <p className="text-sm text-gray-500">{r.job_title} · {roundLabel[r.round_number] ?? `Round ${r.round_number}`}</p>
                        <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(r.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => openFeedback(r)} className="gap-1.5 shrink-0">
                        <MessageSquarePlus className="w-3.5 h-3.5" />Submit Feedback
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Past Interviews</p>
              <div className="space-y-2">
                {past.map((r) => {
                  const sc = statusConfig[r.status] ?? statusConfig.scheduled;
                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-100 px-5 py-3.5 flex items-center gap-4 opacity-75">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800">{r.candidate_name}</p>
                        <p className="text-xs text-gray-400">{r.job_title} · {roundLabel[r.round_number] ?? `Round ${r.round_number}`}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {new Date(r.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {r.feedback_submitted ? "Feedback submitted" : sc.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">Submit Interview Feedback</DialogTitle>
              <p className="text-sm text-gray-500 mt-0.5">{selected.candidate_name} · {roundLabel[selected.round_number]}</p>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-2">
              {/* Score grid */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Scores (1 – 10)</p>
                <div className="grid grid-cols-2 gap-3">
                  <ScoreInput label="Technical" name="technical_score" register={register} error={errors.technical_score?.message} />
                  <ScoreInput label="Communication" name="communication_score" register={register} error={errors.communication_score?.message} />
                  <ScoreInput label="Problem Solving" name="problem_solving_score" register={register} error={errors.problem_solving_score?.message} />
                  <ScoreInput label="Cultural Fit" name="cultural_fit_score" register={register} error={errors.cultural_fit_score?.message} />
                </div>
              </div>

              {/* Recommendation */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recommendation</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { val: "hire", label: "Hire", icon: ThumbsUp, cls: "border-emerald-200 text-emerald-700 bg-emerald-50", active: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-300" },
                    { val: "maybe", label: "Maybe", icon: Minus, cls: "border-amber-200 text-amber-700 bg-amber-50", active: "border-amber-500 bg-amber-100 ring-2 ring-amber-300" },
                    { val: "no_hire", label: "No Hire", icon: ThumbsDown, cls: "border-red-200 text-red-600 bg-red-50", active: "border-red-500 bg-red-100 ring-2 ring-red-300" },
                  ] as const).map(({ val, label, icon: Icon, cls, active }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => { setRec(val); setValue("recommendation", val); }}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all text-sm font-semibold cursor-pointer ${rec === val ? active : cls}`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Strengths / Weaknesses */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-600">Strengths <span className="text-gray-400 font-normal">(comma-separated)</span></Label>
                  <Input className="mt-1" placeholder="Strong problem solving, Clear communication" {...register("strengths")} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-600">Areas to Improve <span className="text-gray-400 font-normal">(comma-separated)</span></Label>
                  <Input className="mt-1" placeholder="System design depth, Leadership examples" {...register("weaknesses")} />
                </div>
              </div>

              {/* Comments */}
              <div>
                <Label className="text-xs font-medium text-gray-600">Detailed Comments</Label>
                <Textarea className="mt-1" rows={4} placeholder="Provide detailed feedback on the candidate's performance…" {...register("comments")} />
                {errors.comments && <p className="text-red-500 text-xs mt-1">{errors.comments.message}</p>}
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Submitting…" : "Submit Feedback"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
