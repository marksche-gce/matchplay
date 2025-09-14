import { MarketingNav } from "@/components/MarketingNav";
import { OnepagerContent } from "@/components/OnepagerContent";
import { HeaderImageUpload } from "@/components/HeaderImageUpload";
import { VideoPlayer } from "@/components/VideoPlayer";
import { useHeaderImage } from "@/hooks/useHeaderImage";
import { useSystemAdminCheck } from "@/hooks/useSystemAdminCheck";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit } from "lucide-react";
import { useState } from "react";

const Index = () => {
  const { headerImageUrl, headerVideoUrl, loading } = useHeaderImage();
  const { isSystemAdmin } = useSystemAdminCheck();
  const [showHeaderEdit, setShowHeaderEdit] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-course">
      <MarketingNav />
      
      {/* Hero Section with Header Media */}
      <section className="relative h-[50vh] min-h-[438px] max-h-[625px]">
        {!loading && (
          <>
            {headerVideoUrl ? (
              <VideoPlayer 
                url={headerVideoUrl}
                className="absolute inset-0 w-full h-full object-cover"
                autoplay={true}
                muted={true}
                controls={false}
              />
            ) : (
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${headerImageUrl})` }}
              />
            )}
          </>
        )}
        
        {/* Header Image Edit Button for System Admins */}
        {isSystemAdmin && (
          <Dialog open={showHeaderEdit} onOpenChange={setShowHeaderEdit}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-20 right-4 z-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Header bearbeiten
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Header Media bearbeiten</DialogTitle>
              </DialogHeader>
              <HeaderImageUpload />
            </DialogContent>
          </Dialog>
        )}
      </section>

      {/* Content Section */}
      <section className="bg-background">
        <div className="container mx-auto px-4 py-8">
          <OnepagerContent />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-8">
            <a 
              href="/privacy" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Datenschutz
            </a>
            <p className="text-muted-foreground">
              © 2025 Golf Matchplay Manager
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
