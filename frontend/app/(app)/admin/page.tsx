"use client";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserCog, Plus, PenLine, PowerOff, Trash2, Shield, Briefcase, Video } from "lucide-react";
import api from "@/lib/api";

// ─── Interviewer types ────────────────────────────────────────────────────────

interface Interviewer {
  id: string;
  name: string;
  email: string;
  department: string;
  skills: string[];
  eligible_rounds: number[];
  max_interviews_per_week: number;
  is_active: boolean;
}

const ivSchema = z.object({
  name: z.string().min(2, "Required"),
  email: z.string().email("Invalid email"),
  department: z.string().min(1, "Required"),
  skills: z.string().min(1, "Required"),
  eligible_rounds: z.string().min(1, "Required"),
  max_interviews_per_week: z.coerce.number().min(1).max(20),
});
type IvForm = z.infer<typeof ivSchema>;

// ─── User types ───────────────────────────────────────────────────────────────

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: "admin" | "recruiter" | "interviewer";
  is_active: boolean;
  created_at: string | null;
}

const userSchema = z.object({
  name: z.string().min(2, "Required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["admin", "recruiter", "interviewer"]),
  password: z.string().min(8, "Min 8 characters").optional().or(z.literal("")),
});
type UserForm = z.infer<typeof userSchema>;

// ─── Shared helpers ───────────────────────────────────────────────────────────

const roleBadge: Record<string, { cls: string; icon: React.ReactNode }> = {
  admin:       { cls: "bg-violet-50 text-violet-700 border border-violet-200",  icon: <Shield className="w-3 h-3" /> },
  recruiter:   { cls: "bg-indigo-50 text-indigo-700 border border-indigo-200",  icon: <Briefcase className="w-3 h-3" /> },
  interviewer: { cls: "bg-sky-50 text-sky-700 border border-sky-200",           icon: <Video className="w-3 h-3" /> },
};

type Tab = "interviewers" | "users";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("interviewers");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage interviewers and system user accounts</p>
      </div>

      {/* Pill tab switcher */}
      <div className="inline-flex bg-gray-100 rounded-xl p-1 mb-6">
        {([
          { key: "interviewers", label: "Interviewers", icon: <UserCog className="w-3.5 h-3.5" /> },
          { key: "users",        label: "User Accounts", icon: <Users className="w-3.5 h-3.5" /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === "interviewers" ? <InterviewerPanel /> : <UserPanel />}
    </div>
  );
}

// ─── Interviewer Panel ────────────────────────────────────────────────────────

function InterviewerPanel() {
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<IvForm>({
    resolver: zodResolver(ivSchema) as Resolver<IvForm>,
    defaultValues: { eligible_rounds: "1,2,3", max_interviews_per_week: 5 },
  });

  const load = () => {
    api.get("/interviewers?active_only=false").then((r) => setInterviewers(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { reset({ eligible_rounds: "1,2,3", max_interviews_per_week: 5 }); setEditId(null); setShowForm(true); };
  const openEdit = (iv: Interviewer) => {
    reset({ name: iv.name, email: iv.email, department: iv.department, skills: iv.skills.join(", "), eligible_rounds: iv.eligible_rounds.join(","), max_interviews_per_week: iv.max_interviews_per_week });
    setEditId(iv.id); setShowForm(true);
  };

  const onSubmit = async (data: IvForm) => {
    setSaving(true);
    try {
      const payload = {
        name: data.name, email: data.email, department: data.department,
        skills: data.skills.split(",").map((s) => s.trim()).filter(Boolean),
        eligible_rounds: data.eligible_rounds.split(",").map((s) => parseInt(s.trim())).filter(Boolean),
        max_interviews_per_week: data.max_interviews_per_week,
      };
      if (editId) { await api.put(`/interviewers/${editId}`, payload); toast.success("Interviewer updated"); }
      else        { await api.post("/interviewers", payload); toast.success("Interviewer added"); }
      setShowForm(false); load();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const toggleActive = async (iv: Interviewer) => {
    try { await api.patch(`/interviewers/${iv.id}`, { is_active: !iv.is_active }); toast.success(iv.is_active ? "Deactivated" : "Activated"); load(); }
    catch { toast.error("Failed to update"); }
  };

  const deleteIv = async (iv: Interviewer) => {
    if (!confirm(`Delete ${iv.name}? This cannot be undone.`)) return;
    try { await api.delete(`/interviewers/${iv.id}`); toast.success("Interviewer deleted"); load(); }
    catch { toast.error("Failed to delete"); }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{interviewers.length} interviewer{interviewers.length !== 1 ? "s" : ""}</p>
        <Button onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" />Add Interviewer</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-xl bg-white border border-gray-200 animate-pulse" />)}</div>
      ) : interviewers.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
            <UserCog className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-gray-600 font-medium">No interviewers yet</p>
          <p className="text-gray-400 text-sm mt-1">Add interviewers to enable round scheduling.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {interviewers.map((iv) => (
            <div key={iv.id} className={`bg-white rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-sm transition-all ${!iv.is_active ? "opacity-55" : ""}`}>
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <UserCog className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{iv.name}</p>
                    {!iv.is_active && <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <p className="text-sm text-gray-500">{iv.email}{iv.department ? ` · ${iv.department}` : ""}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {iv.skills.slice(0, 5).map((s) => (
                      <span key={s} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md">{s}</span>
                    ))}
                    {iv.skills.length > 5 && <span className="text-xs text-gray-400 self-center">+{iv.skills.length - 5} more</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <p className="text-xs text-gray-400">Rounds</p>
                    <p className="text-sm font-semibold text-gray-700">{iv.eligible_rounds.map((r) => `R${r}`).join(", ")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Max/wk</p>
                    <p className="text-sm font-semibold text-gray-700">{iv.max_interviews_per_week}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" className="gap-1 text-gray-600" onClick={() => openEdit(iv)}>
                      <PenLine className="w-3.5 h-3.5" />Edit
                    </Button>
                    <Button size="sm" variant="ghost"
                      className={iv.is_active ? "gap-1 text-red-500 hover:text-red-700 hover:bg-red-50" : "gap-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"}
                      onClick={() => toggleActive(iv)}>
                      <PowerOff className="w-3.5 h-3.5" />{iv.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteIv(iv)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Interviewer" : "Add Interviewer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-gray-600">Name</Label>
                <Input className="mt-1" placeholder="John Smith" {...register("name")} />
                {errors.name && <p className="text-red-500 text-xs mt-0.5">{errors.name.message}</p>}
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Email</Label>
                <Input className="mt-1" type="email" placeholder="john@company.com" {...register("email")} />
                {errors.email && <p className="text-red-500 text-xs mt-0.5">{errors.email.message}</p>}
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Department</Label>
                <Input className="mt-1" placeholder="Engineering" {...register("department")} />
                {errors.department && <p className="text-red-500 text-xs mt-0.5">{errors.department.message}</p>}
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Max Interviews/Week</Label>
                <Input className="mt-1" type="number" min="1" max="20" {...register("max_interviews_per_week")} />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">Skills <span className="text-gray-400 font-normal">(comma-separated)</span></Label>
              <Input className="mt-1" placeholder="Python, System Design, ML" {...register("skills")} />
              {errors.skills && <p className="text-red-500 text-xs mt-0.5">{errors.skills.message}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">Eligible Rounds <span className="text-gray-400 font-normal">(e.g. 1,2,3)</span></Label>
              <Input className="mt-1" placeholder="1,2,3" {...register("eligible_rounds")} />
              {errors.eligible_rounds && <p className="text-red-500 text-xs mt-0.5">{errors.eligible_rounds.message}</p>}
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={saving} className="flex-1">{saving ? "Saving…" : editId ? "Update" : "Add Interviewer"}</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── User Panel ───────────────────────────────────────────────────────────────

function UserPanel() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"admin" | "recruiter" | "interviewer">("recruiter");

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<UserForm>({
    resolver: zodResolver(userSchema) as Resolver<UserForm>,
    defaultValues: { role: "recruiter" },
  });

  const load = () => {
    api.get("/users").then((r) => setUsers(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { reset({ role: "recruiter", password: "" }); setSelectedRole("recruiter"); setEditId(null); setShowForm(true); };
  const openEdit = (u: UserAccount) => { reset({ name: u.name, email: u.email, role: u.role, password: "" }); setSelectedRole(u.role); setEditId(u.id); setShowForm(true); };

  const onSubmit = async (data: UserForm) => {
    setSaving(true);
    try {
      if (editId) {
        const payload: Record<string, unknown> = { name: data.name, role: data.role };
        if (data.password) payload.password = data.password;
        await api.patch(`/users/${editId}`, payload);
        toast.success("User updated");
      } else {
        await api.post("/users", { name: data.name, email: data.email, role: data.role, password: data.password });
        toast.success("User created");
      }
      setShowForm(false); load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Failed to save");
    } finally { setSaving(false); }
  };

  const toggleActive = async (u: UserAccount) => {
    try { await api.patch(`/users/${u.id}`, { is_active: !u.is_active }); toast.success(u.is_active ? "Deactivated" : "Activated"); load(); }
    catch (e: unknown) { toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed"); }
  };

  const deleteUser = async (u: UserAccount) => {
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success("User deleted"); load(); }
    catch (e: unknown) { toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed"); }
  };

  const initials = (name: string) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{users.length} account{users.length !== 1 ? "s" : ""}</p>
        <Button onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" />Add User</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-white border border-gray-200 animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-gray-600 font-medium">No user accounts yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const rb = roleBadge[u.role] ?? roleBadge.recruiter;
            return (
              <div key={u.id} className={`bg-white rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-sm transition-all px-5 py-3.5 flex items-center gap-4 ${!u.is_active ? "opacity-55" : ""}`}>
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-sm font-bold text-indigo-600">
                  {initials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{u.name}</p>
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${rb.cls}`}>{rb.icon}{u.role}</span>
                    {!u.is_active && <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="ghost" className="gap-1 text-gray-600" onClick={() => openEdit(u)}>
                    <PenLine className="w-3.5 h-3.5" />Edit
                  </Button>
                  <Button size="sm" variant="ghost"
                    className={u.is_active ? "gap-1 text-red-500 hover:text-red-700 hover:bg-red-50" : "gap-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"}
                    onClick={() => toggleActive(u)}>
                    <PowerOff className="w-3.5 h-3.5" />{u.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteUser(u)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-medium text-gray-600">Name</Label>
              <Input className="mt-1" placeholder="Jane Doe" {...register("name")} />
              {errors.name && <p className="text-red-500 text-xs mt-0.5">{errors.name.message}</p>}
            </div>
            {!editId && (
              <div>
                <Label className="text-xs font-medium text-gray-600">Email</Label>
                <Input className="mt-1" type="email" placeholder="jane@company.com" {...register("email")} />
                {errors.email && <p className="text-red-500 text-xs mt-0.5">{errors.email.message}</p>}
              </div>
            )}
            <div>
              <Label className="text-xs font-medium text-gray-600">Role</Label>
              <Select value={selectedRole} onValueChange={(v) => { const role = v as "admin" | "recruiter" | "interviewer"; setSelectedRole(role); setValue("role", role); }}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recruiter">Recruiter</SelectItem>
                  <SelectItem value="interviewer">Interviewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-600">
                {editId ? "New Password" : "Password"}
                {editId && <span className="text-gray-400 font-normal text-xs ml-1">(leave blank to keep current)</span>}
              </Label>
              <Input className="mt-1" type="password" placeholder={editId ? "••••••••" : "Min 8 characters"} {...register("password")} />
              {errors.password && <p className="text-red-500 text-xs mt-0.5">{errors.password.message}</p>}
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={saving} className="flex-1">{saving ? "Saving…" : editId ? "Update" : "Create User"}</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
