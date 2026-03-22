import { useRoute } from "wouter";
import { useGetClient, useListEngagements } from "@workspace/api-client-react";
import { Building2, MapPin, Hash, Briefcase, Plus, FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";
import { Link } from "wouter";

export default function ClientDetail() {
  const [, params] = useRoute("/clients/:id");
  const id = params?.id || "";
  
  const { data: client, isLoading: clientLoading } = useGetClient(id);
  const { data: engagementsData, isLoading: engLoading } = useListEngagements({ clientId: id });

  if (clientLoading) return <div className="p-8 text-center animate-pulse">Loading client profile...</div>;
  if (!client) return <div className="p-8 text-center text-destructive">Client not found.</div>;

  return (
    <div className="space-y-6">
      {/* Header Profile */}
      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center text-3xl font-display font-bold shadow-lg shadow-primary/30">
            {client.legalName.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">{client.legalName}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center"><Hash className="w-4 h-4 mr-1" /> NTN: {client.ntn || 'N/A'}</span>
              <span className="flex items-center"><Briefcase className="w-4 h-4 mr-1" /> {client.businessType}</span>
              <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> {client.address || 'No address'}</span>
            </div>
          </div>
        </div>
        <div className="relative z-10">
          <Link href={`/engagements?clientId=${client.id}&create=true`}>
            <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" /> New Engagement
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-card border border-border/50 p-1 w-full justify-start rounded-xl mb-6 h-auto">
          <TabsTrigger value="overview" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Overview</TabsTrigger>
          <TabsTrigger value="engagements" className="px-6 py-2.5 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Engagements ({engagementsData?.total || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-border/50 shadow-sm">
            <CardHeader><CardTitle>Entity Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                <div><p className="text-sm text-muted-foreground">Registration No.</p><p className="font-medium">{client.registrationNo || '-'}</p></div>
                <div><p className="text-sm text-muted-foreground">CNIC</p><p className="font-medium">{client.cnic || '-'}</p></div>
                <div><p className="text-sm text-muted-foreground">Industry</p><p className="font-medium">{client.industry}</p></div>
                <div><p className="text-sm text-muted-foreground">Applicable Taxes</p><p className="font-medium">{client.taxTypes?.join(', ') || '-'}</p></div>
                <div><p className="text-sm text-muted-foreground">Onboarded On</p><p className="font-medium">{formatDate(client.createdAt)}</p></div>
                <div><p className="text-sm text-muted-foreground">Status</p><span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">{client.status || 'Active'}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader><CardTitle>Key Contacts</CardTitle></CardHeader>
            <CardContent>
              {client.contactPersons && client.contactPersons.length > 0 ? (
                <div className="space-y-4">
                  {client.contactPersons.map((cp: any, i) => (
                    <div key={i} className="flex flex-col p-3 bg-muted/30 rounded-xl border border-border/50">
                      <p className="font-semibold text-sm">{cp.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{cp.role || 'Role unassigned'}</p>
                      <p className="text-xs mt-1 text-primary">{cp.email || ''}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No contacts added.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagements">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {engLoading ? (
              <p className="col-span-3 text-muted-foreground p-8 text-center">Loading engagements...</p>
            ) : engagementsData?.engagements.length === 0 ? (
              <div className="col-span-3 bg-card border border-dashed border-border p-12 text-center rounded-2xl">
                <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-foreground">No Engagements Yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">Start a tax computation engagement for this client.</p>
                <Link href={`/engagements?clientId=${client.id}&create=true`}>
                  <Button variant="outline">Create First Engagement</Button>
                </Link>
              </div>
            ) : (
              engagementsData?.engagements.map((eng) => (
                <Card key={eng.id} className="hover:shadow-md hover:border-primary/30 transition-all duration-300 group cursor-pointer border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">{eng.status}</span>
                      <span className="text-xs font-mono font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">TY {eng.taxYear}</span>
                    </div>
                    <CardTitle className="mt-3 text-lg leading-tight group-hover:text-primary transition-colors">{eng.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">Updated {formatDate(eng.updatedAt)}</span>
                      <Link href={`/engagements/${eng.id}`}>
                        <Button size="sm" variant="ghost" className="h-8">Open Workspace</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
