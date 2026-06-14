"use client";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
const statusColor: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-600",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
  rescheduled: "bg-yellow-100 text-yellow-600",
};

export default function FeedbackPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Round | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FeedbackForm>({
    resolver: zodResolver(feedbackSchema) as Resolver<FeedbackForm>,
    defaultValues: { recommendation: "maybe" },
  });

  const load = () => {
    api.get("/rounds").then((r) => setRounds(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openFeedback = (round: Round) => {
    reset({ recommendation: "maybe" });
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

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Interviews</h1>

      {upcoming.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Upcoming — Feedback Required</h2>
          <div className="space-y-3">
            {upcoming.map((r) => (
              <Card key={r.id} className="border-blue-200">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold text-gray-900">{r.candidate_name}</p>
                    <p className="text-sm text-gray-500">{r.job_title} · {roundLabel[r.round_number] ?? `Round ${r.round_number}`}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(r.scheduled_at).toLocaleString()}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => openFeedback(r)}>Submit Feedback</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Past Interviews</h2>
          <div className="space-y-3">
            {past.map((r) => (
              <Card key={r.id} className="opacity-80">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold text-gray-900">{r.candidate_name}</p>
                    <p className="text-sm text-gray-500">{r.job_title} · {roundLabel[r.round_number] ?? `Round ${r.round_number}`}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(r.scheduled_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[r.status] ?? ""}`}>
                    {r.feedback_submitted ? "Feedback submitted" : r.status}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {rounds.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            No interviews assigned to you yet.
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Interview Feedback</DialogTitle>
              <p className="text-sm text-gray-500">{selected.candidate_name} · {roundLabel[selected.round_number]}</p>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: "technical_score" as const, label: "Technical (1–10)" },
                  { name: "communication_score" as const, label: "Communication (1–10)" },
                  { name: "problem_solving_score" as const, label: "Problem Solving (1–10)" },
                  { name: "cultural_fit_score" as const, label: "Cultural Fit (1–10)" },
                ].map(({ name, label }) => (
                  <div key={name}>
                    <Label>{label}</Label>
                    <Input type="number" min="1" max="10" className="mt-1" {...register(name)} />
                    {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]?.message as string}</p>}
                  </div>
                ))}
              </div>

              <div>
                <Label>Recommendation</Label>
                <div className="flex gap-3 mt-2">
                  {(["hire", "maybe", "no_hire"] as const).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" value={opt} {...register("recommendation")} />
                      <span className={`text-sm font-medium ${opt === "hire" ? "text-green-600" : opt === "no_hire" ? "text-red-600" : "text-yellow-600"}`}>
                        {opt === "no_hire" ? "No Hire" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Strengths <span className="text-gray-400 text-xs">(comma-separated)</span></Label>
                <Input className="mt-1" placeholder="Strong problem solving, Clear communication" {...register("strengths")} />
              </div>
              <div>
                <Label>Areas to Improve <span className="text-gray-400 text-xs">(comma-separated)</span></Label>
                <Input className="mt-1" placeholder="System design depth, Leadership examples" {...register("weaknesses")} />
              </div>

              <div>
                <Label>Detailed Comments</Label>
                <Textarea className="mt-1" rows={4} placeholder="Provide detailed feedback on the candidate's performance..." {...register("comments")} />
                {errors.comments && <p className="text-red-500 text-xs mt-1">{errors.comments.message}</p>}
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Submitting..." : "Submit Feedback"}
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
