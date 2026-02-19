import { useRef, useState, useEffect } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useAuth } from "@/context/AuthContext";
import { useUserSettings } from "@/context/UserSettingsContext";
import { UserAccountButton } from "@/components/UserAccountButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadFile, removeFile, publicUrlToPath } from "@/lib/supabaseStorage";
import { toast } from "@/hooks/use-toast";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";

const THEME_COLORS = [
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Bleu", hex: "#3b82f6" },
  { name: "Émeraude", hex: "#10b981" },
  { name: "Orange", hex: "#f59e0b" },
  { name: "Rose", hex: "#ec4899" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Slate", hex: "#64748b" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const {
    profile,
    logoUrl,
    themeColor,
    loading,
    setLogoUrl,
    setThemeColor,
    setCompanyInfo,
    refetch,
  } = useUserSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyAddress, setCompanyAddress] = useState("");
  const [companyCityPostal, setCompanyCityPostal] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companySiret, setCompanySiret] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  useEffect(() => {
    setCompanyAddress(profile?.company_address ?? "");
    setCompanyCityPostal(profile?.company_city_postal ?? "");
    setCompanyPhone(profile?.company_phone ?? "");
    setCompanyEmail(profile?.company_email ?? "");
    setCompanySiret(profile?.company_siret ?? "");
  }, [profile?.company_address, profile?.company_city_postal, profile?.company_phone, profile?.company_email, profile?.company_siret]);

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Veuillez choisir une image", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop() || "png";
    try {
      const url = await uploadFile(
        `${user.id}/settings/logo.${ext}`,
        file,
        { upsert: true }
      );
      await setLogoUrl(url);
      toast({ title: "Logo enregistré" });
      refetch();
    } catch (err) {
      toast({
        title: "Erreur lors de l'upload",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
    e.target.value = "";
  };

  const handleRemoveLogo = async () => {
    if (!logoUrl) return;
    try {
      const path = publicUrlToPath(logoUrl);
      await removeFile(path);
      await setLogoUrl(null);
      toast({ title: "Logo supprimé" });
      refetch();
    } catch (err) {
      toast({
        title: "Erreur lors de la suppression",
        variant: "destructive",
      });
    }
  };

  const handleColorSelect = async (hex: string) => {
    try {
      await setThemeColor(hex);
      toast({ title: "Couleur enregistrée" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleSaveCompanyInfo = async () => {
    setSavingCompany(true);
    try {
      await setCompanyInfo({
        company_address: companyAddress.trim() || null,
        company_city_postal: companyCityPostal.trim() || null,
        company_phone: companyPhone.trim() || null,
        company_email: companyEmail.trim() || null,
        company_siret: companySiret.trim() || null,
      });
      toast({ title: "Coordonnées enregistrées" });
    } catch {
      toast({ title: "Erreur lors de l'enregistrement", variant: "destructive" });
    } finally {
      setSavingCompany(false);
    }
  };

  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 max-md:pl-16">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">Paramètres</h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">
              Logo et couleur d&apos;accent de votre espace
            </p>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-white/70" />
          </div>
        ) : (
          <>
            <Card className="bg-white/10 dark:bg-gray-800/50 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white font-medium">
                  Logo
                </CardTitle>
                <p className="text-sm text-white/70">
                  Importez un logo qui sera sauvegardé et pourra être utilisé dans l&apos;application.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {logoUrl && (
                  <div className="flex items-center gap-4">
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-20 w-auto max-w-[200px] object-contain rounded-lg border border-white/20 bg-white/5"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="text-red-400 border-red-500/30 hover:bg-red-500/20"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer le logo
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                  >
                    <ImagePlus className="h-4 w-4 mr-2" />
                    {logoUrl ? "Changer le logo" : "Importer un logo"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 dark:bg-gray-800/50 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white font-medium">
                  Couleur d&apos;accent
                </CardTitle>
                <p className="text-sm text-white/70">
                  Choisissez une couleur parmi les propositions. Elle sera appliquée à l&apos;interface.
                </p>
              </CardHeader>
              <CardContent>
                <Label className="text-white/80 text-sm mb-3 block">
                  Couleurs disponibles
                </Label>
                <div className="flex flex-wrap gap-3">
                  {THEME_COLORS.map(({ name, hex }) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => handleColorSelect(hex)}
                      className="w-12 h-12 rounded-xl border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50"
                      style={{
                        backgroundColor: hex,
                        borderColor:
                          themeColor === hex ? "white" : "rgba(255,255,255,0.2)",
                        boxShadow:
                          themeColor === hex
                            ? `0 0 0 2px ${hex}`
                            : undefined,
                      }}
                      title={name}
                    />
                  ))}
                </div>
                <p className="text-xs text-white/60 mt-2">
                  Couleur actuelle appliquée à l&apos;application.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/10 dark:bg-gray-800/50 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white font-medium">
                  Coordonnées pour le devis
                </CardTitle>
                <p className="text-sm text-white/70">
                  Ces informations seront affichées dans l&apos;en-tête du devis PDF (colonne gauche).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-address" className="text-white/80">
                    Adresse
                  </Label>
                  <Input
                    id="company-address"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="Adresse de l'entreprise"
                    className="bg-white/10 text-white border-white/20 placeholder:text-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-city-postal" className="text-white/80">
                    Ville et Code Postal
                  </Label>
                  <Input
                    id="company-city-postal"
                    value={companyCityPostal}
                    onChange={(e) => setCompanyCityPostal(e.target.value)}
                    placeholder="Ville et code postal"
                    className="bg-white/10 text-white border-white/20 placeholder:text-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone" className="text-white/80">
                    Numéro de téléphone
                  </Label>
                  <Input
                    id="company-phone"
                    type="tel"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="Téléphone"
                    className="bg-white/10 text-white border-white/20 placeholder:text-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email" className="text-white/80">
                    Email
                  </Label>
                  <Input
                    id="company-email"
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="Email de l'entreprise"
                    className="bg-white/10 text-white border-white/20 placeholder:text-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-siret" className="text-white/80">
                    Numéro SIRET
                  </Label>
                  <Input
                    id="company-siret"
                    value={companySiret}
                    onChange={(e) => setCompanySiret(e.target.value)}
                    placeholder="Ex. 123 456 789 00012"
                    className="bg-white/10 text-white border-white/20 placeholder:text-white/50"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleSaveCompanyInfo}
                  disabled={savingCompany}
                  className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                >
                  {savingCompany ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    "Enregistrer"
                  )}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </PageWrapper>
  );
}
