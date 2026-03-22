import { useState } from "react";
import { useListRules, useCreateRule } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, AlertTriangle, Info, AlertCircle, Filter } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { cn } from "@/lib/utils";

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  LOW: "bg-green-100 text-green-800 border-green-200",
};

const SEVERITY_ICONS: Record<string, React.ElementType> = {
  HIGH: AlertTriangle,
  MEDIUM: AlertCircle,
  LOW: Info,
};

const TAX_TYPES = ["income_tax", "sales_tax", "withholding_tax", "customs", "federal_excise"];

export default function TaxRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [taxTypeFilter, setTaxTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useListRules({
    taxType: taxTypeFilter === "all" ? undefined : taxTypeFilter || undefined,
    status: statusFilter === "all" ? undefined : statusFilter || undefined,
  });

  const createMutation = useCreateRule();
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: {
      ruleCode: "",
      title: "",
      description: "",
      taxType: "income_tax",
      severity: "MEDIUM" as "HIGH" | "MEDIUM" | "LOW",
      materialityThreshold: 0,
      effectiveFrom: "",
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(
      {
        data: {
          ...data,
          conditionJson: { auto: true },
          actionJson: { type: "risk_flag", recommendation: data.description },
          materialityThreshold: Number(data.materialityThreshold),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
          toast({ title: "Tax rule created successfully" });
          reset();
          setOpen(false);
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message }),
      }
    );
  };

  const rules = data?.rules ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Tax Rules Engine</h1>
          <p className="text-muted-foreground mt-1">Manage Pakistan tax compliance rules and risk detection logic</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> New Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Tax Rule</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Rule Code</Label>
                  <Input placeholder="PKR-INC-011" {...register("ruleCode", { required: true })} />
                </div>
                <div>
                  <Label>Tax Type</Label>
                  <Controller name="taxType" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TAX_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <div>
                <Label>Title</Label>
                <Input placeholder="Rule title..." {...register("title", { required: true })} />
              </div>
              <div>
                <Label>Description / Recommendation</Label>
                <Textarea rows={3} placeholder="Describe the risk and recommended action..." {...register("description")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Severity</Label>
                  <Controller name="severity" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH">HIGH</SelectItem>
                        <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                        <SelectItem value="LOW">LOW</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div>
                  <Label>Materiality (PKR)</Label>
                  <Input type="number" placeholder="100000" {...register("materialityThreshold")} />
                </div>
              </div>
              <div>
                <Label>Effective From</Label>
                <Input type="date" {...register("effectiveFrom")} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Rule"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Rules", value: data?.total ?? 0, color: "text-foreground" },
          { label: "HIGH Severity", value: rules.filter(r => r.severity === "HIGH").length, color: "text-red-600" },
          { label: "MEDIUM Severity", value: rules.filter(r => r.severity === "MEDIUM").length, color: "text-amber-600" },
          { label: "Active", value: rules.filter(r => r.ruleStatus === "active").length, color: "text-green-600" },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={cn("text-3xl font-bold mt-1", stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={taxTypeFilter || "all"} onValueChange={v => setTaxTypeFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder="All Tax Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tax Types</SelectItem>
                {TAX_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter || "all"} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {(taxTypeFilter || statusFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setTaxTypeFilter(""); setStatusFilter(""); }}>
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Rules Library ({data?.total ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No rules found. Create your first rule.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Rule Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Tax Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-right">Materiality (PKR)</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map(rule => {
                  const SeverityIcon = SEVERITY_ICONS[rule.severity] ?? Info;
                  return (
                    <TableRow key={rule.id} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-sm font-semibold text-primary">{rule.ruleCode}</TableCell>
                      <TableCell>
                        <div className="font-medium">{rule.title}</div>
                        {rule.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{rule.description}</div>}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded font-medium capitalize">
                          {rule.taxType?.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border", SEVERITY_COLORS[rule.severity])}>
                          <SeverityIcon className="w-3 h-3" />
                          {rule.severity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {rule.materialityThreshold ? `Rs. ${Number(rule.materialityThreshold).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{rule.effectiveFrom ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={rule.ruleStatus === "active" ? "default" : "secondary"} className={rule.ruleStatus === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                          {rule.ruleStatus ?? "draft"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
