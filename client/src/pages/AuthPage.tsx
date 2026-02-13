import { useState, useRef, useEffect } from "react"
import { useLocation } from "wouter"
import { useAuth } from "@/context/AuthContext"
import { SignInPage } from "@/components/SignInPage"

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [showResendEmail, setShowResendEmail] = useState(false)
  const [lastEmail, setLastEmail] = useState<string>('')
  const { signUp, signIn, resendConfirmationEmail, user } = useAuth()
  const [, setLocation] = useLocation()
  const lastSubmitTime = useRef<number>(0)
  const isSubmitting = useRef<boolean>(false)
  const rateLimitUntil = useRef<number>(0) // Timestamp jusqu'à quand le rate limit est actif
  const pendingRedirectToDashboard = useRef(false)

  // Redirection vers dashboard uniquement après que le contexte ait mis à jour user (évite la race)
  useEffect(() => {
    if (user && pendingRedirectToDashboard.current) {
      pendingRedirectToDashboard.current = false
      setLocation("/dashboard")
    }
  }, [user, setLocation])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    // Protection contre les soumissions multiples avec debounce
    const now = Date.now()
    if (loading || isSubmitting.current) {
      console.warn('AuthPage: Submission already in progress, ignoring duplicate submit')
      return
    }
    
    // Debounce: empêcher les soumissions trop rapides (moins de 1 seconde entre deux soumissions)
    if (now - lastSubmitTime.current < 1000) {
      console.warn('AuthPage: Submission too soon after previous, ignoring (debounce)')
      return
    }
    
    // Vérifier si on est toujours sous rate limit
    if (rateLimitUntil.current > now) {
      const minutesRemaining = Math.ceil((rateLimitUntil.current - now) / 60000)
      setError(`Trop de tentatives récentes. Veuillez attendre encore ${minutesRemaining} minute(s) avant de réessayer. Les tentatives précédentes comptent dans la limite.`)
      setIsRateLimited(true)
      return
    }
    
    lastSubmitTime.current = now
    isSubmitting.current = true
    setError(null)
    setLoading(true)
    setIsRateLimited(false)
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string

    try {
      if (isSignUp) {
        if (!email || !password || !fullName) {
          setError("Veuillez remplir tous les champs obligatoires")
          setLoading(false)
          return
        }
        const { error } = await signUp(email, password, fullName)
        if (error) {
          // Messages d'erreur plus clairs
          if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('Too Many Requests') || error.message?.includes('rate limit exceeded')) {
            setIsRateLimited(true)
            // Définir le timestamp jusqu'à quand le rate limit est actif (10 minutes)
            rateLimitUntil.current = Date.now() + 600000
            setError("Trop de tentatives récentes depuis cette adresse IP. Les tentatives précédentes comptent dans la limite (30 requêtes toutes les 5 minutes). Veuillez attendre 5-10 minutes avant de réessayer, OU modifie les limites dans Supabase > Authentication > Rate Limits pour le développement.")
            // Réinitialiser le flag après 10 minutes
            setTimeout(() => {
              setIsRateLimited(false)
              rateLimitUntil.current = 0
            }, 600000)
          } else if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
            setError("Cet email est déjà utilisé. Connectez-vous ou utilisez un autre email.")
          } else if (error.message?.includes('Password') || error.message?.includes('password')) {
            setError("Le mot de passe doit contenir au moins 6 caractères.")
          } else {
            setError(error.message || "Erreur lors de la création du compte")
          }
        } else {
          setError(null)
          setLocation("/login")
        }
      } else {
        if (!email || !password) {
          setError("Veuillez remplir tous les champs")
          setLoading(false)
          return
        }
        const rememberMe = (e.currentTarget.elements.namedItem('rememberMe') as HTMLInputElement)?.checked ?? true
        const { error } = await signIn(email, password, rememberMe)
        if (error) {
          // Messages d'erreur plus clairs
          if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('Too Many Requests') || error.message?.includes('rate limit exceeded')) {
            setIsRateLimited(true)
            // Définir le timestamp jusqu'à quand le rate limit est actif (10 minutes)
            rateLimitUntil.current = Date.now() + 600000
            setError("Trop de tentatives de connexion récentes. Les tentatives précédentes comptent dans la limite. Veuillez attendre 5-10 minutes avant de réessayer, OU modifie les limites dans Supabase > Authentication > Rate Limits.")
            // Réinitialiser le flag après 10 minutes
            setTimeout(() => {
              setIsRateLimited(false)
              rateLimitUntil.current = 0
            }, 600000)
          } else if (error.message?.includes('Email not confirmed') || error.message?.includes('email not confirmed')) {
            setLastEmail(email)
            setShowResendEmail(true)
            setError("Votre email n'est pas confirmé. Vérifiez votre boîte mail ou cliquez sur 'Renvoyer l'email de confirmation' ci-dessous.")
          } else if (error.message?.includes('Invalid login credentials') || error.status === 400) {
            setError("Email ou mot de passe incorrect. Vérifiez vos identifiants.")
          } else {
            setError(error.message || "Erreur lors de la connexion")
          }
        } else {
          setError(null)
          setShowResendEmail(false)
          pendingRedirectToDashboard.current = true
          // Ne pas appeler setLocation ici : on redirige dans useEffect quand user est défini
        }
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue")
    } finally {
      setLoading(false)
      isSubmitting.current = false
    }
  }

  const handleResendEmail = async () => {
    if (!lastEmail || loading) return
    setLoading(true)
    setError(null)
    const { error } = await resendConfirmationEmail(lastEmail)
    if (error) {
      if (error.status === 429) {
        setError("Trop de demandes. Veuillez attendre quelques minutes avant de renvoyer l'email.")
      } else {
        setError(error.message || "Erreur lors de l'envoi de l'email de confirmation")
      }
    } else {
      setError(null)
      setShowResendEmail(false)
      alert("Email de confirmation renvoyé ! Vérifiez votre boîte mail.")
    }
    setLoading(false)
  }

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      <div className="relative z-10">
        {error && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm backdrop-blur-md max-w-md">
            <div>{error}</div>
            {showResendEmail && lastEmail && (
              <button
                onClick={handleResendEmail}
                disabled={loading}
                className="mt-3 w-full px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:bg-violet-500/50 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
              >
                {loading ? 'Envoi...' : 'Renvoyer l\'email de confirmation'}
              </button>
            )}
          </div>
        )}
        <SignInPage
          title={
            <span className="font-light text-white tracking-tighter">
              {isSignUp ? "Créer un compte" : "Bienvenue"}
            </span>
          }
          description={
            isSignUp
              ? "Créez votre compte pour accéder à votre application TitanBtp"
              : "Connectez-vous à votre compte TitanBtp"
          }
          isSignUp={isSignUp}
          onToggleMode={() => setIsSignUp(!isSignUp)}
          onSignIn={handleSubmit}
          loading={loading}
          disabled={isRateLimited}
        />
      </div>
    </div>
  )
}
