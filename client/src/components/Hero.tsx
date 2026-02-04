import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoveRight, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["révolutionnaire", "intelligente", "automatisée", "professionnelle", "innovante"],
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="w-full pt-16">
      <div className="container mx-auto">
        <div className="flex gap-8 py-12 lg:py-20 items-center justify-center flex-col">
          <div>
            <Button variant="secondary" size="sm" className="gap-4" data-testid="button-launch-article">
              Solution pour artisans <MoveRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-4 flex-col">
            <h1 className="text-5xl md:text-7xl max-w-2xl tracking-tighter text-center font-regular">
              <span className="text-foreground">Une gestion d'entreprise artisanale</span>
              <span className="relative flex w-full justify-center overflow-hidden text-center md:pb-4 md:pt-1">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="absolute font-semibold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-600 bg-clip-text text-transparent"
                    initial={{ opacity: 0, y: -100 }}
                    transition={{ type: "spring", stiffness: 50 }}
                    animate={
                      titleNumber === index
                        ? {
                            y: 0,
                            opacity: 1,
                          }
                        : {
                            y: titleNumber > index ? -150 : 150,
                            opacity: 0,
                          }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
            </h1>

            <p className="text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground max-w-2xl text-center">
              Gérer une entreprise artisanale aujourd'hui demande efficacité et professionnalisme. 
              Créez des devis en quelques clics, visualisez vos projets avec l'IA, gérez vos 
              chantiers et prospects. Notre objectif est de digitaliser votre activité 
              pour vous faire gagner du temps et impressionner vos clients.
            </p>
          </div>
          <div className="flex flex-row gap-3">
            <Button size="lg" className="gap-4" variant="outline" data-testid="button-login">
              Se connecter <PhoneCall className="w-4 h-4" />
            </Button>
            <Button size="lg" className="gap-4 bg-white/20 backdrop-blur-md border border-white/10 text-white hover:bg-white/30" data-testid="button-signup">
              S'inscrire <MoveRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Hero };