import { MeshGradient } from "@paper-design/shaders-react"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useLocation } from "wouter"
import { getInvitationByToken, markInvitationAsUsed, verifyTeamMemberCode, type TeamInvitation } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { XCircle, Loader2, Key } from "lucide-react"

export default function InvitePage() {
  const [location] = useLocation()
  // Extraire le token de l'URL
  const token = location.startsWith('/invite/') ? location.split('/invite/')[1] : ""
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  const [mounted, setMounted] = useState(false)
  const [invitation, setInvitation] = useState<TeamInvitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [, setLocation] = useLocation()

  const colors = ["#72b9bb", "#b5d9d9", "#ffd1bd", "#ffebe0", "#8cc5b8", "#dbf4a4"]

  useEffect(() => {
    setMounted(true)
    const update = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    if (token) {
      loadInvitation()
    }
  }, [token])

  const loadInvitation = async () => {
    setLoading(true)
    setError(null)
    try {
      const inv = await getInvitationByToken(token)
      setInvitation(inv)
      if (!inv) {
        setError("Cette invitation n'existe pas, a expiré ou a déjà été utilisée.")
      }
    } catch (err) {
      setError("Erreur lors du chargement de l'invitation.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!code.trim()) {
      setError("Veuillez entrer votre code de connexion")
      return
    }

    if (!invitation) {
      setError("Invitation invalide")
      return
    }

    setVerifying(true)

    try {
      // Vérifier le code avec le token d'invitation
      const member = await verifyTeamMemberCode(code.trim(), token)

      if (member) {
        // Stocker les infos du membre dans le localStorage
        localStorage.setItem('teamMember', JSON.stringify(member))
        localStorage.setItem('userType', 'team')

        // Marquer l'invitation comme utilisée
        await markInvitationAsUsed(token)

        // Rediriger vers le dashboard membre
        setLocation("/team-dashboard")
      } else {
        setError("Code de connexion incorrect")
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue")
    } finally {
      setVerifying(false)
    }
  }

  if (!mounted) return null

  return (
    <section className="relative w-full min-h-screen overflow-hidden bg-background flex items-center justify-center">
      <div className="fixed inset-0 w-screen h-screen">
        <MeshGradient
          width={dimensions.width}
          height={dimensions.height}
          colors={colors}
          distortion={0.8}
          swirl={0.6}
          grainMixer={0}
          grainOverlay={0}
          speed={0.42}
          offsetX={0.08}
        />
        <div className="absolute inset-0 pointer-events-none bg-white/20 dark:bg-black/25" />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-6 w-full">
        <Card className="bg-white/10 dark:bg-black/20 backdrop-blur-lg rounded-2xl border border-white/20 p-8 shadow-2xl">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
              <p className="text-white">Chargement de l'invitation...</p>
            </div>
          ) : !invitation ? (
            <div className="text-center py-8">
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <CardTitle className="text-white mb-2">Invitation invalide</CardTitle>
              <p className="text-white/70 text-sm">
                {error || "Cette invitation n'existe pas, a expiré ou a déjà été utilisée."}
              </p>
            </div>
          ) : (
            <>
              <CardHeader className="text-center mb-6">
                <CardTitle className="text-2xl font-bold text-white mb-2">
                  Rejoindre l'équipe
                </CardTitle>
                <p className="text-white/80 text-sm">
                  Entrez votre code de connexion pour accéder à votre dashboard
                </p>
              </CardHeader>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
                    <Input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Entrez votre code de connexion"
                      className="w-full bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 h-12 pl-10 text-center text-lg tracking-widest font-mono"
                      maxLength={10}
                      required
                      disabled={verifying}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={verifying}
                  className="w-full bg-[rgba(63,63,63,1)] border-4 border-card text-white hover:bg-[rgba(63,63,63,0.9)] transition-colors h-12 text-base font-semibold disabled:opacity-50"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Vérification...
                    </>
                  ) : (
                    "Se connecter"
                  )}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </section>
  )
}

