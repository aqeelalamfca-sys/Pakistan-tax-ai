import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useListClients, useCreateClient } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Plus, Building2, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

const clientSchema = z.object({
  legalName: z.string().min(2, "Name is required"),
  ntn: z.string().optional(),
  cnic: z.string().optional(),
  businessType: z.string().min(2, "Business type required"),
  industry: z.string().min(2, "Industry required"),
});

export default function Clients() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListClients({ search });
  const createMutation = useCreateClient();

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: { legalName: "", ntn: "", cnic: "", businessType: "", industry: "" },
  });

  const onSubmit = (values: z.infer<typeof clientSchema>) => {
    createMutation.mutate(
      { data: { ...values, taxTypes: ["INCOME_TAX"] } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
          setIsDialogOpen(false);
          form.reset();
          toast({ title: "Client created successfully" });
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Failed to create", description: err.message }),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage firm clients and business entities.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" /> Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Client</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField control={form.control} name="legalName" render={({ field }) => (
                  <FormItem><FormLabel>Legal Name</FormLabel><FormControl><Input placeholder="Acme Corp Ltd." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="ntn" render={({ field }) => (
                    <FormItem><FormLabel>NTN</FormLabel><FormControl><Input placeholder="1234567-8" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="cnic" render={({ field }) => (
                    <FormItem><FormLabel>CNIC (If Individual)</FormLabel><FormControl><Input placeholder="00000-0000000-0" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="businessType" render={({ field }) => (
                    <FormItem><FormLabel>Business Type</FormLabel><FormControl><Input placeholder="Private Limited" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="industry" render={({ field }) => (
                    <FormItem><FormLabel>Industry</FormLabel><FormControl><Input placeholder="Manufacturing" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full mt-6" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Client"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center bg-muted/20">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search clients..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-background border-border/50"
            />
          </div>
        </div>
        
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>NTN / CNIC</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Onboarded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : data?.clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Building2 className="w-12 h-12 mb-3 opacity-20" />
                    <p>No clients found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data?.clients.map(client => (
                <TableRow key={client.id} className="hover:bg-muted/30 transition-colors group">
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mr-3 font-bold text-xs border border-primary/20">
                        {client.legalName.charAt(0)}
                      </div>
                      {client.legalName}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{client.ntn || client.cnic || 'N/A'}</TableCell>
                  <TableCell>{client.industry}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(client.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/clients/${client.id}`}>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        View Details <ChevronRight className="w-4 h-4 ml-1" />
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
