import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useListEngagements, useCreateEngagement, useListClients } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, FolderKanban, ArrowRight } from "lucide-react";
import { Link, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";

const engageSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  title: z.string().min(2, "Title is required"),
  taxYear: z.string().min(4, "Year required"),
  taxType: z.string().min(1, "Tax type required"),
});

export default function Engagements() {
  const searchStr = useSearch();
  const searchParams = new URLSearchParams(searchStr);
  const defaultClientId = searchParams.get("clientId") || "";
  const autoCreate = searchParams.get("create") === "true";

  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(autoCreate);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: engData, isLoading: engLoading } = useListEngagements({ status: search }); // Using status param as simple search proxy for now
  const { data: clientsData } = useListClients();
  const createMutation = useCreateEngagement();

  const form = useForm<z.infer<typeof engageSchema>>({
    resolver: zodResolver(engageSchema),
    defaultValues: { clientId: defaultClientId, title: "", taxYear: new Date().getFullYear().toString(), taxType: "CORPORATE_TAX" },
  });

  const onSubmit = (values: z.infer<typeof engageSchema>) => {
    createMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/engagements"] });
          setIsDialogOpen(false);
          form.reset();
          toast({ title: "Engagement created successfully" });
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Failed to create", description: err.message }),
      }
    );
  };

  const statusColors: Record<string, string> = {
    "DRAFT": "bg-gray-100 text-gray-800",
    "WAITING_FOR_DATA": "bg-amber-100 text-amber-800",
    "DATA_UPLOADED": "bg-blue-100 text-blue-800",
    "VALIDATED": "bg-indigo-100 text-indigo-800",
    "MAPPED": "bg-purple-100 text-purple-800",
    "DRAFT_COMPUTATION": "bg-pink-100 text-pink-800",
    "UNDER_REVIEW": "bg-orange-100 text-orange-800",
    "APPROVED": "bg-emerald-100 text-emerald-800",
    "FILED": "bg-teal-100 text-teal-800 border-teal-200",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Engagements</h1>
          <p className="text-muted-foreground mt-1">Manage tax computations and filing workflows.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" /> New Engagement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Tax Engagement</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField control={form.control} name="clientId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {clientsData?.clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.legalName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Engagement Title</FormLabel><FormControl><Input placeholder="TY 2024 Corporate Return" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="taxYear" render={({ field }) => (
                    <FormItem><FormLabel>Tax Year</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="taxType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="CORPORATE_TAX">Corporate Tax</SelectItem>
                          <SelectItem value="INDIVIDUAL_TAX">Individual Tax</SelectItem>
                          <SelectItem value="SALES_TAX">Sales Tax</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full mt-6" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Workspace"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Tax Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {engLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading workspaces...</TableCell></TableRow>
            ) : engData?.engagements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <FolderKanban className="w-12 h-12 mb-3 opacity-20" />
                    <p>No active engagements.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              engData?.engagements.map(eng => (
                <TableRow key={eng.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium text-foreground">{eng.title}</TableCell>
                  <TableCell>{eng.clientName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{eng.taxYear}</TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border border-transparent ${statusColors[eng.status] || "bg-gray-100 text-gray-800"}`}>
                      {eng.status.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/engagements/${eng.id}`}>
                      <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-white font-medium shadow-sm">
                        Workspace <ArrowRight className="w-4 h-4 ml-1.5" />
                      </Button>
                    </Link>
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
