import { useState } from "react";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Search, ChevronLeft, ChevronRight, RefreshCw, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "bg-green-100 text-green-800",
  LOGOUT: "bg-slate-100 text-slate-700",
  CREATE_CLIENT: "bg-blue-100 text-blue-800",
  UPDATE_CLIENT: "bg-indigo-100 text-indigo-800",
  DELETE_CLIENT: "bg-red-100 text-red-800",
  CREATE_ENGAGEMENT: "bg-blue-100 text-blue-800",
  STATUS_CHANGE: "bg-purple-100 text-purple-800",
  FILE_UPLOAD: "bg-cyan-100 text-cyan-800",
  LOCK_COMPUTATION: "bg-amber-100 text-amber-800",
  UNLOCK_COMPUTATION: "bg-orange-100 text-orange-800",
  APPROVE_ENGAGEMENT: "bg-green-100 text-green-800",
  AI_GENERATE: "bg-violet-100 text-violet-800",
  AI_OUTPUT_PROMOTED: "bg-violet-100 text-violet-800",
  VAULT_UPLOAD: "bg-teal-100 text-teal-800",
  VAULT_SEARCH: "bg-teal-100 text-teal-800",
  MFA_ENABLED: "bg-green-100 text-green-800",
};

const MODULES = ["auth", "clients", "engagements", "uploads", "computation", "risks", "reviews", "ai", "vault", "rules", "mapping", "validation"];

function formatTs(ts: string | null | undefined) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return ts;
  }
}

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const limit = 25;

  const { data, isLoading, refetch } = useListAuditLogs({
    page,
    limit,
    module: moduleFilter || undefined,
    action: actionFilter || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const exportCsv = () => {
    const headers = ["Timestamp", "User", "Action", "Module", "Resource Type", "Resource ID", "IP Address"];
    const rows = logs.map(l => [
      l.createdAt ?? "",
      l.userName ?? l.userId ?? "",
      l.action ?? "",
      l.module ?? "",
      l.resourceType ?? "",
      l.resourceId ?? "",
      l.ipAddress ?? "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">Immutable audit trail of all system actions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs mb-1">Module</Label>
              <Select value={moduleFilter || "all"} onValueChange={v => { setModuleFilter(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All Modules" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {MODULES.map(m => <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1">Action contains</Label>
              <Input className="h-8 text-sm" placeholder="e.g. LOGIN" value={actionFilter} onChange={e => { setActionFilter(e.target.value.toUpperCase()); setPage(1); }} />
            </div>
            <div>
              <Label className="text-xs mb-1">From Date</Label>
              <Input type="datetime-local" className="h-8 text-sm" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} />
            </div>
            <div>
              <Label className="text-xs mb-1">To Date</Label>
              <Input type="datetime-local" className="h-8 text-sm" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} />
            </div>
          </div>
          {(moduleFilter || actionFilter || fromDate || toDate) && (
            <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => { setModuleFilter(""); setActionFilter(""); setFromDate(""); setToDate(""); setPage(1); }}>
              Clear all filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            Audit Trail
            <Badge variant="secondary" className="ml-auto">{total.toLocaleString()} records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center animate-pulse text-muted-foreground">Loading audit logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No audit logs found for the selected filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id} className="hover:bg-muted/40 text-sm">
                      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatTs(log.createdAt as string | undefined)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{log.userName || "System"}</div>
                        {log.firmId && <div className="text-xs text-muted-foreground font-mono">{log.userId?.slice(0, 8)}...</div>}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", ACTION_COLORS[log.action ?? ""] ?? "bg-muted text-muted-foreground")}>
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize text-sm">{log.module}</TableCell>
                      <TableCell>
                        {log.resourceType && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">{log.resourceType}: </span>
                            <span className="font-mono">{log.resourceId?.slice(0, 12)}...</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{log.ipAddress ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total.toLocaleString()} total records)
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium px-2">{page}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
