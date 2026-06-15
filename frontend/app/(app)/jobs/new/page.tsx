"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase, FileText, BarChart2, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";

const schema = z.object({
  title: z.string().min(2, "Required"),
  department: z.string().min(1, "Required"),
  location: z.string().min(1, "Required"),
  employment_type: z.string().min(1, "Required"),
  experience_years_min: z.coerce.number().min(0),
  experience_years_max: z.coerce.number().min(0),
  required_skills: z.string().min(1, "Required"),
  nice_to_have_skills: z.string(),
  responsibilities: z.string().min(1, "Required"),
  qualifications: z.string().min(1, "Required"),
  w_skills: z.coerce.number().min(0).max(100),
  w_relevance: z.coerce.number().min(0).max(100),
  w_experience: z.coerce.number().min(0).max(100),
  w_education: z.coerce.number().min(0).max(100),
  w_progression: z.coerce.number().min(0).max(100),
  w_certifications: z.coerce.number().min(0).max(100),
});

type FormData = z.infer<typeof schema>;

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      w_skills: 35, w_relevance: 25, w_experience: 20,
      w_education: 10, w_progression: 5, w_certifications: 5,
    },
  });

  const weights = watch(["w_skills", "w_relevance", "w_experience", "w_education", "w_progression", "w_certifications"]);
  const total = weights.reduce((s, v) => s + (Number(v) || 0), 0);

  const onSubmit = async (data: FormData) => {
    if (total !== 100) { toast.error("Scoring weights must sum to 100"); return; }
    setLoading(true);
    try {
      const payload = {
        title: data.title,
        department: data.department,
        structured_jd: {
          location: data.location,
          employment_type: data.employment_type,
          experience_years: { min: data.experience_years_min, max: data.experience_years_max },
          required_skills: data.required_skills.split(",").map((s) => s.trim()).filter(Boolean),
          nice_to_have_skills: data.nice_to_have_skills.split(",").map((s) => s.trim()).filter(Boolean),
          responsibilities: data.responsibilities,
          qualifications: data.qualifications,
        },
        scoring_weights: {
          skills_match: data.w_skills,
          role_relevance: data.w_relevance,
          years_experience: data.w_experience,
          education: data.w_education,
          career_progression: data.w_progression,
          certifications: data.w_certifications,
        },
      };
      const res = await api.post("/jobs", payload);
      toast.success("Job posting created!");
      router.push(`/jobs/${res.data.id}/upload`);
    } catch {
      toast.error("Failed to create job posting");
    } finally {
      setLoading(false);
    }
  };

  function Field({ name, label, placeholder, type = "text" }: { name: keyof FormData; label: string; placeholder?: string; type?: string }) {
    return (
      <div>
        <Label className="text-xs font-medium text-gray-600">{label}</Label>
        <Input id={String(name)} type={type} placeholder={placeholder} {...register(name)} className="mt-1" />
        {errors[name] && <p className="text-red-500 text-xs mt-0.5">{errors[name]?.message as string}</p>}
      </div>
    );
  }

  const weightFields = [
    { name: "w_skills" as const,       label: "Skills Match",        default: 35 },
    { name: "w_relevance" as const,    label: "Role Relevance",      default: 25 },
    { name: "w_experience" as const,   label: "Years Experience",    default: 20 },
    { name: "w_education" as const,    label: "Education",           default: 10 },
    { name: "w_progression" as const,  label: "Career Progression",  default: 5  },
    { name: "w_certifications" as const, label: "Certifications",   default: 5  },
  ];

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" className="gap-1.5 text-gray-600" onClick={() => router.push("/jobs")}>
          <ArrowLeft className="w-4 h-4" />Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Job Posting</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fill in the details and set scoring weights for AI screening</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Basic Info */}
        <Card className="bg-white border border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <CardTitle className="text-sm font-semibold text-gray-700">Basic Info</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 grid grid-cols-2 gap-4">
            <Field name="title" label="Job Title" placeholder="Senior Software Engineer" />
            <Field name="department" label="Department" placeholder="Engineering" />
            <Field name="location" label="Location" placeholder="Remote / Mumbai" />
            <Field name="employment_type" label="Employment Type" placeholder="Full-time" />
            <Field name="experience_years_min" label="Min Experience (years)" type="number" />
            <Field name="experience_years_max" label="Max Experience (years)" type="number" />
          </CardContent>
        </Card>

        {/* Job Description */}
        <Card className="bg-white border border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-violet-600" />
              </div>
              <CardTitle className="text-sm font-semibold text-gray-700">Job Description</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div>
              <Label className="text-xs font-medium text-gray-600">Required Skills <span className="text-gray-400 font-normal">(comma-separated)</span></Label>
              <Input className="mt-1" placeholder="Python, FastAPI, PostgreSQL" {...register("required_skills")} />
              {errors.required_skills && <p className="text-red-500 text-xs mt-0.5">{errors.required_skills.message}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">Nice-to-Have Skills <span className="text-gray-400 font-normal">(comma-separated)</span></Label>
              <Input className="mt-1" placeholder="Docker, Kubernetes, Redis" {...register("nice_to_have_skills")} />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">Responsibilities</Label>
              <Textarea className="mt-1" rows={4} placeholder="Describe key responsibilities…" {...register("responsibilities")} />
              {errors.responsibilities && <p className="text-red-500 text-xs mt-0.5">{errors.responsibilities.message}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">Qualifications</Label>
              <Textarea className="mt-1" rows={3} placeholder="Required qualifications…" {...register("qualifications")} />
              {errors.qualifications && <p className="text-red-500 text-xs mt-0.5">{errors.qualifications.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Scoring Weights */}
        <Card className="bg-white border border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <BarChart2 className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <CardTitle className="text-sm font-semibold text-gray-700">AI Scoring Weights</CardTitle>
              </div>
              <div className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full border ${
                total === 100
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-600 border-red-200"
              }`}>
                {total === 100 && <CheckCircle2 className="w-3.5 h-3.5" />}
                {total}/100
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-4">
              {weightFields.map(({ name, label, default: def }) => (
                <div key={name}>
                  <Label className="text-xs font-medium text-gray-600">{label}</Label>
                  <div className="relative mt-1">
                    <Input type="number" min="0" max="100" className="pr-8 text-center font-semibold" {...register(name)} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">default {def}%</p>
                </div>
              ))}
            </div>
            {total !== 100 && (
              <p className="text-xs text-red-500 mt-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                Weights must sum to exactly 100%. Currently: {total}% ({total > 100 ? `over by ${total - 100}%` : `${100 - total}% remaining`})
              </p>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex gap-3 pb-2">
          <Button type="submit" disabled={loading || total !== 100} className="gap-2">
            {loading ? "Creating…" : "Create Job & Upload Resumes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/jobs")}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
