import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Trophy, Play, Users, Calendar } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-course">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <Link to="/tournaments">
          <Button variant="default" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            View Tournaments
          </Button>
        </Link>
        <UserMenu />
      </div>
      
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <Trophy className="h-16 w-16 text-primary mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Match Play Tournament Manager
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Create and manage golf match play tournaments with automatic bracket generation, 
            player registration, and winner advancement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="bg-card shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                Singles & Teams
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Support for both singles match play (player vs player) and foursome tournaments (teams of two).
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Play className="h-8 w-8 text-success" />
                Auto Brackets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Automatic bracket generation with proper winner advancement logic for tournaments up to 128 participants.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-warning" />
                Easy Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Set tournament dates, manage registrations, and track match results with an intuitive interface.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-16">
          <Link to="/tournaments">
            <Button size="lg" variant="default" className="text-lg px-8 py-4">
              <Trophy className="h-5 w-5 mr-2" />
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
