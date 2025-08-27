import { MarketingNav } from "@/components/MarketingNav";
import { PrivacyContent } from "@/components/PrivacyContent";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-course">
      <MarketingNav />
      
      {/* Content Section */}
      <section className="bg-background">
        <div className="container mx-auto px-4 py-16">
          <div className="flex items-center gap-4 mb-8">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
          </div>
          <h1 className="text-4xl font-bold text-center mb-12">Datenschutz</h1>
          <PrivacyContent />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            © 2025 Golf Matchplay Manager
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Privacy;