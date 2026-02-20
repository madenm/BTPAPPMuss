import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { PageWrapper } from "@/components/PageWrapper";
import { useAuth } from "@/context/AuthContext";
import { UserAccountButton } from "@/components/UserAccountButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiPostHeaders } from "@/lib/apiHeaders";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Loader2, Eye, EyeOff } from "lucide-react";

export default function CreateUserPage() {
  const { session, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [adminAllowed, setAdminAllowed] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || !session?.access_token) return;
    const controller = new AbortController();
    fetch("/api/admin/check", {
      method: "GET",
      headers: getApiPostHeaders(session.access_token),
      signal: controller.signal,
    })
      .then((r) => {
        if (r.status === 403 || r.status === 401) {
          setAdminAllowed(false);
          return;
        }
        if (r.ok) setAdminAllowed(true);
        else setAdminAllowed(false);
      })
      .catch(() => setAdminAllowed(false));
    return () => controller.abort();
  }, [authLoading, session?.access_token]);

  useEffect(() => {
    if (!authLoading && !session) {
      setLocation("/auth");
      return;
    }
    if (adminAllowed === false) {
      toast({ title: "Accès réservé à l'administrateur.", variant: "destructive" });
      setLocation("/dashboard");
    }
  }, [authLoading, session, adminAllowed, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !email.trim() || password.length < 6) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: getApiPostHeaders(session.access_token),
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim() || "",
          password: password.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: "Compte créé.", description: data.message });
        setEmail("");
        setFullName("");
        setPassword("");
      } else {
        toast({ title: data.message || "Erreur lors de l'envoi.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erreur réseau.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || adminAllowed === null || adminAllowed === false) {
    return (
      <PageWrapper
        title="Créer un compte"
        actions={<UserAccountButton />}
      >
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-white/60" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Créer un compte utilisateur"
      actions={<UserAccountButton />}
    >
      <div className="max-w-md">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <UserPlus className="h-5 w-5" />
              Inviter un utilisateur
            </CardTitle>
            <p className="text-sm text-white/70">
              Le mot de passe est requis pour créer le compte. Transmettez-le à l'utilisateur de manière sécurisée.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="admin-email" className="text-white/80">Email *</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="utilisateur@exemple.com"
                  required
                  className="mt-1 bg-white/5 border-white/20 text-white"
                />
              </div>
              <div>
                <Label htmlFor="admin-fullname" className="text-white/80">Nom complet</Label>
                <Input
                  id="admin-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="mt-1 bg-white/5 border-white/20 text-white"
                />
              </div>
              <div>
                <Label htmlFor="admin-password" className="text-white/80">Mot de passe *</Label>
                <div className="relative mt-1">
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    required
                    minLength={6}
                    className="pr-10 bg-white/5 border-white/20 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                    aria-label={showPassword ? "Masquer" : "Afficher"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {password.length > 0 && password.length < 6 && (
                  <p className="text-xs text-amber-400 mt-1">Minimum 6 caractères</p>
                )}
              </div>
              <Button
                type="submit"
                disabled={submitting || !email.trim() || password.length < 6}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Créer le compte"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
