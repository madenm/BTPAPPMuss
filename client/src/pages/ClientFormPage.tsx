import { MeshGradient } from "@paper-design/shaders-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { getApiPostHeaders } from "@/lib/apiHeaders";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, User } from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0[67]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/;

function normalizePhone(s: string): string {
  return s.replace(/\s/g, "");
}

export default function ClientFormPage() {
  const [location] = useLocation();
  const token = location.startsWith("/client-form/") ? location.replace("/client-form/", "").split("?")[0] : "";

  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const colors = ["hsl(216, 90%, 27%)", "hsl(243, 68%, 36%)", "hsl(205, 91%, 36%)", "hsl(211, 61%, 42%)"];

  useEffect(() => {
    setMounted(true);
    const update = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const validate = (): boolean => {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = "Nom requis";
    if (!email.trim()) err.email = "Email requis";
    else if (!EMAIL_REGEX.test(email)) err.email = "Format email invalide";
    if (!phone.trim()) err.phone = "Téléphone requis";
    else if (!PHONE_REGEX.test(normalizePhone(phone))) err.phone = "Format 06/07 XX XX XX XX";
    if (postalCode.trim() && !/^\d{5}$/.test(postalCode)) err.postalCode = "Code postal : 5 chiffres";
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!validate() || !token) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/public-client-form", {
        method: "POST",
        headers: getApiPostHeaders(),
        body: JSON.stringify({
          token,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          street_address: streetAddress.trim() || undefined,
          postal_code: postalCode.trim() || undefined,
          city: city.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setSuccess(true);
      } else {
        setErrorMessage((data.message as string) || "Une erreur est survenue.");
      }
    } catch {
      setErrorMessage("Impossible d’envoyer le formulaire. Réessayez plus tard.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  if (!token) {
    return (
      <section className="relative w-full min-h-screen overflow-hidden bg-background flex items-center justify-center">
        <div className="fixed inset-0 w-screen h-screen">
          <MeshGradient
            width={dimensions.width}
            height={dimensions.height}
            colors={colors}
            distortion={0.8}
            swirl={0.1}
            grainMixer={0}
            grainOverlay={0}
            speed={0.25}
          />
        </div>
        <div className="relative z-10 max-w-md mx-auto px-6 text-center text-white">
          <p>Lien invalide.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full min-h-screen overflow-hidden bg-background flex items-center justify-center py-12">
      <div className="fixed inset-0 w-screen h-screen">
        <MeshGradient
          width={dimensions.width}
          height={dimensions.height}
          colors={colors}
          distortion={0.8}
          swirl={0.1}
          grainMixer={0}
          grainOverlay={0}
          speed={0.25}
        />
        <div className="absolute inset-0 pointer-events-none bg-black/20" />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-6 w-full">
        <Card className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
          {success ? (
            <div className="text-center py-6">
              <CheckCircle className="h-14 w-14 text-green-400 mx-auto mb-4" />
              <CardTitle className="text-white text-xl mb-2">Fiche enregistrée</CardTitle>
              <p className="text-white/80 text-sm">
                Votre fiche a bien été enregistrée. Vous pouvez fermer cette page.
              </p>
            </div>
          ) : (
            <>
              <CardHeader className="text-center mb-6">
                <div className="flex justify-center mb-2">
                  <User className="h-10 w-10 text-white/80" />
                </div>
                <CardTitle className="text-xl font-bold text-white">
                  Complétez vos informations
                </CardTitle>
                <p className="text-white/70 text-sm">
                  Remplissez le formulaire pour créer votre fiche client.
                </p>
              </CardHeader>

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white/90">Nom *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    disabled={submitting}
                  />
                  {errors.name && <p className="text-red-400 text-xs">{errors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90">Email *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemple.fr"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    disabled={submitting}
                  />
                  {errors.email && <p className="text-red-400 text-xs">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90">Téléphone *</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    disabled={submitting}
                  />
                  {errors.phone && <p className="text-red-400 text-xs">{errors.phone}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-white/90">Adresse</Label>
                  <Input
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="Numéro et rue"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    disabled={submitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white/90">Code postal</Label>
                    <Input
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="75001"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      disabled={submitting}
                    />
                    {errors.postalCode && <p className="text-red-400 text-xs">{errors.postalCode}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/90">Ville</Label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Paris"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/20 h-11 font-medium"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    "Valider"
                  )}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </section>
  );
}
