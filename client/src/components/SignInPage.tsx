import React, { useState } from 'react';
import { Eye, EyeOff, Home } from 'lucide-react';
import { useLocation } from 'wouter';

// --- HELPER COMPONENTS (ICONS) ---

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

// --- TYPE DEFINITIONS ---

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
  isSignUp?: boolean;
  onToggleMode?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-white/20 bg-black/20 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial, delay: string }) => (
  <div className={`animate-testimonial ${delay} flex items-start gap-3 rounded-3xl bg-card/40 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/10 p-5 w-64`}>
    <img src={testimonial.avatarSrc} className="h-10 w-10 object-cover rounded-2xl" alt="avatar" />
    <div className="text-sm leading-snug">
      <p className="flex items-center gap-1 font-medium">{testimonial.name}</p>
      <p className="text-white/70">{testimonial.handle}</p>
      <p className="mt-1 text-white/80">{testimonial.text}</p>
    </div>
  </div>
);

// --- MAIN COMPONENT ---

export const SignInPage: React.FC<SignInPageProps> = ({
  title = <span className="font-light text-foreground tracking-tighter">Bienvenue</span>,
  description = "Accédez à votre compte et poursuivez votre parcours avec nous",
  heroImageSrc,
  testimonials = [],
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
  isSignUp = false,
  onToggleMode,
  loading = false,
  disabled = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [, setLocation] = useLocation();

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row font-geist w-[100dvw]">
      {/* Left column: sign-in form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Back to Home Button */}
          <button
            onClick={() => setLocation('/')}
            className="mb-6 flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm"
          >
            <Home size={16} />
            Retour à l'accueil
          </button>
          
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight text-white">{title}</h1>
            <p className="animate-element animate-delay-200 text-white/80">{description}</p>

            <form 
              className="space-y-5" 
              onSubmit={(e) => {
                // Protection contre les soumissions multiples
                const form = e.currentTarget;
                const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
                if (submitButton?.disabled) {
                  e.preventDefault();
                  return;
                }
                onSignIn?.(e);
              }}
            >
              {isSignUp && (
                <div className="animate-element animate-delay-250">
                  <label className="text-sm font-medium text-white/70">Nom complet</label>
                  <GlassInputWrapper>
                    <input name="fullName" type="text" placeholder="Entrez votre nom complet" className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-white placeholder:text-white/50" />
                  </GlassInputWrapper>
                </div>
              )}

              <div className="animate-element animate-delay-300">
                <label className="text-sm font-medium text-white/70">Adresse e-mail</label>
                <GlassInputWrapper>
                  <input name="email" type="email" placeholder="Entrez votre adresse e-mail" className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-white placeholder:text-white/50" />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400">
                <label className="text-sm font-medium text-white/70">Mot de passe</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Entrez votre mot de passe" className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none text-white placeholder:text-white/50" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center">
                      {showPassword ? <EyeOff className="w-5 h-5 text-white/70 hover:text-white transition-colors" /> : <Eye className="w-5 h-5 text-white/70 hover:text-white transition-colors" />}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              {!isSignUp && (
                <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                  <label className="flex items-center gap-3 cursor-pointer" htmlFor="rememberMe">
                    <input
                      id="rememberMe"
                      type="checkbox"
                      name="rememberMe"
                      className="custom-checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span className="text-white/90">Rester connecté</span>
                  </label>
                  <a href="#" onClick={(e) => { e.preventDefault(); onResetPassword?.(); }} className="hover:underline text-violet-400 transition-colors">Réinitialiser le mot de passe</a>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading || disabled}
                className={`animate-element animate-delay-600 w-full rounded-2xl py-4 font-medium text-white transition-colors ${
                  loading || disabled 
                    ? 'bg-violet-500/50 cursor-not-allowed' 
                    : 'bg-violet-500 hover:bg-violet-600'
                }`}
              >
                {loading ? 'Chargement...' : (isSignUp ? 'Créer un compte' : 'Se connecter')}
              </button>
            </form>

            {onToggleMode && (
              <div className="animate-element animate-delay-650 text-center text-sm text-white/70">
                {isSignUp ? (
                  <>
                    Vous avez déjà un compte ? <a href="#" onClick={(e) => { e.preventDefault(); onToggleMode(); }} className="text-violet-400 hover:underline transition-colors">Se connecter</a>
                  </>
                ) : (
                  <>
                    Nouveau sur la plateforme ? <a href="#" onClick={(e) => { e.preventDefault(); onToggleMode(); }} className="text-violet-400 hover:underline transition-colors">Créer un compte</a>
                  </>
                )}
              </div>
            )}

            {onGoogleSignIn && (
              <>
                <div className="animate-element animate-delay-700 relative flex items-center justify-center">
                  <span className="w-full border-t border-white/20"></span>
                  <span className="px-4 text-sm text-white/70 bg-black/20 backdrop-blur-md absolute">Ou continuer avec</span>
                </div>

                <button onClick={onGoogleSignIn} type="button" className="animate-element animate-delay-800 w-full flex items-center justify-center gap-3 border border-white/20 rounded-2xl py-4 hover:bg-white/10 bg-black/20 backdrop-blur-sm text-white transition-colors">
                  <GoogleIcon />
                  Continuer avec Google
                </button>
              </>
            )}

            {!onToggleMode && onCreateAccount && (
              <p className="animate-element animate-delay-900 text-center text-sm text-white/70">
                Nouveau sur la plateforme ? <a href="#" onClick={(e) => { e.preventDefault(); onCreateAccount?.(); }} className="text-violet-400 hover:underline transition-colors">Créer un compte</a>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Right column: hero image + testimonials */}
      {heroImageSrc && (
        <section className="hidden md:block flex-1 relative p-4">
          <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center" style={{ backgroundImage: `url(${heroImageSrc})` }}></div>
          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
              <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
              {testimonials[1] && <div className="hidden xl:flex"><TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" /></div>}
              {testimonials[2] && <div className="hidden 2xl:flex"><TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" /></div>}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

