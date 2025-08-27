import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Trophy, User, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";

export function MarketingNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();

  const navItems = [
    { title: "Turniere", icon: Trophy, href: "/tournaments" },
    { title: "Kontakt", icon: Mail, section: "contact" },
    user
      ? { title: "Logout", icon: User, onClick: () => signOut() }
      : { title: "Login", icon: User, href: "/auth" },
  ];

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsOpen(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <Trophy className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold text-primary">
            Golf Matchplay Manager
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          {navItems.map((item) => (
            item.href ? (
              <Link key={item.title} to={item.href}>
                <Button variant="ghost" className="flex items-center space-x-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Button>
              </Link>
            ) : (
              <Button
                key={item.title}
                variant="ghost"
                onClick={() => {
                  if (item.section) scrollToSection(item.section);
                  if ((item as any).onClick) (item as any).onClick();
                }}
                className="flex items-center space-x-2"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Button>
            )
          ))}
        </div>

        {/* Mobile Navigation */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px]">
            <div className="flex flex-col space-y-4 mt-8">
              {navItems.map((item) => (
                item.href ? (
                  <Link 
                    key={item.title} 
                    to={item.href}
                    onClick={() => setIsOpen(false)}
                  >
                    <Button variant="ghost" className="w-full justify-start">
                      <item.icon className="h-4 w-4 mr-2" />
                      {item.title}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    key={item.title}
                    variant="ghost"
                    onClick={() => {
                      if (item.section) scrollToSection(item.section);
                      if ((item as any).onClick) (item as any).onClick();
                      setIsOpen(false);
                    }}
                    className="w-full justify-start"
                  >
                    <item.icon className="h-4 w-4 mr-2" />
                    {item.title}
                  </Button>
                )
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}