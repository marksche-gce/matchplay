import { Trophy, Users, Calendar, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHeaderImage } from "@/hooks/useHeaderImage";

interface TournamentInfo {
  name: string;
  course: string;
  date: string;
  players: number;
  status: "upcoming" | "active" | "completed";
}

interface TournamentHeaderProps {
  tournament: TournamentInfo;
}

export function TournamentHeader({ tournament }: TournamentHeaderProps) {
  const { headerImageUrl } = useHeaderImage();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming": return "bg-warning text-warning-foreground";
      case "active": return "bg-success text-success-foreground";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="relative overflow-hidden border-none shadow-elevated">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${headerImageUrl})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-transparent" />
      
      <div className="relative p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="text-primary-foreground">
            <div className="flex items-center gap-3 mb-3">
              <Trophy className="h-8 w-8" />
              <Badge className={getStatusColor(tournament.status)}>
                {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
              </Badge>
            </div>
            <h1 className="text-4xl font-bold mb-2">{tournament.name}</h1>
            <p className="text-xl opacity-90">{tournament.course}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-primary-foreground">
            <div className="flex items-center gap-2 bg-background/10 backdrop-blur-sm rounded-lg p-3">
              <Calendar className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-80">Tournament Date</p>
                <p className="font-semibold">{tournament.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-background/10 backdrop-blur-sm rounded-lg p-3">
              <Users className="h-5 w-5" />
              <div>
                <p className="text-sm opacity-80">Players</p>
                <p className="font-semibold">{tournament.players}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}