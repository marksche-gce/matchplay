import { TournamentDashboard } from "@/components/TournamentDashboard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";

const Index = () => {
  return (
    <div>
      <div className="fixed top-4 right-4 z-50">
        <Link to="/register">
          <Button variant="outline" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Player Registration
          </Button>
        </Link>
      </div>
      <TournamentDashboard />
    </div>
  );
};

export default Index;
