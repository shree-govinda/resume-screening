"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Plus, Upload, Users, PenLine, XCircle, RefreshCw, Calendar } from "lucide-react";
import api from "@/lib/api";

interface Job {
  id: string;
  title: string;
  department: string | null;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
  active: { label: "Active", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  closed: { label: "Closed", cls: "bg-gray-100 text-gray-500 border border-gray-200", dot: "bg-gray-400" },
  draft:  { label: "Draft",  cls: "bg-amber-50 text-amber-700 border border-amber-200",   dot: "bg-amber-500" },
};

const editSchema = z.object({
  title: z.string().min(2, "Required"),
  department: z.string().min(1, "Required"),
});
type EditForm = z.infer<typeof editSchema>;

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [editStatus, setEditStatus] = useState<string>("active");
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema) as Resolver<EditForm>,
  });

  const load = () => {
    api.get("/jobs").then((r) => setJobs(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openEdit = (job: Job) => {
    reset({ title: job.title, department: job.department ?? "" });
    setEditStatus(job.status);
    setEditJob(job);
  };

  const onEditSubmit = async (data: EditForm) => {
    if (!editJob) return;
    setSaving(true);
    try {
      await api.patch(`/jobs/${editJob.id}`, {
        title: data.title,
        department: data.department,
        status: editStatus,
      });
      toast.success("Job updated");
      setEditJob(null);
      load();
    } catch {
      toast.error("Failed to update job");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (job: Job) => {
    const next = job.status === "active" ? "closed" : "active";
    try {
      await api.patch(`/jobs/${job.id}`, { status: next });
      toast.success(`Job ${next === "closed" ? "closed" : "reopened"}`);
      load();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
          <p className="text-sm text-gray-500 mt-0.5">{jobs.length} position{jobs.length !== 1 ? "s" : ""} total</p>
        </div>
        <Link href="/jobs/new">
          <Button className="gap-2"><Plus className="w-4 h-4" /> New Job</Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-24 rounded-xl bg-white border border-gray-200 animate-pulse" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-7 h-7 text-indigo-400" />
          </div>
          <p className="text-gray-700 font-semibold text-lg">No job postings yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-5">Create your first posting to start screening candidates</p>
          <Link href="/jobs/new"><Button className="gap-2"><Plus className="w-4 h-4" />New Job</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const sc = statusConfig[job.status] ?? statusConfig.draft;
            return (
              <div key={job.id} className={`group bg-white rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-sm transition-all ${job.status === "closed" ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-5 px-5 py-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5 text-indigo-500" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{job.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {job.department && <span className="text-xs text-gray-500">{job.department}</span>}
                      <span className="text-gray-300">·</span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(job.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${sc.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="ghost" className="gap-1.5 text-gray-600 hover:text-gray-900" onClick={() => openEdit(job)}>
                      <PenLine className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost"
                      className={`gap-1.5 ${job.status === "active" ? "text-red-500 hover:text-red-700 hover:bg-red-50" : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"}`}
                      onClick={() => toggleStatus(job)}>
                      {job.status === "active" ? <><XCircle className="w-3.5 h-3.5" />Close</> : <><RefreshCw className="w-3.5 h-3.5" />Reopen</>}
                    </Button>
                    {job.status !== "closed" && (
                      <Link href={`/jobs/${job.id}/upload`}>
                        <Button size="sm" variant="ghost" className="gap-1.5 text-gray-600 hover:text-indigo-700 hover:bg-indigo-50">
                          <Upload className="w-3.5 h-3.5" />Upload
                        </Button>
                      </Link>
                    )}
                    <Link href={`/jobs/${job.id}/candidates`}>
                      <Button size="sm" className="gap-1.5">
                        <Users className="w-3.5 h-3.5" />Candidates
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editJob} onOpenChange={(open) => !open && setEditJob(null)}>
        {editJob && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Job Posting</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4 mt-2">
              <div>
                <Label>Job Title</Label>
                <Input className="mt-1.5" {...register("title")} />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
              </div>
              <div>
                <Label>Department</Label>
                <Input className="mt-1.5" {...register("department")} />
                {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department.message}</p>}
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => v && setEditStatus(v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving} className="flex-1">{saving ? "Saving…" : "Save Changes"}</Button>
                <Button type="button" variant="outline" onClick={() => setEditJob(null)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
