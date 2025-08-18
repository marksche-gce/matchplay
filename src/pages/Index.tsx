import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Trophy, Play, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-course">
      
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <Trophy className="h-16 w-16 text-primary mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Matchplay Turnier Manager
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Erstellen und verwalten Sie Golf Matchplay Turniere mit automatischer Bracket-Generierung, 
            Spieler-Registrierung und Gewinner-Aufstieg.
          </p>
        </div>

        <div className="text-center mt-16">
          <Link to="/tournaments">
            <Button size="lg" variant="default" className="text-lg px-8 py-4">
              <Trophy className="h-5 w-5 mr-2" />
              Loslegen
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
