import { MarketingNav } from "@/components/MarketingNav";
import { PrivacyContent } from "@/components/PrivacyContent";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-gradient-course">
      <MarketingNav />
      
      {/* Content Section */}
      <section className="bg-background">
        <div className="container mx-auto px-4 py-16">
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