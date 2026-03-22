import { useState } from "react";
import { useListVaultDocuments, useUploadVaultDocument } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Database, Search, UploadCloud, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function KnowledgeVault() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListVaultDocuments({ search });
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Database className="w-8 h-8 text-primary" /> Super Admin Vault
          </h1>
          <p className="text-muted-foreground mt-1">Central knowledge repository driving AI retrieval and citations.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
              <UploadCloud className="w-4 h-4 mr-2" /> Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Upload Knowledge Source</DialogTitle></DialogHeader>
            <div className="py-8 text-center text-muted-foreground">Upload form component here...</div>
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
              <TableHead>Effective Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading vault...</TableCell></TableRow>
            ) : data?.documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-muted-foreground">Vault is empty.</p>
                </TableCell>
              </TableRow>
            ) : (
              data?.documents.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium text-primary hover:underline cursor-pointer">{doc.title}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{doc.docType}</TableCell>
                  <TableCell>{doc.jurisdiction}</TableCell>
                  <TableCell>{formatDate(doc.effectiveDate)}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">{doc.status}</span>
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
