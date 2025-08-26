import { MarketingNav } from "@/components/MarketingNav";
import { OnepagerContent } from "@/components/OnepagerContent";
import { useHeaderImage } from "@/hooks/useHeaderImage";

const Index = () => {
  const { headerImageUrl } = useHeaderImage();

  return (
    <div className="min-h-screen bg-gradient-course">
      <MarketingNav />
      
      {/* Hero Section with Header Image */}
      <section className="relative h-[40vh] min-h-[350px] max-h-[500px]">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${headerImageUrl})` }}
        >
          <div className="absolute inset-0 bg-background/60" />
        </div>
      </section>

      {/* Content Section */}
      <section className="bg-background">
        <div className="container mx-auto px-4 py-16">
          <OnepagerContent />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} Golf Tournament Manager. Alle Rechte vorbehalten.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
