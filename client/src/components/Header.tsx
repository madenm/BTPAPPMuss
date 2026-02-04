import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, Building2 } from 'lucide-react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    console.log('Menu toggled:', !isMenuOpen); // todo: remove mock functionality
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-white" />
            <span className="text-xl font-bold text-foreground">AgentPro</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Fonctionnalités
            </a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </a>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild data-testid="button-dashboard">
              <a href="/dashboard">Dashboard</a>
            </Button>
            <Button variant="ghost" data-testid="button-login">
              Se connecter
            </Button>
            <Button data-testid="button-signup">
              S'inscrire
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost" 
            size="icon"
            className="md:hidden"
            onClick={toggleMenu}
            data-testid="button-menu-toggle"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col gap-4">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Fonctionnalités
              </a>
              <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </a>
              <div className="flex flex-col gap-2 pt-2">
                <Button variant="ghost" className="justify-start" data-testid="button-mobile-login">
                  Se connecter
                </Button>
                <Button className="justify-start" data-testid="button-mobile-signup">
                  S'inscrire
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}