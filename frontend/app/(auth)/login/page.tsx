"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { saveTokens } from "@/lib/auth";
import { Sparkles, Brain, ShieldCheck, Zap, Eye, EyeOff } from "lucide-react";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});
type FormData = z.infer<typeof schema>;

const features = [
  { icon: Brain, text: "AI-powered resume parsing & scoring" },
  { icon: ShieldCheck, text: "Bias detection & DEI compliance" },
  { icon: Zap, text: "Automated interview scheduling" },
];

const demoUsers = [
  { role: "Admin", email: "admin@company.com", password: "Admin@1234", color: "bg-violet-500/20 text-violet-300" },
  { role: "Recruiter", email: "recruiter@company.com", password: "Recruiter@1234", color: "bg-indigo-500/20 text-indigo-300" },
  { role: "Interviewer", email: "interviewer@company.com", password: "Interviewer@1234", color: "bg-sky-500/20 text-sky-300" },
];

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", data);
      saveTokens(res.data.access_token, res.data.refresh_token);
      const role = localStorage.getItem("role");
      if (role === "admin") router.push("/admin");
      else if (role === "recruiter") router.push("/jobs");
      else router.push("/feedback");
    } catch {
      toast.error("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email: string, password: string) => {
    setValue("email", email);
    setValue("password", password);
  };

  return (
    <div className="min-h-screen flex">
      <Toaster position="top-right" />

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%)" }}>
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-indigo-500/10" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-violet-500/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-600/5" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">TalentAI</p>
            <p className="text-indigo-300/60 text-xs mt-0.5">Screening System</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Hire smarter,<br />
              <span className="text-indigo-300">not harder.</span>
            </h1>
            <p className="text-indigo-200/70 mt-4 text-base leading-relaxed max-w-sm">
              Gemma AI screens every resume in seconds — unbiased scoring, automated scheduling, full audit trail.
            </p>
          </div>

          <div className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-indigo-300" />
                </div>
                <span className="text-indigo-100/80 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-indigo-400/40 text-xs">Powered by Gemma 3 · FastAPI · Next.js</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-slate-50">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <p className="text-gray-900 font-bold text-lg">TalentAI</p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-700 font-medium">Email address</Label>
              <Input id="email" type="email" placeholder="you@company.com"
                className="h-11 bg-white border-gray-200 focus:border-indigo-500"
                {...register("email")} />
              {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
              <div className="relative">
                <Input id="password" type={showPw ? "text" : "password"} placeholder="••••••••"
                  className="h-11 bg-white border-gray-200 focus:border-indigo-500 pr-10"
                  {...register("password")} />
                <button type="button" onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Demo accounts</p>
            <div className="space-y-2">
              {demoUsers.map(({ role, email, password, color }) => (
                <button key={role} type="button"
                  onClick={() => fillDemo(email, password)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left group">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${color}`}>{role}</span>
                  <span className="text-xs text-gray-500 truncate flex-1">{email}</span>
                  <span className="text-[10px] text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">Fill →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
