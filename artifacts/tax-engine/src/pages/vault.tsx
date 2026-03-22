import { useState } from "react";
import { useListVaultDocuments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Database, Search, UploadCloud, Tag, FileText, CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function getToken() { return localStorage.getItem("tax_engine_token"); }

function VaultUploadForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("law");
  const [taxType, setTaxType] = useState("income_tax");
  const [jurisdiction, setJurisdiction] = useState("federal");
  const [lawSection, setLawSection] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [priority, setPriority] = useState("5");
  const [tags, setTags] = useState("");
  const [summary, setSummary] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title) {
      toast({ variant: "destructive", title: "Title and file are required" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("docType", docType);
      formData.append("taxType", taxType);
      formData.append("jurisdiction", jurisdiction);
      if (lawSection) formData.append("lawSection", lawSection);
      if (effectiveDate) formData.append("effectiveDate", effectiveDate);
      if (issueDate) formData.append("issueDate", issueDate);
      formData.append("priority", priority);
      if (tags) formData.append("tags", tags);

      const res = await fetch(`${BASE}/api/vault/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      toast({ title: "Document uploaded to vault" });
      onSuccess();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Document Title *</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Income Tax Ordinance, 2001 - Section 153" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Document Type *</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="law">Law / Ordinance</SelectItem>
              <SelectItem value="sro">SRO (Statutory Order)</SelectItem>
              <SelectItem value="circular">FBR Circular</SelectItem>
              <SelectItem value="notification">Notification</SelectItem>
              <SelectItem value="ruling">Court Ruling</SelectItem>
              <SelectItem value="guide">Practice Guide</SelectItem>
              <SelectItem value="internal">Internal Policy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tax Type</Label>
          <Select value={taxType} onValueChange={setTaxType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income_tax">Income Tax</SelectItem>
              <SelectItem value="sales_tax">Sales Tax</SelectItem>
              <SelectItem value="federal_excise">Federal Excise</SelectItem>
              <SelectItem value="customs">Customs</SelectItem>
              <SelectItem value="withholding">Withholding Tax</SelectItem>
              <SelectItem value="general">General / Multi-Tax</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Jurisdiction</Label>
          <Select value={jurisdiction} onValueChange={setJurisdiction}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="federal">Federal</SelectItem>
              <SelectItem value="punjab">Punjab</SelectItem>
              <SelectItem value="sindh">Sindh</SelectItem>
              <SelectItem value="kpk">KPK</SelectItem>
              <SelectItem value="balochistan">Balochistan</SelectItem>
              <SelectItem value="ict">ICT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Law Section</Label>
          <Input value={lawSection} onChange={e => setLawSection(e.target.value)} placeholder="e.g., Section 153, Rule 44" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Effective Date</Label>
          <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Issue Date</Label>
          <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Priority (1-10)</Label>
          <Input type="number" min="1" max="10" value={priority} onChange={e => setPriority(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tags (comma-separated)</Label>
        <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g., WHT, manufacturing, section-153" />
      </div>

      <div className="space-y-2">
        <Label>Upload File *</Label>
        <div className="border-2 border-dashed border-border/60 rounded-xl p-4 text-center hover:border-primary/50 transition-colors">
          <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="w-full text-sm" />
          <p className="text-xs text-muted-foreground mt-2">Accepted: PDF, DOC, DOCX, XLS, XLSX, TXT, CSV (max 100MB)</p>
        </div>
      </div>

      <Button type="submit" disabled={uploading || !file || !title} className="w-full bg-primary hover:bg-primary/90 text-white">
        {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : <><UploadCloud className="w-4 h-4 mr-2" /> Upload to Knowledge Vault</>}
      </Button>
    </form>
  );
}

export default function KnowledgeVault() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = useListVaultDocuments({ search });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function handleUploadSuccess() {
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["/api/vault/documents"] });
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const action = currentStatus === "active" ? "deactivate" : "activate";
    try {
      const res = await fetch(`${BASE}/api/vault/documents/${id}/${action}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/vault/documents"] });
      toast({ title: `Document ${action}d` });
    } catch {
      toast({ variant: "destructive", title: `Failed to ${action} document` });
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm("Remove this document from the vault?")) return;
    try {
      const res = await fetch(`${BASE}/api/vault/documents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/vault/documents"] });
      toast({ title: "Document removed" });
    } catch {
      toast({ variant: "destructive", title: "Delete failed" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Database className="w-8 h-8 text-primary" /> Super Admin Vault
          </h1>
          <p className="text-muted-foreground mt-1">Central knowledge repository driving AI retrieval and citations.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
              <UploadCloud className="w-4 h-4 mr-2" /> Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Upload Knowledge Source</DialogTitle></DialogHeader>
            <VaultUploadForm onSuccess={handleUploadSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search tax laws, SROs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-background" />
          </div>
        </div>
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Document Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Jurisdiction</TableHead>
              <TableHead>Law Section</TableHead>
              <TableHead>Effective Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="w-5 h-5 mx-auto animate-spin text-primary" /></TableCell></TableRow>
            ) : data?.documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-muted-foreground">Vault is empty. Upload tax laws and SROs to power AI grounding.</p>
                </TableCell>
              </TableRow>
            ) : (
              data?.documents.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-medium">{doc.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-mono">{doc.docType}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{doc.jurisdiction}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{doc.lawSection || "-"}</TableCell>
                  <TableCell className="text-sm">{formatDate(doc.effectiveDate)}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleStatus(doc.id, doc.status)} className="cursor-pointer">
                      <Badge className={doc.status === "active" ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}>
                        {doc.status === "active" ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Active</> : <><XCircle className="w-3 h-3 mr-1" /> Inactive</>}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => deleteDoc(doc.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
