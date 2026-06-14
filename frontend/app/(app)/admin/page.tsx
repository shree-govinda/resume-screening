"use client";
import { useEffect, useState } from "react";
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

// ─── Interviewer types ───────────────────────────────────────────────────────

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

// ─── User types ──────────────────────────────────────────────────────────────

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

// ─── Role badge colours ───────────────────────────────────────────────────────

const roleBadge: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  recruiter: "bg-blue-100 text-blue-700",
  interviewer: "bg-green-100 text-green-700",
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "interviewers" | "users";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("interviewers");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Panel</h1>
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(["interviewers", "users"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "interviewers" ? "Interviewers" : "User Accounts"}
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

  const openCreate = () => {
    reset({ eligible_rounds: "1,2,3", max_interviews_per_week: 5 });
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (iv: Interviewer) => {
    reset({
      name: iv.name,
      email: iv.email,
      department: iv.department,
      skills: iv.skills.join(", "),
      eligible_rounds: iv.eligible_rounds.join(","),
      max_interviews_per_week: iv.max_interviews_per_week,
    });
    setEditId(iv.id);
    setShowForm(true);
  };

  const onSubmit = async (data: IvForm) => {
    setSaving(true);
    try {
      const payload = {
        name: data.name,
        email: data.email,
        department: data.department,
        skills: data.skills.split(",").map((s) => s.trim()).filter(Boolean),
        eligible_rounds: data.eligible_rounds.split(",").map((s) => parseInt(s.trim())).filter(Boolean),
        max_interviews_per_week: data.max_interviews_per_week,
      };
      if (editId) {
        await api.put(`/interviewers/${editId}`, payload);
        toast.success("Interviewer updated");
      } else {
        await api.post("/interviewers", payload);
        toast.success("Interviewer added");
      }
      setShowForm(false);
      load();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (iv: Interviewer) => {
    try {
      await api.patch(`/interviewers/${iv.id}`, { is_active: !iv.is_active });
      toast.success(iv.is_active ? "Deactivated" : "Activated");
      load();
    } catch {
      toast.error("Failed to update");
    }
  };

  const deleteIv = async (iv: Interviewer) => {
    if (!confirm(`Delete ${iv.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/interviewers/${iv.id}`);
      toast.success("Interviewer deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{interviewers.length} interviewer{interviewers.length !== 1 ? "s" : ""}</p>
        <Button onClick={openCreate}>+ Add Interviewer</Button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : interviewers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            No interviewers yet. Add some to enable interview scheduling.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {interviewers.map((iv) => (
            <Card key={iv.id} className={!iv.is_active ? "opacity-60" : ""}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{iv.name}</p>
                    {!iv.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <p className="text-sm text-gray-500">{iv.email}{iv.department ? ` · ${iv.department}` : ""}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {iv.skills.slice(0, 5).map((s) => (
                      <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{s}</span>
                    ))}
                    {iv.skills.length > 5 && <span className="text-xs text-gray-400">+{iv.skills.length - 5} more</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-xs text-gray-400">Rounds</p>
                    <p className="text-sm font-medium">{iv.eligible_rounds.map((r) => `R${r}`).join(", ")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Max/week</p>
                    <p className="text-sm font-medium">{iv.max_interviews_per_week}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(iv)}>Edit</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={iv.is_active ? "text-red-600 border-red-200" : "text-green-600 border-green-200"}
                      onClick={() => toggleActive(iv)}
                    >
                      {iv.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200"
                      onClick={() => deleteIv(iv)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                <Label>Name</Label>
                <Input className="mt-1" placeholder="John Smith" {...register("name")} />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label>Email</Label>
                <Input className="mt-1" type="email" placeholder="john@company.com" {...register("email")} />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <Label>Department</Label>
                <Input className="mt-1" placeholder="Engineering" {...register("department")} />
                {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department.message}</p>}
              </div>
              <div>
                <Label>Max Interviews/Week</Label>
                <Input className="mt-1" type="number" min="1" max="20" {...register("max_interviews_per_week")} />
              </div>
            </div>
            <div>
              <Label>Skills <span className="text-gray-400 text-xs">(comma-separated)</span></Label>
              <Input className="mt-1" placeholder="Python, System Design, ML" {...register("skills")} />
              {errors.skills && <p className="text-red-500 text-xs mt-1">{errors.skills.message}</p>}
            </div>
            <div>
              <Label>Eligible Rounds <span className="text-gray-400 text-xs">(comma-separated: 1,2,3)</span></Label>
              <Input className="mt-1" placeholder="1,2,3" {...register("eligible_rounds")} />
              {errors.eligible_rounds && <p className="text-red-500 text-xs mt-1">{errors.eligible_rounds.message}</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving..." : editId ? "Update" : "Add Interviewer"}
              </Button>
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

  const openCreate = () => {
    reset({ role: "recruiter", password: "" });
    setSelectedRole("recruiter");
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (u: UserAccount) => {
    reset({ name: u.name, email: u.email, role: u.role, password: "" });
    setSelectedRole(u.role);
    setEditId(u.id);
    setShowForm(true);
  };

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
      setShowForm(false);
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: UserAccount) => {
    try {
      await api.patch(`/users/${u.id}`, { is_active: !u.is_active });
      toast.success(u.is_active ? "Deactivated" : "Activated");
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Failed to update");
    }
  };

  const deleteUser = async (u: UserAccount) => {
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("User deleted");
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Failed to delete");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{users.length} account{users.length !== 1 ? "s" : ""}</p>
        <Button onClick={openCreate}>+ Add User</Button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id} className={!u.is_active ? "opacity-60" : ""}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{u.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge[u.role]}`}>{u.role}</span>
                    {!u.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <p className="text-sm text-gray-500">{u.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(u)}>Edit</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={u.is_active ? "text-red-600 border-red-200" : "text-green-600 border-green-200"}
                    onClick={() => toggleActive(u)}
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200"
                    onClick={() => deleteUser(u)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div>
              <Label>Name</Label>
              <Input className="mt-1" placeholder="Jane Doe" {...register("name")} />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            {!editId && (
              <div>
                <Label>Email</Label>
                <Input className="mt-1" type="email" placeholder="jane@company.com" {...register("email")} />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
            )}
            <div>
              <Label>Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => {
                  const role = v as "admin" | "recruiter" | "interviewer";
                  setSelectedRole(role);
                  setValue("role", role);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recruiter">Recruiter</SelectItem>
                  <SelectItem value="interviewer">Interviewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{editId ? "New Password" : "Password"} {editId && <span className="text-gray-400 text-xs">(leave blank to keep current)</span>}</Label>
              <Input className="mt-1" type="password" placeholder={editId ? "••••••••" : "Min 8 characters"} {...register("password")} />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving..." : editId ? "Update" : "Create User"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
