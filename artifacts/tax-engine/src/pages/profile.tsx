import { useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Shield, Mail, Building2, UserCircle, Key, Clock, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDate(ts?: string | null) {
  if (!ts) return "Never";
  try { return new Date(ts).toLocaleDateString("en-PK", { dateStyle: "long" }); }
  catch { return String(ts); }
}

export default function ProfilePage() {
  const { data: me, isLoading } = useGetMe();
  const { toast } = useToast();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) return toast({ variant: "destructive", title: "Password must be at least 8 characters" });
    if (newPw !== confirmPw) return toast({ variant: "destructive", title: "Passwords do not match" });
    try {
      const token = localStorage.getItem("tax_engine_token");
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed"); }
      toast({ title: "Password changed successfully" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading profile...</div>;
  if (!me) return <div className="p-8 text-center text-destructive">Could not load profile.</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground mt-1">View and manage your account information</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <Avatar className="w-20 h-20">
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                {(me.firstName?.[0] ?? "?")}{(me.lastName?.[0] ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{me.firstName} {me.lastName}</h2>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className={cn("text-xs font-semibold px-2.5 py-1 rounded", {
                  "bg-red-100 text-red-800": me.role === "SUPER_ADMIN",
                  "bg-primary/10 text-primary": me.role === "PARTNER",
                  "bg-purple-100 text-purple-800": me.role === "FIRM_ADMIN",
                  "bg-blue-100 text-blue-800": me.role === "TAX_MANAGER",
                  "bg-cyan-100 text-cyan-800": me.role === "SENIOR",
                  "bg-sky-100 text-sky-800": me.role === "ASSOCIATE",
                })}>{me.role?.replace(/_/g, " ")}</span>
                {me.mfaEnabled ? (
                  <Badge variant="outline" className="border-green-300 text-green-700 gap-1">
                    <Shield className="w-3 h-3" /> MFA Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-300 text-amber-700 gap-1">
                    <Shield className="w-3 h-3" /> MFA Disabled
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCircle className="w-5 h-5 text-primary" /> Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="w-4 h-4" /> Email</span>
              <span className="text-sm font-medium">{me.email}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground flex items-center gap-2"><Building2 className="w-4 h-4" /> Firm</span>
              <span className="text-sm font-medium">{me.firmName || "—"}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground flex items-center gap-2"><Key className="w-4 h-4" /> Role</span>
              <span className="text-sm font-medium capitalize">{me.role?.replace(/_/g, " ").toLowerCase()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4" /> Last Login</span>
              <span className="text-sm font-medium">{formatDate(me.lastLoginAt as string | undefined)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                {me.isActive ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                Status
              </span>
              <span className={cn("text-sm font-medium", me.isActive ? "text-green-700" : "text-red-700")}>
                {me.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Key className="w-5 h-5 text-primary" /> Change Password
            </CardTitle>
            <CardDescription>Update your login password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <Label>Current Password</Label>
                <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password" />
              </div>
              <div>
                <Label>New Password</Label>
                <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters" />
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
              </div>
              <Button type="submit" className="w-full bg-primary">Update Password</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-primary" /> Multi-Factor Authentication
          </CardTitle>
          <CardDescription>
            {me.mfaEnabled
              ? "Two-factor authentication is currently enabled on your account."
              : "Enable two-factor authentication for enhanced security."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {me.mfaEnabled ? (
            <div className="flex items-center gap-3 bg-green-50 dark:bg-green-950/20 p-4 rounded-xl border border-green-200 dark:border-green-900">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-400">MFA is Active</p>
                <p className="text-xs text-green-700 dark:text-green-500">Your account is protected with TOTP-based two-factor authentication.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200 dark:border-amber-900">
                <Shield className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">MFA is Not Enabled</p>
                  <p className="text-xs text-amber-700 dark:text-amber-500">We strongly recommend enabling MFA for your account security.</p>
                </div>
              </div>
              <Button variant="outline" className="border-primary text-primary" onClick={() => toast({ title: "MFA Setup", description: "Contact your Firm Admin to enable MFA via the API." })}>
                Request MFA Setup
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
