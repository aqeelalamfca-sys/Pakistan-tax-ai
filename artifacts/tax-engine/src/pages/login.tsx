import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useLogin, useVerifyMfa } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password is required"),
});

const mfaSchema = z.object({
  token: z.string().min(6, "Token must be 6 digits").max(6),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [requiresMfa, setRequiresMfa] = useState(false);
  
  const loginMutation = useLogin();
  const mfaMutation = useVerifyMfa();

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const mfaForm = useForm({
    resolver: zodResolver(mfaSchema),
    defaultValues: { token: "" },
  });

  const onLoginSubmit = (data: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          if (res.requiresMfa) {
            setRequiresMfa(true);
            // Temporarily store token to be validated with MFA
            localStorage.setItem("tax_engine_temp_token", res.token);
          } else {
            localStorage.setItem("tax_engine_token", res.token);
            setLocation("/");
          }
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Login failed",
            description: err?.message || "Invalid credentials",
          });
        },
      }
    );
  };

  const onMfaSubmit = (data: z.infer<typeof mfaSchema>) => {
    // Inject temp token just for this call via the global fetch interceptor by swapping it
    const tempToken = localStorage.getItem("tax_engine_temp_token");
    if (tempToken) {
      localStorage.setItem("tax_engine_token", tempToken);
    }

    mfaMutation.mutate(
      { data },
      {
        onSuccess: () => {
          localStorage.removeItem("tax_engine_temp_token");
          setLocation("/");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "MFA failed",
            description: err?.message || "Invalid token",
          });
          localStorage.removeItem("tax_engine_token");
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Abstract background" 
          className="w-full h-full object-cover opacity-60 dark:opacity-40"
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="z-10 w-full max-w-md p-4"
      >
        <div className="flex flex-col items-center mb-8">
          <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-16 h-16 mb-4 shadow-xl rounded-2xl" />
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">TaxEngine<span className="text-primary">.ai</span></h1>
          <p className="text-muted-foreground mt-2 text-center">Pakistan's Intelligent Tax Computation Platform</p>
        </div>

        <Card className="shadow-2xl border-border/50">
          <CardHeader>
            <CardTitle>{requiresMfa ? "Two-Factor Authentication" : "Sign In"}</CardTitle>
            <CardDescription>
              {requiresMfa ? "Enter the 6-digit code from your authenticator app." : "Enter your email and password to access your firm workspace."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!requiresMfa ? (
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input 
                    id="email" 
                    placeholder="partner@firm.com" 
                    {...loginForm.register("email")} 
                    className="bg-background"
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    {...loginForm.register("password")} 
                    className="bg-background"
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            ) : (
              <form onSubmit={mfaForm.handleSubmit(onMfaSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="token">Authentication Code</Label>
                  <Input 
                    id="token" 
                    placeholder="000000" 
                    {...mfaForm.register("token")} 
                    className="text-center tracking-[0.5em] text-lg font-mono"
                    maxLength={6}
                  />
                  {mfaForm.formState.errors.token && (
                    <p className="text-sm text-destructive">{mfaForm.formState.errors.token.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full mt-4 bg-primary" disabled={mfaMutation.isPending}>
                  {mfaMutation.isPending ? "Verifying..." : "Verify Code"}
                </Button>
                <Button variant="ghost" type="button" className="w-full" onClick={() => setRequiresMfa(false)}>
                  Back to login
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
