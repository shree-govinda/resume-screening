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
import api from "@/lib/api";

interface Job {
  id: string;
  title: string;
  department: string | null;
  status: string;
  created_at: string;
}

const statusColor: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
  draft: "bg-yellow-100 text-yellow-700",
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
        <Link href="/jobs/new">
          <Button>+ New Job</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            No job postings yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id} className={`hover:shadow-md transition-shadow ${job.status === "closed" ? "opacity-70" : ""}`}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-semibold text-gray-900">{job.title}</p>
                  <p className="text-sm text-gray-500">{job.department}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[job.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {job.status}
                  </span>
                  <p className="text-xs text-gray-400">{new Date(job.created_at).toLocaleDateString()}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(job)}>Edit</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={job.status === "active" ? "text-red-600 border-red-200" : "text-green-600 border-green-200"}
                      onClick={() => toggleStatus(job)}
                    >
                      {job.status === "active" ? "Close" : "Reopen"}
                    </Button>
                    {job.status !== "closed" && (
                      <>
                        <Link href={`/jobs/${job.id}/upload`}>
                          <Button size="sm" variant="outline">Upload Resumes</Button>
                        </Link>
                        <Link href={`/jobs/${job.id}/candidates`}>
                          <Button size="sm" variant="outline">Candidates</Button>
                        </Link>
                      </>
                    )}
                    {job.status === "closed" && (
                      <Link href={`/jobs/${job.id}/candidates`}>
                        <Button size="sm" variant="outline">View Candidates</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editJob} onOpenChange={(open) => !open && setEditJob(null)}>
        {editJob && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Job Posting</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4 mt-2">
              <div>
                <Label>Job Title</Label>
                <Input className="mt-1" {...register("title")} />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
              </div>
              <div>
                <Label>Department</Label>
                <Input className="mt-1" {...register("department")} />
                {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department.message}</p>}
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => v && setEditStatus(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditJob(null)}>Cancel</Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
