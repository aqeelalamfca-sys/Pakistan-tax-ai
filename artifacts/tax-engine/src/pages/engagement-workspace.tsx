import { useState, useRef } from "react";
import { useRoute } from "wouter";
import { 
  useGetEngagement, useUpdateEngagementStatus, useListUploads, useCreateUpload, 
  useGetValidationResults, useRunValidation, useGetMappings, useSaveMapping,
  useGetComputation, useSaveComputation, useLockComputation, useUnlockComputation,
  useGetWithholdingEntries, useListRisks, useUpdateRiskStatus,
  useListReviewNotes, useCreateReviewNote, useApproveEngagement,
  useGenerateAiOutput, usePromoteAiOutput
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  UploadCloud, FileCheck, Map, Calculator, Shield, Database, FolderKanban, ArrowRightLeft,
  AlertTriangle, MessageSquare, Sparkles, CheckCircle2, XCircle, FileType, CheckCircle, Lock, Unlock, Play,
  ClipboardCheck, Send, Eye, Calendar, User, BarChart3, TrendingUp
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useAuth, hasRequiredRole } from "@/hooks/use-auth";

// --- Tab Components ---

const UploadCenter = ({ engagementId }: { engagementId: string }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("general_ledger");
  const { data, isLoading } = useListUploads({ engagementId });
  const uploadMutation = useCreateUpload();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    uploadMutation.mutate(
      { data: { engagementId, category, file } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
          toast({ title: "File uploaded successfully" });
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
        onError: (err) => toast({ variant: "destructive", title: "Upload failed", description: err.message })
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-dashed border-2 bg-muted/10">
        <CardContent className="pt-6 pb-8 flex flex-col items-center justify-center">
          <UploadCloud className="w-12 h-12 text-primary/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Upload Data Source</h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
            Upload trial balances, ledgers, and withholding schedules. The Parser Service will automatically extract and normalize the data.
          </p>
          <div className="flex gap-4 items-center">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[200px] bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trial_balance">Trial Balance</SelectItem>
                <SelectItem value="general_ledger">General Ledger</SelectItem>
                <SelectItem value="withholding_schedule">Withholding Schedule</SelectItem>
                <SelectItem value="tax_notices">Tax Notices</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending} className="bg-primary text-white">
              {uploadMutation.isPending ? "Uploading..." : "Select File"}
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} accept=".csv,.xlsx,.xls,.pdf" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Uploaded Documents</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow><TableHead>File Name</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {data?.uploads.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <FileType className="w-4 h-4 text-muted-foreground"/> {u.fileName}
                </TableCell>
                <TableCell className="text-xs font-mono">{u.category}</TableCell>
                <TableCell>
                  <span className={cn("px-2 py-1 rounded text-xs font-semibold", 
                    u.parsedStatus === 'COMPLETED' ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                  )}>{u.parsedStatus}</span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDate(u.createdAt)}</TableCell>
              </TableRow>
            ))}
            {!data?.uploads?.length && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No files uploaded yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

const ValidationTab = ({ engagementId }: { engagementId: string }) => {
  const { data, isLoading } = useGetValidationResults(engagementId);
  const runMutation = useRunValidation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRun = () => {
    runMutation.mutate({ engagementId }, {
      onSuccess: () => {
        toast({ title: "Validation Rules Executed" });
        queryClient.invalidateQueries({ queryKey: [`/api/validation/${engagementId}`] });
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
        <div>
          <h3 className="text-lg font-semibold">Data Validation</h3>
          <p className="text-sm text-muted-foreground">Verify ledger integrity, debits vs credits, and identify anomalous rows before mapping.</p>
        </div>
        <Button onClick={handleRun} disabled={runMutation.isPending} className="bg-primary">
          <Play className="w-4 h-4 mr-2" /> Run Checks
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900"><CardContent className="p-4"><p className="text-sm text-green-800 dark:text-green-400 font-medium">Passed Checks</p><p className="text-2xl font-bold text-green-700 dark:text-green-500">{data?.summary?.passed || 0}</p></CardContent></Card>
        <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"><CardContent className="p-4"><p className="text-sm text-amber-800 dark:text-amber-400 font-medium">Warnings</p><p className="text-2xl font-bold text-amber-700 dark:text-amber-500">{data?.summary?.warnings || 0}</p></CardContent></Card>
        <Card className="bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900"><CardContent className="p-4"><p className="text-sm text-red-800 dark:text-red-400 font-medium">Failed Checks</p><p className="text-2xl font-bold text-red-700 dark:text-red-500">{data?.summary?.failed || 0}</p></CardContent></Card>
      </div>

      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Check Type</TableHead><TableHead>Status</TableHead><TableHead>Message</TableHead><TableHead>Suggested Fix</TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.results?.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium text-sm">{r.checkType.replace(/_/g, ' ')}</TableCell>
                <TableCell>
                  {r.status === 'PASS' && <span className="text-green-600 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/> Pass</span>}
                  {r.status === 'WARNING' && <span className="text-amber-600 flex items-center"><AlertTriangle className="w-4 h-4 mr-1"/> Warn</span>}
                  {r.status === 'FAIL' && <span className="text-red-600 flex items-center"><XCircle className="w-4 h-4 mr-1"/> Fail</span>}
                </TableCell>
                <TableCell className="text-sm">{r.message}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.suggestedFix || '-'}</TableCell>
              </TableRow>
            ))}
            {!data?.results?.length && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No checks executed yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

const ComputationTab = ({ engagementId, isPartner }: { engagementId: string, isPartner: boolean }) => {
  const { data, isLoading } = useGetComputation(engagementId);
  const saveMutation = useSaveComputation();
  const lockMutation = useLockComputation();
  const unlockMutation = useUnlockComputation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [accountingResult, setAccountingResult] = useState("");

  const handleSave = () => {
    saveMutation.mutate(
      { engagementId, data: { accountingResult: Number(accountingResult) || 0 } },
      { onSuccess: () => {
        toast({ title: "Saved successfully" });
        queryClient.invalidateQueries({ queryKey: [`/api/computation/${engagementId}`] });
      }}
    );
  };

  const handleLock = () => {
    lockMutation.mutate({ engagementId }, {
      onSuccess: () => {
        toast({ title: "Computation Locked" });
        queryClient.invalidateQueries({ queryKey: [`/api/computation/${engagementId}`] });
      },
      onError: (err) => toast({ variant: "destructive", title: "Cannot lock", description: err.message })
    });
  };

  const handleUnlock = () => {
    unlockMutation.mutate({ engagementId, data: { reopenReason: "Partner Override" } }, {
      onSuccess: () => {
        toast({ title: "Computation Unlocked" });
        queryClient.invalidateQueries({ queryKey: [`/api/computation/${engagementId}`] });
      }
    });
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading workspace...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${data?.isLocked ? 'bg-primary' : 'bg-amber-500'}`}>
            {data?.isLocked ? <Lock className="w-5 h-5"/> : <Calculator className="w-5 h-5"/>}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{data?.isLocked ? "Final Position Locked" : "Draft Computation"}</h3>
            <p className="text-sm text-muted-foreground">Snapshot ID: {data?.id.substring(0,8)} • Updated: {formatDate(data?.updatedAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!data?.isLocked && <Button variant="outline" onClick={handleSave} disabled={saveMutation.isPending}>Save Draft</Button>}
          {isPartner && !data?.isLocked && <Button className="bg-primary" onClick={handleLock} disabled={lockMutation.isPending}><Lock className="w-4 h-4 mr-2"/> Approve & Lock</Button>}
          {isPartner && data?.isLocked && <Button variant="destructive" onClick={handleUnlock} disabled={unlockMutation.isPending}><Unlock className="w-4 h-4 mr-2"/> Reopen Workspace</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className={cn(data?.isLocked && "opacity-80 pointer-events-none")}>
            <CardHeader className="border-b bg-muted/10 pb-4"><CardTitle>Primary Inputs</CardTitle></CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <Label>Accounting Profit / (Loss)</Label>
                <div className="flex items-center w-1/3">
                  <span className="px-3 py-2 bg-muted border border-r-0 rounded-l-md text-sm">PKR</span>
                  <Input 
                    type="number" 
                    defaultValue={data?.accountingResult || ""} 
                    onChange={e => setAccountingResult(e.target.value)}
                    className="rounded-l-none font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Tax Rate (%)</Label>
                <div className="flex items-center w-1/3">
                  <Input type="number" defaultValue="29" readOnly className="rounded-r-none font-mono text-right" />
                  <span className="px-3 py-2 bg-muted border border-l-0 rounded-r-md text-sm">%</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="border-b bg-muted/10 pb-4"><CardTitle>Tax Adjustments (Auto-Calculated)</CardTitle></CardHeader>
            <Table>
              <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Amount (PKR)</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell>Inadmissible Expenses (Add)</TableCell><TableCell className="text-right font-mono">{formatCurrency(data?.totalAdjustments || 0)}</TableCell></TableRow>
                <TableRow><TableCell>Admissible Deductions (Less)</TableCell><TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(0)}</TableCell></TableRow>
                <TableRow className="bg-muted/30 font-bold"><TableCell>Net Adjustments</TableCell><TableCell className="text-right font-mono text-primary">{formatCurrency(data?.totalAdjustments || 0)}</TableCell></TableRow>
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground shadow-xl border-none relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <CardHeader className="pb-2"><CardTitle className="text-primary-foreground/80 text-sm font-medium">Final Tax Position</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/20 pb-3">
                  <span className="text-sm">Taxable Income</span>
                  <span className="font-mono text-lg font-semibold">{formatCurrency(data?.taxableIncome || 0)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/20 pb-3">
                  <span className="text-sm">Gross Tax</span>
                  <span className="font-mono text-lg font-semibold">{formatCurrency(data?.grossTax || 0)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/20 pb-3">
                  <span className="text-sm">Less: Withholding</span>
                  <span className="font-mono text-lg font-semibold">({formatCurrency(data?.lessWithholding || 0)})</span>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <span className="text-lg font-bold">Net Payable</span>
                  <span className="font-mono text-2xl font-bold">{formatCurrency(data?.netPayableOrRefundable || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {data?.aiCommentary && (
            <Card className="bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900">
              <CardHeader className="pb-2 flex flex-row items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <CardTitle className="text-sm text-emerald-800 dark:text-emerald-400">AI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-emerald-900/80 dark:text-emerald-300 leading-relaxed">{data.aiCommentary}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

const OverviewTab = ({ engagement }: { engagement: any }) => {
  const { data: uploads } = useListUploads({ engagementId: engagement.id });
  const { data: risks } = useListRisks(engagement.id);
  const { data: notes } = useListReviewNotes(engagement.id);
  const { data: computation } = useGetComputation(engagement.id);

  const uploadCount = uploads?.uploads?.length ?? 0;
  const riskCount = risks?.risks?.length ?? 0;
  const openHighRisks = (risks?.risks ?? []).filter((r: any) => r.severity === "HIGH" && r.status === "open").length;
  const noteCount = notes?.notes?.length ?? 0;

  const STATUS_STEPS = [
    { key: "DATA_COLLECTION", label: "Data Collection" },
    { key: "VALIDATION", label: "Validation" },
    { key: "MAPPING", label: "Mapping" },
    { key: "COMPUTATION", label: "Computation" },
    { key: "REVIEW", label: "Review" },
    { key: "PARTNER_APPROVAL", label: "Partner Approval" },
    { key: "FILED", label: "Filed" },
  ];

  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === engagement.status);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Files Uploaded", value: uploadCount, icon: UploadCloud, color: "text-blue-600" },
          { label: "Open Risks", value: riskCount, icon: Shield, color: riskCount > 0 ? "text-amber-600" : "text-green-600" },
          { label: "Review Notes", value: noteCount, icon: MessageSquare, color: "text-indigo-600" },
          { label: "Computation", value: computation?.isLocked ? "Locked" : "Draft", icon: Calculator, color: computation?.isLocked ? "text-green-600" : "text-amber-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-5 pb-4 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-muted", s.color)}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn("text-2xl font-bold mt-0.5", s.color)}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {openHighRisks > 0 && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-400"><strong>{openHighRisks} HIGH severity risk{openHighRisks > 1 ? "s" : ""}</strong> must be resolved before computation can be locked.</p>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Workflow Progress</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-1">
            {STATUS_STEPS.map((step, idx) => {
              const done = idx < currentStepIdx;
              const active = idx === currentStepIdx;
              return (
                <div key={step.key} className="flex-1 flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                    done ? "bg-primary border-primary text-primary-foreground" :
                    active ? "bg-primary/10 border-primary text-primary" :
                    "bg-muted border-border text-muted-foreground"
                  )}>
                    {done ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>
                  <p className={cn("text-[10px] mt-1.5 text-center font-medium leading-tight", active ? "text-primary" : "text-muted-foreground")}>
                    {step.label}
                  </p>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div className={cn("h-0.5 w-full mt-[-22px] mb-6", done ? "bg-primary" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Engagement Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Client", value: engagement.clientName },
              { label: "Tax Year", value: engagement.taxYear },
              { label: "Return Type", value: engagement.returnType?.replace(/_/g, " ") },
              { label: "Status", value: engagement.status?.replace(/_/g, " ") },
              { label: "Assigned To", value: engagement.assignedUserName || "Unassigned" },
              { label: "Deadline", value: engagement.deadline ? formatDate(engagement.deadline) : "Not set" },
              { label: "Created", value: formatDate(engagement.createdAt) },
            ].map(item => (
              <div key={item.label} className="flex justify-between py-1.5 border-b border-border/30 last:border-0">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Accounting Profit", value: formatCurrency(computation?.accountingResult ?? 0) },
              { label: "Total Adjustments", value: formatCurrency(computation?.totalAdjustments ?? 0) },
              { label: "Taxable Income", value: formatCurrency(computation?.taxableIncome ?? 0) },
              { label: "Gross Tax", value: formatCurrency(computation?.grossTax ?? 0) },
              { label: "Less: WHT Credits", value: `(${formatCurrency(computation?.lessWithholding ?? 0)})` },
              { label: "Net Payable / Refundable", value: formatCurrency(computation?.netPayableOrRefundable ?? 0), bold: true },
            ].map(item => (
              <div key={item.label} className={cn("flex justify-between py-1.5 border-b border-border/30 last:border-0", item.bold && "pt-3 mt-1 border-t-2 border-primary/20")}>
                <span className={cn("text-sm", item.bold ? "font-semibold text-foreground" : "text-muted-foreground")}>{item.label}</span>
                <span className={cn("text-sm font-mono", item.bold ? "font-bold text-primary text-lg" : "font-medium")}>{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const MappingTab = ({ engagementId }: { engagementId: string }) => {
  const { data, isLoading } = useGetMappings(engagementId);
  const saveMutation = useSaveMapping();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taxCode, setTaxCode] = useState("");

  const mappings = (data?.mappings ?? []) as any[];

  const handleSave = (sourceAccount: string) => {
    saveMutation.mutate(
      { engagementId, data: { sourceAccount, taxCode } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/mapping/${engagementId}`] });
          toast({ title: "Mapping saved" });
          setEditingId(null);
          setTaxCode("");
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message }),
      }
    );
  };

  const mapped = mappings.filter(m => m.taxCode || m.taxAccountCode);
  const unmapped = mappings.filter(m => !m.taxCode && !m.taxAccountCode);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
        <div>
          <h3 className="text-lg font-semibold">Account Mapping</h3>
          <p className="text-sm text-muted-foreground">Map chart-of-accounts entries to Pakistan tax return line items</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{mapped.length}</p>
            <p className="text-xs text-muted-foreground">Mapped</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{unmapped.length}</p>
            <p className="text-xs text-muted-foreground">Unmapped</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{mappings.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </div>

      {mappings.length > 0 && (
        <div className="w-full bg-muted/50 rounded-full h-2.5">
          <div
            className="bg-primary h-2.5 rounded-full transition-all"
            style={{ width: `${mappings.length > 0 ? (mapped.length / mappings.length) * 100 : 0}%` }}
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Account Mappings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center animate-pulse text-muted-foreground">Loading mappings...</div>
          ) : mappings.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No account data available. Upload a trial balance or general ledger first.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source Account</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead className="text-right">Balance (PKR)</TableHead>
                  <TableHead>Tax Return Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map(m => {
                  const code = m.sourceAccount ?? m.accountCode ?? m.id;
                  const name = m.accountName ?? m.sourceAccountName ?? "—";
                  const balance = Number(m.balance ?? m.amount ?? 0);
                  const mapped = m.taxCode ?? m.taxAccountCode;
                  const isEditing = editingId === code;
                  return (
                    <TableRow key={m.id ?? code} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-sm font-semibold">{code}</TableCell>
                      <TableCell className="text-sm">{name}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(balance)}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            className="h-8 w-40 text-sm"
                            placeholder="e.g. IT-101"
                            value={taxCode}
                            onChange={e => setTaxCode(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <span className={cn("text-sm", mapped ? "font-mono font-medium text-primary" : "text-muted-foreground italic")}>
                            {mapped || "Not mapped"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {mapped ? (
                          <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Mapped</span>
                        ) : (
                          <span className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs bg-primary" onClick={() => handleSave(code)} disabled={saveMutation.isPending}>
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingId(code); setTaxCode(mapped ?? ""); }}>
                            {mapped ? "Edit" : "Map"}
                          </Button>
                        )}
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
};

const ReviewNotesTab = ({ engagementId, isPartner }: { engagementId: string; isPartner: boolean }) => {
  const { data, isLoading } = useListReviewNotes(engagementId);
  const createMutation = useCreateReviewNote();
  const approveMutation = useApproveEngagement();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState("comment");

  const notes = (data?.notes ?? []) as any[];
  const openNotes = notes.filter(n => n.status === "open" || !n.resolvedAt);

  const handleCreateNote = () => {
    if (!noteContent.trim()) return toast({ variant: "destructive", title: "Note content is required" });
    createMutation.mutate(
      { engagementId, data: { content: noteContent, noteType, section: "general" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/reviews/${engagementId}/notes`] });
          toast({ title: "Review note added" });
          setNoteContent("");
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message }),
      }
    );
  };

  const handleApprove = () => {
    approveMutation.mutate(
      { engagementId, data: { decision: "APPROVED", comments: "Approved by Partner" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/engagements/${engagementId}`] });
          toast({ title: "Engagement approved by Partner" });
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Cannot approve", description: err.message }),
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {isPartner && (
        <div className="flex justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
          <div>
            <h3 className="text-lg font-semibold">Partner Approval</h3>
            <p className="text-sm text-muted-foreground">
              {openNotes.length > 0
                ? `${openNotes.length} open review note${openNotes.length > 1 ? "s" : ""} must be resolved before approval.`
                : "All review notes are resolved. Ready for partner approval."}
            </p>
          </div>
          <Button
            onClick={handleApprove}
            disabled={approveMutation.isPending || openNotes.length > 0}
            className={cn("bg-primary", openNotes.length > 0 && "opacity-50")}
          >
            <ClipboardCheck className="w-4 h-4 mr-2" /> Approve Engagement
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Add Review Note</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Textarea
                placeholder="Enter review note, question, or observation..."
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comment">Comment</SelectItem>
                  <SelectItem value="query">Query</SelectItem>
                  <SelectItem value="issue">Issue</SelectItem>
                  <SelectItem value="action_item">Action Item</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCreateNote} disabled={createMutation.isPending} className="w-full bg-primary">
                <Send className="w-4 h-4 mr-2" /> Post Note
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Review Notes ({notes.length})
            {openNotes.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800">{openNotes.length} open</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center animate-pulse text-muted-foreground">Loading notes...</div>
          ) : notes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No review notes yet. Add the first note above.</div>
          ) : (
            <div className="divide-y divide-border/50">
              {notes.map((note: any) => {
                const isOpen = note.status === "open" || !note.resolvedAt;
                const typeColors: Record<string, string> = {
                  comment: "bg-blue-100 text-blue-800",
                  query: "bg-purple-100 text-purple-800",
                  issue: "bg-red-100 text-red-800",
                  action_item: "bg-amber-100 text-amber-800",
                };
                return (
                  <div key={note.id} className={cn("p-4 hover:bg-muted/20 transition-colors", !isOpen && "opacity-60")}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase", typeColors[note.noteType ?? "comment"] ?? "bg-muted text-muted-foreground")}>
                            {(note.noteType ?? "comment").replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            by {note.authorName ?? note.createdByName ?? "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {note.createdAt ? formatDate(note.createdAt) : ""}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{note.content}</p>
                        {note.section && note.section !== "general" && (
                          <p className="text-xs text-muted-foreground mt-1">Section: {note.section}</p>
                        )}
                      </div>
                      <div>
                        {isOpen ? (
                          <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> Open
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Resolved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const WithholdingTab = ({ engagementId }: { engagementId: string }) => {
  const { data, isLoading } = useGetWithholdingEntries(engagementId);
  const entries = (data?.entries ?? []) as any[];
  const exceptions = entries.filter(e => e.isException || e.hasException || Number(e.shortDeduction) > 0);
  const totalWHT = entries.reduce((s, e) => s + Number(e.whtDeducted ?? e.amountWithheld ?? 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Entries</p>
            <p className="text-3xl font-bold mt-1">{entries.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 border-amber-200">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-800 font-medium">Exceptions / Mismatches</p>
            <p className="text-3xl font-bold text-amber-700 mt-1">{exceptions.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total WHT Amount</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(totalWHT)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <FileType className="w-5 h-5 text-primary" />
            Withholding Tax Register
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center animate-pulse text-muted-foreground">Loading WHT entries...</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No withholding entries found. Upload a withholding schedule first.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payer</TableHead>
                  <TableHead>NTN / CNIC</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-right">Gross Amount</TableHead>
                  <TableHead className="text-right">WHT Rate %</TableHead>
                  <TableHead className="text-right">Amount Withheld</TableHead>
                  <TableHead>Exception</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => {
                  const isEx = entry.isException || entry.hasException || Number(entry.shortDeduction) > 0;
                  const vendorName = entry.vendorName ?? entry.payerName ?? "—";
                  const vendorNtn = entry.vendorNtn ?? entry.payerNtn ?? "—";
                  const section = entry.sectionCode ?? entry.section ?? "—";
                  const gross = Number(entry.grossAmount ?? 0);
                  const rate = Number(entry.actualRate ?? entry.whtRate ?? entry.expectedRate ?? 0);
                  const withheld = Number(entry.whtDeducted ?? entry.amountWithheld ?? 0);
                  return (
                    <TableRow key={entry.id} className={cn("hover:bg-muted/40", isEx && "bg-amber-50/50 dark:bg-amber-950/10")}>
                      <TableCell className="font-medium text-sm">{vendorName}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{vendorNtn}</TableCell>
                      <TableCell>
                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">
                          §{section}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(gross)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{rate.toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">{formatCurrency(withheld)}</TableCell>
                      <TableCell>
                        {isEx ? (
                          <span className="flex items-center gap-1 text-xs text-amber-700 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" /> {entry.shortDeduction > 0 ? `Short: Rs. ${Number(entry.shortDeduction).toLocaleString()}` : "Exception"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-700">
                            <CheckCircle className="w-3.5 h-3.5" /> OK
                          </span>
                        )}
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
};

const RiskRegisterTab = ({ engagementId }: { engagementId: string }) => {
  const { data, isLoading } = useListRisks(engagementId);
  const updateMutation = useUpdateRiskStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const risks = data?.risks ?? [];
  const openHigh = risks.filter(r => r.severity === "HIGH" && r.status === "open").length;

  const handleStatusChange = (id: string, status: string) => {
    updateMutation.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/risks/${engagementId}`] });
          toast({ title: "Risk status updated" });
        },
        onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message })
      }
    );
  };

  const SEVERITY_STYLE: Record<string, string> = {
    HIGH: "bg-red-100 text-red-800 border-red-200",
    MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
    LOW: "bg-green-100 text-green-800 border-green-200",
  };

  const STATUS_STYLE: Record<string, string> = {
    open: "bg-red-50 text-red-700",
    mitigated: "bg-blue-50 text-blue-700",
    accepted: "bg-slate-100 text-slate-700",
    closed: "bg-green-50 text-green-700",
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {openHigh > 0 && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-400">Computation Lock Blocked</p>
            <p className="text-xs text-red-700 dark:text-red-500">{openHigh} HIGH severity risk{openHigh > 1 ? "s" : ""} remain open. Resolve or accept them before locking.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Risks", value: risks.length },
          { label: "Open HIGH", value: risks.filter(r => r.severity === "HIGH" && r.status === "open").length, cls: "text-red-600" },
          { label: "Open MEDIUM", value: risks.filter(r => r.severity === "MEDIUM" && r.status === "open").length, cls: "text-amber-600" },
          { label: "Closed / Mitigated", value: risks.filter(r => r.status === "closed" || r.status === "mitigated").length, cls: "text-green-600" },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={cn("text-3xl font-bold mt-1", stat.cls ?? "text-foreground")}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Risk Items ({risks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center animate-pulse text-muted-foreground">Loading risks...</div>
          ) : risks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No risks detected. Run Tax Rules engine to auto-detect risks.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Source Rule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {risks.map(risk => (
                  <TableRow key={risk.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium text-sm">{risk.title}</div>
                      {risk.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{risk.description}</div>}
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded border", SEVERITY_STYLE[risk.severity ?? "MEDIUM"])}>
                        {risk.severity}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{risk.category?.replace(/_/g, " ") ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{risk.sourceRuleCode ?? "Manual"}</TableCell>
                    <TableCell>
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded capitalize", STATUS_STYLE[risk.status ?? "open"])}>
                        {risk.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {risk.status === "open" && (
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleStatusChange(risk.id, "mitigated")}
                            disabled={updateMutation.isPending}
                          >
                            Mitigate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => handleStatusChange(risk.id, "accepted")}
                            disabled={updateMutation.isPending}
                          >
                            Accept
                          </Button>
                        </div>
                      )}
                      {risk.status !== "open" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleStatusChange(risk.id, "open")}
                          disabled={updateMutation.isPending}
                        >
                          Reopen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const AiAssistantTab = ({ engagementId }: { engagementId: string }) => {
  const [promptKey, setPromptKey] = useState("TAX_MEMO_DRAFT");
  const [contextInput, setContextInput] = useState("");
  const { toast } = useToast();
  const generateMutation = useGenerateAiOutput();
  const promoteMutation = usePromoteAiOutput();
  const queryClient = useQueryClient();
  const [lastOutput, setLastOutput] = useState<any>(null);

  const handleGenerate = () => {
    generateMutation.mutate(
      { data: { engagementId, promptKey, context: { userContext: contextInput }, useVault: true } },
      { 
        onSuccess: (res) => {
          setLastOutput(res);
          toast({ title: "Draft Generated Successfully" });
        },
        onError: (err) => toast({ variant: "destructive", title: "Generation failed", description: err.message })
      }
    );
  };

  const handlePromote = () => {
    if (!lastOutput?.id) return;
    promoteMutation.mutate(
      { id: lastOutput.id },
      {
        onSuccess: () => {
          toast({ title: "Promoted to Review Notes" });
          queryClient.invalidateQueries({ queryKey: [`/api/reviews/${engagementId}/notes`] });
          setLastOutput(prev => ({...prev, isPromoted: true}));
        }
      }
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[700px]">
      <Card className="lg:col-span-4 flex flex-col shadow-sm">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="flex items-center text-lg"><Sparkles className="w-5 h-5 text-primary mr-2"/> Draft Assistant</CardTitle>
          <CardDescription>Generate advisory memos grounded in the Vault.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Prompt Template</Label>
            <Select value={promptKey} onValueChange={setPromptKey}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="TAX_MEMO_DRAFT">Advisory Tax Memo</SelectItem>
                <SelectItem value="RISK_EXPLANATION">Risk Plain-Language Explainer</SelectItem>
                <SelectItem value="PARTNER_REVIEW_SUMMARY">Partner Review Summary</SelectItem>
                <SelectItem value="NOTICE_REPLY_DRAFT">Tax Notice Reply</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex-1 flex flex-col">
            <Label>Additional Context</Label>
            <Textarea 
              placeholder="e.g., Focus on section 153 deductions for manufacturing companies..." 
              className="flex-1 resize-none bg-background"
              value={contextInput}
              onChange={e => setContextInput(e.target.value)}
            />
          </div>
          <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="w-full bg-primary hover:bg-primary/90 text-white shadow-md">
            {generateMutation.isPending ? "Drafting..." : "Generate Grounded Draft"}
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-8 flex flex-col shadow-sm relative overflow-hidden bg-background">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50"/>
        <CardHeader className="border-b bg-muted/5 flex flex-row items-center justify-between">
          <CardTitle>AI Staging Area</CardTitle>
          {lastOutput && !lastOutput.isPromoted && (
            <Button size="sm" onClick={handlePromote} disabled={promoteMutation.isPending} variant="outline" className="border-primary text-primary hover:bg-primary/10">
              Promote to Final Note
            </Button>
          )}
          {lastOutput?.isPromoted && <span className="text-xs font-semibold text-emerald-600 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1"/> Promoted</span>}
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-6">
          {generateMutation.isPending ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground animate-pulse">
              <Sparkles className="w-10 h-10 mb-4 text-primary/40 animate-bounce" />
              <p>Querying Super Admin Knowledge Vault...</p>
              <p className="text-xs mt-2 opacity-50">Synthesizing grounded response</p>
            </div>
          ) : lastOutput ? (
            <div className="space-y-6">
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground">
                <div dangerouslySetInnerHTML={{ __html: lastOutput.content.replace(/\n/g, '<br/>') }} />
              </div>
              
              {lastOutput.references?.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border/50">
                  <h4 className="text-sm font-semibold mb-3 flex items-center text-foreground"><Database className="w-4 h-4 mr-2 text-primary"/> Vault Citations</h4>
                  <div className="space-y-3">
                    {lastOutput.references.map((ref: any, idx: number) => (
                      <div key={idx} className="bg-muted/30 p-3 rounded-lg border border-border/50 text-sm">
                        <p className="font-medium text-primary mb-1">{ref.documentTitle}</p>
                        <p className="text-xs text-muted-foreground flex gap-3">
                          <span>Sec: {ref.lawSection}</span>
                          <span>Ref: {ref.pageReference || 'General'}</span>
                          <span>Relevance: {(ref.relevanceScore * 100).toFixed(0)}%</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-40">
              <MessageSquare className="w-12 h-12 mb-4" />
              <p>Generated outputs will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default function EngagementWorkspace() {
  const [, params] = useRoute("/engagements/:id");
  const id = params?.id || "";
  const [activeTab, setActiveTab] = useState("overview");
  const { user } = useAuth();
  const { data: eng, isLoading } = useGetEngagement(id);

  if (isLoading) return <div className="p-8 text-center animate-pulse">Loading workspace...</div>;
  if (!eng) return <div className="p-8 text-center text-destructive">Workspace not found.</div>;

  const isPartner = hasRequiredRole(user?.role, "PARTNER");

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between bg-card p-5 rounded-2xl border border-border/50 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">{eng.title}</h1>
            <div className="flex items-center gap-3 text-sm mt-1 text-muted-foreground">
              <span className="font-semibold text-foreground/80">{eng.clientName}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50"/>
              <span>Tax Year: {eng.taxYear}</span>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50"/>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase">{eng.status.replace(/_/g, ' ')}</span>
              {eng.isLocked && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase flex items-center"><Lock className="w-3 h-3 mr-1"/> Locked</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <div className="border-b border-border/50 overflow-x-auto shrink-0 scrollbar-hide px-2">
            <TabsList className="bg-transparent justify-start w-full h-14 p-0">
              {[
                { id: "overview", label: "Overview", icon: BarChart3 },
                { id: "uploads", label: "Upload Center", icon: UploadCloud },
                { id: "validation", label: "Validation", icon: FileCheck },
                { id: "mapping", label: "Mapping", icon: ArrowRightLeft },
                { id: "computation", label: "Computation", icon: Calculator },
                { id: "withholding", label: "WHT Review", icon: FileType },
                { id: "risks", label: "Risk Register", icon: Shield },
                { id: "reviews", label: "Review Notes", icon: ClipboardCheck },
                { id: "ai", label: "AI Assistant", icon: Sparkles },
              ].map(tab => (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <tab.icon className="w-4 h-4 mr-2" /> {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          
          <div className="flex-1 overflow-auto p-6 bg-muted/10">
            <TabsContent value="overview" className="m-0 h-full"><OverviewTab engagement={eng} /></TabsContent>
            <TabsContent value="uploads" className="m-0 h-full"><UploadCenter engagementId={eng.id} /></TabsContent>
            <TabsContent value="validation" className="m-0 h-full"><ValidationTab engagementId={eng.id} /></TabsContent>
            <TabsContent value="mapping" className="m-0 h-full"><MappingTab engagementId={eng.id} /></TabsContent>
            <TabsContent value="computation" className="m-0 h-full"><ComputationTab engagementId={eng.id} isPartner={isPartner} /></TabsContent>
            <TabsContent value="withholding" className="m-0 h-full"><WithholdingTab engagementId={eng.id} /></TabsContent>
            <TabsContent value="risks" className="m-0 h-full"><RiskRegisterTab engagementId={eng.id} /></TabsContent>
            <TabsContent value="reviews" className="m-0 h-full"><ReviewNotesTab engagementId={eng.id} isPartner={isPartner} /></TabsContent>
            <TabsContent value="ai" className="m-0 h-full"><AiAssistantTab engagementId={eng.id} /></TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
