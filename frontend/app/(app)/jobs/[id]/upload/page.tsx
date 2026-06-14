"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

  const statusBadge = (f: UploadedFile) => {
    if (f.status === "pending") return <span className="text-xs text-gray-400">Pending</span>;
    if (f.status === "uploading") return <span className="text-xs text-blue-500 animate-pulse">Uploading...</span>;
    if (f.status === "processing") return <span className="text-xs text-yellow-500 animate-pulse">Processing...</span>;
    if (f.status === "done") return (
      <span className="text-xs text-green-600 font-semibold">
        Done {f.score !== undefined ? `— Score: ${f.score.toFixed(1)}` : ""}
      </span>
    );
    return <span className="text-xs text-red-500">{f.error ?? "Error"}</span>;
  };

  const hasPending = files.some((f) => f.status === "pending");

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push("/jobs")}>← Back</Button>
        <h1 className="text-2xl font-bold text-gray-900">Upload Resumes</h1>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input {...getInputProps()} />
            <div className="text-4xl mb-3">📄</div>
            <p className="text-gray-600 font-medium">
              {isDragActive ? "Drop files here..." : "Drag & drop resumes here"}
            </p>
            <p className="text-sm text-gray-400 mt-1">PDF, DOC, DOCX — up to 10MB each</p>
            <Button type="button" variant="outline" className="mt-4" size="sm">
              Browse Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Files ({files.length})</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" onClick={uploadAll} disabled={uploading || !hasPending}>
                  {uploading ? "Uploading..." : "Upload All"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => router.push(`/jobs/${jobId}/candidates`)}>
                  View Candidates
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{f.name}</p>
                    <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</p>
                  </div>
                  {statusBadge(f)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">What happens after upload?</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-600">
          <li>Resume text is extracted (PDF/DOCX parser)</li>
          <li>AI agent extracts structured candidate data</li>
          <li>Scoring agent computes match score (0–100)</li>
          <li>Bias detection agent flags potential signals</li>
          <li>Candidate appears in the ranked dashboard</li>
        </ol>
      </div>
    </div>
  );
}
