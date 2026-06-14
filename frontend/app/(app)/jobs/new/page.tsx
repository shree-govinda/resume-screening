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

  const Field = ({ name, label, placeholder, type = "text" }: { name: keyof FormData; label: string; placeholder?: string; type?: string }) => (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type={type} placeholder={placeholder} {...register(name)} className="mt-1" />
      {errors[name] && <p className="text-red-500 text-xs mt-1">{errors[name]?.message as string}</p>}
    </div>
  );

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Job Posting</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field name="title" label="Job Title" placeholder="Senior Software Engineer" />
            <Field name="department" label="Department" placeholder="Engineering" />
            <Field name="location" label="Location" placeholder="Remote / Mumbai" />
            <Field name="employment_type" label="Employment Type" placeholder="Full-time" />
            <Field name="experience_years_min" label="Min Experience (yrs)" type="number" />
            <Field name="experience_years_max" label="Max Experience (yrs)" type="number" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Job Description</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Required Skills <span className="text-gray-400 text-xs">(comma-separated)</span></Label>
              <Input className="mt-1" placeholder="Python, FastAPI, PostgreSQL" {...register("required_skills")} />
              {errors.required_skills && <p className="text-red-500 text-xs mt-1">{errors.required_skills.message}</p>}
            </div>
            <div>
              <Label>Nice-to-Have Skills <span className="text-gray-400 text-xs">(comma-separated)</span></Label>
              <Input className="mt-1" placeholder="Docker, Kubernetes, Redis" {...register("nice_to_have_skills")} />
            </div>
            <div>
              <Label>Responsibilities</Label>
              <Textarea className="mt-1" rows={4} placeholder="Describe key responsibilities..." {...register("responsibilities")} />
              {errors.responsibilities && <p className="text-red-500 text-xs mt-1">{errors.responsibilities.message}</p>}
            </div>
            <div>
              <Label>Qualifications</Label>
              <Textarea className="mt-1" rows={3} placeholder="Required qualifications..." {...register("qualifications")} />
              {errors.qualifications && <p className="text-red-500 text-xs mt-1">{errors.qualifications.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Scoring Weights</CardTitle>
              <span className={`text-sm font-semibold ${total === 100 ? "text-green-600" : "text-red-500"}`}>
                Total: {total}/100
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            {[
              { name: "w_skills" as const, label: "Skills Match (35%)" },
              { name: "w_relevance" as const, label: "Role Relevance (25%)" },
              { name: "w_experience" as const, label: "Years Experience (20%)" },
              { name: "w_education" as const, label: "Education (10%)" },
              { name: "w_progression" as const, label: "Career Progression (5%)" },
              { name: "w_certifications" as const, label: "Certifications (5%)" },
            ].map(({ name, label }) => (
              <div key={name}>
                <Label>{label}</Label>
                <Input type="number" min="0" max="100" className="mt-1" {...register(name)} />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading || total !== 100}>
            {loading ? "Creating..." : "Create Job & Upload Resumes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/jobs")}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
