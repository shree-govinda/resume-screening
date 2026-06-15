"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CloudUpload, FileText, CheckCircle2, XCircle, Loader2, Brain, ShieldCheck, Star, Users } from "lucide-react";
import api from "@/lib/api";

interface UploadedFile {
  name: string;
  size: number;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  candidateId?: string;
  score?: number;
  error?: string;
}

export default function UploadPage() {
  const { id: jobId } = useParams<{ id: string }>();
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((accepted: File[], rejected: { file: File; errors: readonly { message: string }[] }[]) => {
    if (rejected.length) {
      toast.error(`${rejected.length} file(s) rejected — only PDF/DOC/DOCX under 10MB allowed`);
    }
    const newFiles: UploadedFile[] = accepted.map((f) => ({
      name: f.name,
      size: f.size,
      status: "pending",
      _file: f,
    } as UploadedFile & { _file: File }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "application/msword": [".doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
  });

  const pollsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  useEffect(() => () => { pollsRef.current.forEach(clearInterval); }, []);

  const pollStatus = (candidateId: string, index: number) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/resumes/${candidateId}/status`);
        const { status, total_score } = res.data;
        if (status === "scored" || status === "shortlisted") {
          clearInterval(interval);
          setFiles((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], status: "done", score: total_score };
            return updated;
          });
        } else if (status === "parse_error") {
          clearInterval(interval);
          setFiles((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], status: "error", error: "Parse failed" };
            return updated;
          });
        } else {
          setFiles((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], status: "processing" };
            return updated;
          });
        }
      } catch {
        clearInterval(interval);
      }
    }, 3000);
    pollsRef.current.push(interval);
  };

  const uploadAll = async () => {
    const pendingFiles = (files as (UploadedFile & { _file?: File })[]).filter((f) => f.status === "pending" && f._file);
    if (!pendingFiles.length) { toast.error("No files to upload"); return; }
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const f = files[i] as UploadedFile & { _file?: File };
      if (f.status !== "pending" || !f._file) continue;

      setFiles((prev) => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: "uploading" };
        return updated;
      });

      try {
        const form = new FormData();
        form.append("file", f._file);
        const res = await api.post(`/jobs/${jobId}/resumes`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const candidateId = res.data.candidate_id;
        setFiles((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: "processing", candidateId };
          return updated;
        });
        pollStatus(candidateId, i);
      } catch {
        setFiles((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: "error", error: "Upload failed" };
          return updated;
        });
      }
    }
    setUploading(false);
  };

  const fileStatusUI = (f: UploadedFile) => {
    if (f.status === "pending")    return { icon: <FileText className="w-4 h-4 text-gray-400" />, label: "Ready", cls: "text-gray-400" };
    if (f.status === "uploading")  return { icon: <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />, label: "Uploading…", cls: "text-indigo-600" };
    if (f.status === "processing") return { icon: <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />, label: "AI Processing…", cls: "text-amber-600" };
    if (f.status === "done")       return { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, label: `Score: ${f.score?.toFixed(1) ?? "—"}`, cls: "text-emerald-600 font-semibold" };
    return { icon: <XCircle className="w-4 h-4 text-red-500" />, label: f.error ?? "Error", cls: "text-red-500" };
  };

  const hasPending = files.some((f) => f.status === "pending");
  const doneCount  = files.filter((f) => f.status === "done").length;

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" className="gap-1.5 text-gray-600" onClick={() => router.push("/jobs")}>
          <ArrowLeft className="w-4 h-4" />Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Resumes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Drop files below — AI will screen them automatically</p>
        </div>
      </div>

      {/* Dropzone */}
      <div {...getRootProps()} className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all mb-6 ${
        isDragActive ? "border-indigo-500 bg-indigo-50 scale-[1.01]" : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"
      }`}>
        <input {...getInputProps()} />
        <div className="py-16 text-center px-8">
          <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-colors ${isDragActive ? "bg-indigo-100" : "bg-gray-100"}`}>
            <CloudUpload className={`w-8 h-8 transition-colors ${isDragActive ? "text-indigo-600" : "text-gray-400"}`} />
          </div>
          <p className={`font-semibold text-base transition-colors ${isDragActive ? "text-indigo-700" : "text-gray-700"}`}>
            {isDragActive ? "Drop your files here!" : "Drag & drop resumes here"}
          </p>
          <p className="text-sm text-gray-400 mt-1 mb-5">PDF, DOC, DOCX — up to 10 MB each · multiple files OK</p>
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <FileText className="w-4 h-4" />Browse Files
          </Button>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <p className="font-semibold text-gray-900">{files.length} file{files.length !== 1 ? "s" : ""}</p>
              {doneCount > 0 && <p className="text-xs text-emerald-600 mt-0.5">{doneCount} scored ✓</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={uploadAll} disabled={uploading || !hasPending} className="gap-1.5">
                {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading…</> : <><CloudUpload className="w-3.5 h-3.5" />Upload All</>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push(`/jobs/${jobId}/candidates`)} className="gap-1.5">
                <Users className="w-3.5 h-3.5" />View Candidates
              </Button>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {files.map((f, i) => {
              const ui = fileStatusUI(f);
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  {ui.icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                    <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <span className={`text-xs ${ui.cls} shrink-0`}>{ui.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pipeline explainer */}
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5">
        <p className="text-sm font-semibold text-indigo-900 mb-4">What happens after upload?</p>
        <div className="space-y-3">
          {[
            { icon: FileText,    color: "bg-indigo-100 text-indigo-600", step: "1", text: "Text extracted from PDF / DOCX" },
            { icon: Brain,       color: "bg-violet-100 text-violet-600", step: "2", text: "Gemma AI parses structured candidate data" },
            { icon: Star,        color: "bg-amber-100 text-amber-600",   step: "3", text: "Match score computed 0–100 against JD" },
            { icon: ShieldCheck, color: "bg-emerald-100 text-emerald-600", step: "4", text: "Bias signals detected & flagged" },
            { icon: Users,       color: "bg-sky-100 text-sky-600",       step: "5", text: "Candidate ranked in dashboard" },
          ].map(({ icon: Icon, color, step, text }) => (
            <div key={step} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center shrink-0`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm text-indigo-800">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
