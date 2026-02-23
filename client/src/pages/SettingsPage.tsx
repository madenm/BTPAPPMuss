import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useAuth } from "@/context/AuthContext";
import { useUserSettings } from "@/context/UserSettingsContext";
import { UserAccountButton } from "@/components/UserAccountButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadFile, removeFile, publicUrlToPath } from "@/lib/supabaseStorage";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import {
  ImagePlus,
  Trash2,
  Loader2,
  Building2,
  FileText,
  Palette,
  User,
  Shield,
  Award,
  Save,
  Check,
  AlertCircle,
  Eye,
  KeyRound,
  Mail,
} from "lucide-react";
import type { UserProfile } from "@/lib/supabaseUserProfile";

const THEME_COLORS = [
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Bleu", hex: "#3b82f6" },
  { name: "Émeraude", hex: "#10b981" },
  { name: "Orange", hex: "#f59e0b" },
  { name: "Rose", hex: "#ec4899" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Slate", hex: "#64748b" },
  { name: "Rouge", hex: "#ef4444" },
  { name: "Cyan", hex: "#06b6d4" },
];

type FormFields = {
  full_name: string;
  company_name: string;
  company_address: string;
  company_city_postal: string;
  company_phone: string;
  company_email: string;
  company_siret: string;
  company_tva_number: string;
  company_rcs: string;
  company_ape: string;
  company_capital: string;
  insurance_name: string;
  insurance_policy: string;
  qualifications: string;
  default_tva_rate: string;
  default_validity_days: string;
  default_conditions: string;
  invoice_mentions: string;
  quote_prefix: string;
  invoice_prefix: string;
};

function profileToForm(p: UserProfile | null): FormFields {
  return {
    full_name: p?.full_name ?? "",
    company_name: p?.company_name ?? "",
    company_address: p?.company_address ?? "",
    company_city_postal: p?.company_city_postal ?? "",
    company_phone: p?.company_phone ?? "",
    company_email: p?.company_email ?? "",
    company_siret: p?.company_siret ?? "",
    company_tva_number: p?.company_tva_number ?? "",
    company_rcs: p?.company_rcs ?? "",
    company_ape: p?.company_ape ?? "",
    company_capital: p?.company_capital ?? "",
    insurance_name: p?.insurance_name ?? "",
    insurance_policy: p?.insurance_policy ?? "",
    qualifications: p?.qualifications ?? "",
    default_tva_rate: p?.default_tva_rate ?? "20",
    default_validity_days: p?.default_validity_days ?? "30",
    default_conditions: p?.default_conditions ?? "",
    invoice_mentions: p?.invoice_mentions ?? "",
    quote_prefix: p?.quote_prefix ?? "",
    invoice_prefix: p?.invoice_prefix ?? "",
  };
}

const COMPLETENESS_FIELDS: { key: keyof FormFields; label: string; weight: number }[] = [
  { key: "full_name", label: "Nom complet", weight: 1 },
  { key: "company_name", label: "Raison sociale", weight: 2 },
  { key: "company_address", label: "Adresse", weight: 1 },
  { key: "company_city_postal", label: "Ville / CP", weight: 1 },
  { key: "company_phone", label: "Téléphone", weight: 1 },
  { key: "company_email", label: "Email entreprise", weight: 1 },
  { key: "company_siret", label: "SIRET", weight: 2 },
  { key: "company_tva_number", label: "N° TVA", weight: 1 },
  { key: "insurance_name", label: "Assurance décennale", weight: 2 },
  { key: "insurance_policy", label: "N° police assurance", weight: 1 },
];

function computeCompleteness(form: FormFields) {
  const totalWeight = COMPLETENESS_FIELDS.reduce((s, f) => s + f.weight, 0);
  let filled = 0;
  const missing: string[] = [];
  for (const f of COMPLETENESS_FIELDS) {
    if (form[f.key]?.trim()) filled += f.weight;
    else missing.push(f.label);
  }
  return { percent: Math.round((filled / totalWeight) * 100), missing };
}

function FieldInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-white/80 text-sm flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-white/50" />}
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white/10 text-white border-white/20 placeholder:text-white/40"
      />
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const {
    profile,
    logoUrl,
    themeColor,
    loading,
    setLogoUrl,
    setThemeColor,
    updateProfile,
    refetch,
  } = useUserSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormFields>(() => profileToForm(null));
  const [savedForm, setSavedForm] = useState<FormFields>(() => profileToForm(null));
  const [saving, setSaving] = useState(false);
  const [customColor, setCustomColor] = useState("");
  const [activeTab, setActiveTab] = useState("company");

  // Account management
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  useEffect(() => {
    const f = profileToForm(profile);
    setForm(f);
    setSavedForm(f);
  }, [profile]);

  const setField = useCallback((key: keyof FormFields, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  );

  const { percent: completeness, missing: missingFields } = useMemo(
    () => computeCompleteness(form),
    [form]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(form)) {
        payload[k] = (v as string).trim() || null;
      }
      await updateProfile(payload);
      toast({ title: "Paramètres enregistrés" });
      setSavedForm(form);
    } catch {
      toast({ title: "Erreur lors de l'enregistrement", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Veuillez choisir une image", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop() || "png";
    try {
      const url = await uploadFile(`${user.id}/settings/logo.${ext}`, file, { upsert: true });
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
    } catch {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
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

  const handleCustomColor = async () => {
    const hex = customColor.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      toast({ title: "Format invalide (ex: #ff6600)", variant: "destructive" });
      return;
    }
    await handleColorSelect(hex);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Le mot de passe doit contenir au moins 6 caractères", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Mot de passe modifié avec succès" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de changer le mot de passe",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast({ title: "Veuillez entrer un email valide", variant: "destructive" });
      return;
    }
    setChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      toast({ title: "Un email de confirmation a été envoyé à la nouvelle adresse" });
      setNewEmail("");
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de changer l'email",
        variant: "destructive",
      });
    } finally {
      setChangingEmail(false);
    }
  };

  const pdfPreviewLines = useMemo(() => {
    const lines: string[] = [];
    if (form.company_name) lines.push(form.company_name);
    if (form.full_name && form.full_name !== form.company_name) lines.push(form.full_name);
    if (form.company_address) lines.push(form.company_address);
    if (form.company_city_postal) lines.push(form.company_city_postal);
    if (form.company_phone) lines.push(`Tél: ${form.company_phone}`);
    if (form.company_email) lines.push(form.company_email);
    const legal: string[] = [];
    if (form.company_siret) legal.push(`SIRET ${form.company_siret}`);
    if (form.company_tva_number) legal.push(`TVA ${form.company_tva_number}`);
    if (form.company_rcs) legal.push(`RCS ${form.company_rcs}`);
    if (form.company_capital) legal.push(`Capital ${form.company_capital} €`);
    if (legal.length) lines.push(legal.join(" — "));
    if (form.insurance_name) {
      let ins = `Assurance décennale: ${form.insurance_name}`;
      if (form.insurance_policy) ins += ` (n°${form.insurance_policy})`;
      lines.push(ins);
    }
    if (form.qualifications) lines.push(form.qualifications);
    return lines;
  }, [form]);

  const cardClass = "bg-white/10 dark:bg-gray-800/50 border-white/10 backdrop-blur-xl";

  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 pl-20">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">Paramètres</h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">
              Configurez votre entreprise, vos documents et votre compte
            </p>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto flex items-center gap-3">
            {isDirty && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Modifications non sauvegardées
              </span>
            )}
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-white/70" />
          </div>
        ) : (
          <>
            {/* Completeness bar */}
            <Card className={cardClass}>
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/80 font-medium">
                    Profil complété à {completeness}%
                  </span>
                  {completeness < 100 && (
                    <span className="text-xs text-white/50">
                      Manque: {missingFields.slice(0, 3).join(", ")}
                      {missingFields.length > 3 && ` +${missingFields.length - 3}`}
                    </span>
                  )}
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${completeness}%`,
                      backgroundColor:
                        completeness === 100 ? "#10b981" : completeness >= 60 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-white/10 border border-white/10 w-full flex flex-wrap h-auto gap-1 p-1">
                <TabsTrigger
                  value="company"
                  className="flex-1 min-w-[120px] data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70 gap-1.5"
                >
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Entreprise</span>
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="flex-1 min-w-[120px] data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70 gap-1.5"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Documents</span>
                </TabsTrigger>
                <TabsTrigger
                  value="account"
                  className="flex-1 min-w-[120px] data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70 gap-1.5"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Compte</span>
                </TabsTrigger>
                <TabsTrigger
                  value="appearance"
                  className="flex-1 min-w-[120px] data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70 gap-1.5"
                >
                  <Palette className="h-4 w-4" />
                  <span className="hidden sm:inline">Apparence</span>
                </TabsTrigger>
              </TabsList>

              {/* ==================== ENTREPRISE ==================== */}
              <TabsContent value="company" className="space-y-4 mt-4">
                {/* Identité */}
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white font-medium flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-white/60" />
                      Identité de l&apos;entreprise
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldInput
                      id="company-name"
                      label="Raison sociale"
                      value={form.company_name}
                      onChange={(v) => setField("company_name", v)}
                      placeholder="Ex: Dupont BTP SARL"
                      icon={Building2}
                    />
                    <FieldInput
                      id="full-name"
                      label="Nom du dirigeant"
                      value={form.full_name}
                      onChange={(v) => setField("full_name", v)}
                      placeholder="Prénom Nom"
                      icon={User}
                    />
                    <FieldInput
                      id="company-address"
                      label="Adresse"
                      value={form.company_address}
                      onChange={(v) => setField("company_address", v)}
                      placeholder="12 rue de la Paix"
                    />
                    <FieldInput
                      id="company-city-postal"
                      label="Ville et code postal"
                      value={form.company_city_postal}
                      onChange={(v) => setField("company_city_postal", v)}
                      placeholder="75001 Paris"
                    />
                    <FieldInput
                      id="company-phone"
                      label="Téléphone"
                      value={form.company_phone}
                      onChange={(v) => setField("company_phone", v)}
                      placeholder="06 12 34 56 78"
                      type="tel"
                    />
                    <FieldInput
                      id="company-email"
                      label="Email professionnel"
                      value={form.company_email}
                      onChange={(v) => setField("company_email", v)}
                      placeholder="contact@entreprise.fr"
                      type="email"
                      icon={Mail}
                    />
                  </CardContent>
                </Card>

                {/* Infos légales */}
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white font-medium flex items-center gap-2">
                      <Shield className="h-5 w-5 text-white/60" />
                      Informations légales
                    </CardTitle>
                    <p className="text-xs text-white/50">Obligatoires sur devis et factures</p>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldInput
                      id="company-siret"
                      label="N° SIRET"
                      value={form.company_siret}
                      onChange={(v) => setField("company_siret", v)}
                      placeholder="123 456 789 00012"
                    />
                    <FieldInput
                      id="company-tva"
                      label="N° TVA intracommunautaire"
                      value={form.company_tva_number}
                      onChange={(v) => setField("company_tva_number", v)}
                      placeholder="FR 12 345678901"
                    />
                    <FieldInput
                      id="company-rcs"
                      label="N° RCS"
                      value={form.company_rcs}
                      onChange={(v) => setField("company_rcs", v)}
                      placeholder="RCS Paris B 123 456 789"
                    />
                    <FieldInput
                      id="company-ape"
                      label="Code APE / NAF"
                      value={form.company_ape}
                      onChange={(v) => setField("company_ape", v)}
                      placeholder="4120A"
                    />
                    <FieldInput
                      id="company-capital"
                      label="Capital social (€)"
                      value={form.company_capital}
                      onChange={(v) => setField("company_capital", v)}
                      placeholder="10 000"
                    />
                  </CardContent>
                </Card>

                {/* Assurance & qualifications */}
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white font-medium flex items-center gap-2">
                      <Award className="h-5 w-5 text-white/60" />
                      Assurance &amp; Qualifications
                    </CardTitle>
                    <p className="text-xs text-white/50">
                      L&apos;assurance décennale est obligatoire pour les artisans du BTP
                    </p>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldInput
                      id="insurance-name"
                      label="Assureur (décennale)"
                      value={form.insurance_name}
                      onChange={(v) => setField("insurance_name", v)}
                      placeholder="Ex: AXA, SMABTP, MAF..."
                    />
                    <FieldInput
                      id="insurance-policy"
                      label="N° de police"
                      value={form.insurance_policy}
                      onChange={(v) => setField("insurance_policy", v)}
                      placeholder="N° contrat"
                    />
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="qualifications" className="text-white/80 text-sm flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-white/50" />
                        Qualifications / Labels
                      </Label>
                      <Input
                        id="qualifications"
                        value={form.qualifications}
                        onChange={(e) => setField("qualifications", e.target.value)}
                        placeholder="Ex: RGE QualiPAC, Qualibat 1312, Artisan d'art..."
                        className="bg-white/10 text-white border-white/20 placeholder:text-white/40"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ==================== DOCUMENTS ==================== */}
              <TabsContent value="documents" className="space-y-4 mt-4">
                {/* Valeurs par défaut devis */}
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white font-medium flex items-center gap-2">
                      <FileText className="h-5 w-5 text-white/60" />
                      Valeurs par défaut — Devis
                    </CardTitle>
                    <p className="text-xs text-white/50">
                      Pré-remplies automatiquement dans chaque nouveau devis
                    </p>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-white/80 text-sm">Taux de TVA par défaut</Label>
                      <Select
                        value={form.default_tva_rate}
                        onValueChange={(v) => setField("default_tva_rate", v)}
                      >
                        <SelectTrigger className="bg-white/10 text-white border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">20% (taux normal)</SelectItem>
                          <SelectItem value="10">10% (travaux rénovation)</SelectItem>
                          <SelectItem value="5.5">5,5% (rénovation énergétique)</SelectItem>
                          <SelectItem value="0">0% (autoliquidation)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/80 text-sm">Durée de validité par défaut</Label>
                      <Select
                        value={form.default_validity_days}
                        onValueChange={(v) => setField("default_validity_days", v)}
                      >
                        <SelectTrigger className="bg-white/10 text-white border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 jours</SelectItem>
                          <SelectItem value="30">30 jours</SelectItem>
                          <SelectItem value="60">60 jours</SelectItem>
                          <SelectItem value="90">90 jours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/80 text-sm">Préfixe devis</Label>
                      <Input
                        value={form.quote_prefix}
                        onChange={(e) => setField("quote_prefix", e.target.value)}
                        placeholder="Ex: DEV-2026-"
                        className="bg-white/10 text-white border-white/20 placeholder:text-white/40"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/80 text-sm">Préfixe factures</Label>
                      <Input
                        value={form.invoice_prefix}
                        onChange={(e) => setField("invoice_prefix", e.target.value)}
                        placeholder="Ex: FAC-2026-"
                        className="bg-white/10 text-white border-white/20 placeholder:text-white/40"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-white/80 text-sm">Conditions générales par défaut</Label>
                      <Textarea
                        value={form.default_conditions}
                        onChange={(e) => setField("default_conditions", e.target.value)}
                        placeholder="Ex: Acompte de 30% à la commande. Solde à réception des travaux. Garantie décennale incluse."
                        rows={3}
                        className="bg-white/10 text-white border-white/20 placeholder:text-white/40 resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Mentions factures */}
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white font-medium flex items-center gap-2">
                      <Shield className="h-5 w-5 text-white/60" />
                      Mentions légales — Factures
                    </CardTitle>
                    <p className="text-xs text-white/50">
                      Pénalités de retard, escompte, conditions de paiement (obligatoires)
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={form.invoice_mentions}
                      onChange={(e) => setField("invoice_mentions", e.target.value)}
                      placeholder={`Ex:\nEn cas de retard de paiement, une pénalité de 3 fois le taux d'intérêt légal sera appliquée.\nPas d'escompte pour paiement anticipé.\nIndemnité forfaitaire de recouvrement: 40€.`}
                      rows={4}
                      className="bg-white/10 text-white border-white/20 placeholder:text-white/40 resize-none"
                    />
                  </CardContent>
                </Card>

                {/* Aperçu PDF */}
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white font-medium flex items-center gap-2">
                      <Eye className="h-5 w-5 text-white/60" />
                      Aperçu — En-tête document
                    </CardTitle>
                    <p className="text-xs text-white/50">
                      Voici comment vos informations apparaîtront sur vos devis et factures
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-white rounded-xl p-5 space-y-1 min-h-[120px]">
                      {logoUrl && (
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="h-10 w-auto max-w-[140px] object-contain mb-2"
                        />
                      )}
                      {pdfPreviewLines.length === 0 ? (
                        <p className="text-gray-400 text-sm italic">
                          Remplissez vos informations dans l&apos;onglet Entreprise pour voir l&apos;aperçu
                        </p>
                      ) : (
                        pdfPreviewLines.map((line, i) => (
                          <p
                            key={i}
                            className={
                              i === 0
                                ? "text-gray-900 font-bold text-sm"
                                : "text-gray-600 text-xs"
                            }
                          >
                            {line}
                          </p>
                        ))
                      )}
                      {/* Simulated footer */}
                      {(form.company_siret || form.company_tva_number) && (
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <p className="text-gray-400 text-[10px] text-center">
                            {[
                              form.company_name,
                              form.company_siret && `SIRET ${form.company_siret}`,
                              form.company_tva_number && `TVA ${form.company_tva_number}`,
                              form.company_rcs && `RCS ${form.company_rcs}`,
                              form.company_capital && `Capital ${form.company_capital} €`,
                            ]
                              .filter(Boolean)
                              .join(" — ")}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ==================== COMPTE ==================== */}
              <TabsContent value="account" className="space-y-4 mt-4">
                {/* Info compte */}
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white font-medium flex items-center gap-2">
                      <User className="h-5 w-5 text-white/60" />
                      Informations du compte
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="w-10 h-10 rounded-full bg-violet-500/30 flex items-center justify-center">
                        <User className="h-5 w-5 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">
                          {profile?.full_name || user?.user_metadata?.full_name || "—"}
                        </p>
                        <p className="text-white/60 text-xs">{user?.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <FieldInput
                        id="account-name"
                        label="Nom complet"
                        value={form.full_name}
                        onChange={(v) => setField("full_name", v)}
                        placeholder="Prénom Nom"
                        icon={User}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Changer email */}
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white font-medium flex items-center gap-2">
                      <Mail className="h-5 w-5 text-white/60" />
                      Changer l&apos;adresse email
                    </CardTitle>
                    <p className="text-xs text-white/50">
                      Un email de confirmation sera envoyé à la nouvelle adresse
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <FieldInput
                      id="new-email"
                      label="Nouvel email"
                      value={newEmail}
                      onChange={setNewEmail}
                      placeholder="nouveau@email.fr"
                      type="email"
                      icon={Mail}
                    />
                    <Button
                      onClick={handleChangeEmail}
                      disabled={changingEmail || !newEmail.trim()}
                      className="bg-white/10 text-white border border-white/20 hover:bg-white/20"
                    >
                      {changingEmail ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Changer l&apos;email
                    </Button>
                  </CardContent>
                </Card>

                {/* Changer mot de passe */}
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white font-medium flex items-center gap-2">
                      <KeyRound className="h-5 w-5 text-white/60" />
                      Changer le mot de passe
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FieldInput
                        id="new-password"
                        label="Nouveau mot de passe"
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="••••••••"
                        type="password"
                        icon={KeyRound}
                      />
                      <FieldInput
                        id="confirm-password"
                        label="Confirmer le mot de passe"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        placeholder="••••••••"
                        type="password"
                        icon={KeyRound}
                      />
                    </div>
                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-red-400 text-xs flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Les mots de passe ne correspondent pas
                      </p>
                    )}
                    <Button
                      onClick={handleChangePassword}
                      disabled={changingPassword || !newPassword || !confirmPassword}
                      className="bg-white/10 text-white border border-white/20 hover:bg-white/20"
                    >
                      {changingPassword ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4 mr-2" />
                      )}
                      Changer le mot de passe
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ==================== APPARENCE ==================== */}
              <TabsContent value="appearance" className="space-y-4 mt-4">
                {/* Logo */}
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white font-medium flex items-center gap-2">
                      <ImagePlus className="h-5 w-5 text-white/60" />
                      Logo
                    </CardTitle>
                    <p className="text-xs text-white/50">
                      Utilisé dans les devis, factures et l&apos;interface
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
                          Supprimer
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

                {/* Couleur d'accent */}
                <Card className={cardClass}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white font-medium flex items-center gap-2">
                      <Palette className="h-5 w-5 text-white/60" />
                      Couleur d&apos;accent
                    </CardTitle>
                    <p className="text-xs text-white/50">
                      Appliquée à l&apos;interface et aux en-têtes de documents
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-white/80 text-sm mb-3 block">Couleurs prédéfinies</Label>
                      <div className="flex flex-wrap gap-3">
                        {THEME_COLORS.map(({ name, hex }) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => handleColorSelect(hex)}
                            className="w-10 h-10 rounded-xl border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50 relative"
                            style={{
                              backgroundColor: hex,
                              borderColor: themeColor === hex ? "white" : "rgba(255,255,255,0.2)",
                              boxShadow: themeColor === hex ? `0 0 0 2px ${hex}` : undefined,
                            }}
                            title={name}
                          >
                            {themeColor === hex && (
                              <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-white/80 text-sm mb-2 block">Couleur personnalisée</Label>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-10 h-10 rounded-xl border-2 border-white/20 flex-shrink-0"
                          style={{
                            backgroundColor:
                              /^#[0-9a-fA-F]{6}$/.test(customColor) ? customColor : themeColor,
                          }}
                        />
                        <Input
                          value={customColor}
                          onChange={(e) => setCustomColor(e.target.value)}
                          placeholder="#ff6600"
                          maxLength={7}
                          className="bg-white/10 text-white border-white/20 placeholder:text-white/40 w-32"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCustomColor}
                          disabled={!/^#[0-9a-fA-F]{6}$/.test(customColor)}
                          className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                        >
                          Appliquer
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Sticky save bar */}
            {isDirty && (
              <div className="sticky bottom-4 z-30">
                <div className="bg-black/60 backdrop-blur-xl border border-white/15 rounded-2xl px-5 py-3 flex items-center justify-between shadow-2xl">
                  <span className="text-white/80 text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    Vous avez des modifications non sauvegardées
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setForm(savedForm);
                      }}
                      className="text-white/70 border-white/20 hover:bg-white/10"
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Enregistrer
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </PageWrapper>
  );
}
