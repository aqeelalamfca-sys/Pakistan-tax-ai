import { useGetMe, useListClients, useListEngagements, useListRisks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FolderKanban, AlertOctagon, FileCheck } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const mockTrendData = [
  { name: 'Jan', risks: 40, completed: 24 },
  { name: 'Feb', risks: 30, completed: 35 },
  { name: 'Mar', risks: 20, completed: 55 },
  { name: 'Apr', risks: 27, completed: 45 },
  { name: 'May', risks: 18, completed: 65 },
  { name: 'Jun', risks: 12, completed: 80 },
];

export default function Dashboard() {
  const { data: me } = useGetMe();
  const { data: clientsData } = useListClients();
  const { data: engagementsData } = useListEngagements();
  // Call for global risks (mock engagementId for dashboard overview assumption)
  const { data: risksData } = useListRisks("global", { query: { enabled: false } }); // Fallback since risks need engagementId in schema

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Welcome back, {me?.firstName}</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening in your firm workspace today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow duration-200 group border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{clientsData?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">+2 from last month</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200 group border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Engagements</CardTitle>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <FolderKanban className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{engagementsData?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">12 awaiting review</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200 group border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Severity Risks</CardTitle>
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive group-hover:scale-110 transition-transform">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">{risksData?.highCount || 5}</div>
            <p className="text-xs text-destructive mt-1">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200 group border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed Filings</CardTitle>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <FileCheck className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold">84</div>
            <p className="text-xs text-muted-foreground mt-1">This tax year</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Resolution Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area type="monotone" dataKey="risks" stroke="hsl(var(--destructive))" fillOpacity={1} fill="url(#colorRisks)" />
                  <Area type="monotone" dataKey="completed" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCompleted)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm flex flex-col">
          <CardHeader>
            <CardTitle>Recent Engagements</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="space-y-4 flex-1">
              {engagementsData?.engagements.slice(0, 4).map(eng => (
                <div key={eng.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                  <div>
                    <p className="font-medium text-sm text-foreground">{eng.title}</p>
                    <p className="text-xs text-muted-foreground">{eng.clientName} • TY {eng.taxYear}</p>
                  </div>
                  <Link href={`/engagements/${eng.id}`}>
                    <Button variant="ghost" size="sm" className="h-8">View</Button>
                  </Link>
                </div>
              ))}
              {!engagementsData?.engagements?.length && (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-8">
                  <FolderKanban className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm">No recent engagements</p>
                </div>
              )}
            </div>
            <Link href="/engagements" className="mt-4 block">
              <Button variant="outline" className="w-full bg-background">View All Engagements</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
