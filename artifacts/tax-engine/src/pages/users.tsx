import { useState } from "react";
import { useListUsers, useCreateUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Shield, CheckCircle, XCircle } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "PARTNER", label: "Partner" },
  { value: "FIRM_ADMIN", label: "Firm Admin" },
  { value: "TAX_MANAGER", label: "Tax Manager" },
  { value: "SENIOR", label: "Senior" },
  { value: "ASSOCIATE", label: "Associate" },
  { value: "REVIEWER", label: "Reviewer" },
  { value: "CLIENT_USER", label: "Client User" },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-800",
  FIRM_ADMIN: "bg-purple-100 text-purple-800",
  PARTNER: "bg-primary/10 text-primary",
  TAX_MANAGER: "bg-blue-100 text-blue-800",
  SENIOR: "bg-cyan-100 text-cyan-800",
  ASSOCIATE: "bg-sky-100 text-sky-800",
  REVIEWER: "bg-indigo-100 text-indigo-800",
  CLIENT_USER: "bg-slate-100 text-slate-700",
};

function getInitials(firstName?: string, lastName?: string) {
  return `${(firstName ?? "?")[0]}${(lastName ?? "?")[0]}`.toUpperCase();
}

function formatDate(ts?: string | null) {
  if (!ts) return "Never";
  try {
    return new Date(ts).toLocaleDateString("en-PK", { dateStyle: "medium" });
  } catch {
    return ts;
  }
}

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useListUsers();
  const createMutation = useCreateUser();

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      role: "ASSOCIATE",
      password: "",
    },
  });

  const onSubmit = (formData: any) => {
    createMutation.mutate(
      { data: formData },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/users"] });
          toast({ title: "User created successfully" });
          reset();
          setOpen(false);
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Error creating user", description: err.message }),
      }
    );
  };

  const users = data?.users ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Team & Users</h1>
          <p className="text-muted-foreground mt-1">Manage firm members and their access roles</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Invite User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Name</Label>
                  <Input {...register("firstName", { required: true })} placeholder="Ahmad" />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input {...register("lastName", { required: true })} placeholder="Khan" />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" {...register("email", { required: true })} placeholder="ahmad@firm.com" />
              </div>
              <div>
                <Label>Role</Label>
                <Controller name="role" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label>Temporary Password</Label>
                <Input type="password" {...register("password", { required: true, minLength: 8 })} placeholder="Min. 8 characters" />
                {errors.password && <p className="text-xs text-destructive mt-1">Password must be at least 8 characters</p>}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Members", value: users.length },
          { label: "Active", value: users.filter(u => u.isActive).length },
          { label: "MFA Enabled", value: users.filter(u => u.mfaEnabled).length },
          { label: "Roles", value: new Set(users.map(u => u.role)).size },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-3xl font-bold mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Team Members ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center animate-pulse text-muted-foreground">Loading team...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No team members found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MFA</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                            {getInitials(user.firstName, user.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{user.firstName} {user.lastName}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", ROLE_COLORS[user.role ?? ""] ?? "bg-muted text-muted-foreground")}>
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <span className="flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <XCircle className="w-3.5 h-3.5" /> Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.mfaEnabled ? (
                        <span className="flex items-center gap-1 text-xs text-green-700">
                          <Shield className="w-3.5 h-3.5" /> On
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Off</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(user.lastLoginAt as string | undefined)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(user.createdAt as string | undefined)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
