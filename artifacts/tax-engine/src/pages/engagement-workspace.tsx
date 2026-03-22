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
  UploadCloud, FileCheck, Map, Calculator, Shield, 
  AlertTriangle, MessageSquare, Sparkles, CheckCircle2, XCircle, FileType, CheckCircle, Lock, Unlock, Play
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

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
                { id: "overview", label: "Overview", icon: Map },
                { id: "uploads", label: "Upload Center", icon: UploadCloud },
                { id: "validation", label: "Validation", icon: FileCheck },
                { id: "computation", label: "Computation", icon: Calculator },
                { id: "withholding", label: "Withholding (WHT)", icon: FileType },
                { id: "risks", label: "Risk Register", icon: Shield },
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
            <TabsContent value="overview" className="m-0 h-full"><p className="text-muted-foreground">Workspace Overview for {eng.title}. Use the tabs above to navigate the workflow.</p></TabsContent>
            <TabsContent value="uploads" className="m-0 h-full"><UploadCenter engagementId={eng.id} /></TabsContent>
            <TabsContent value="validation" className="m-0 h-full"><ValidationTab engagementId={eng.id} /></TabsContent>
            <TabsContent value="computation" className="m-0 h-full"><ComputationTab engagementId={eng.id} isPartner={isPartner} /></TabsContent>
            <TabsContent value="withholding" className="m-0 h-full"><div className="text-center p-8">Withholding Review component loaded...</div></TabsContent>
            <TabsContent value="risks" className="m-0 h-full"><div className="text-center p-8">Risk Register loaded...</div></TabsContent>
            <TabsContent value="ai" className="m-0 h-full"><AiAssistantTab engagementId={eng.id} /></TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
