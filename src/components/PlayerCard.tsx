import { User, Trophy, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Player {
  id: string;
  name: string;
  handicap: number;
  wins: number;
  losses: number;
  status: "active" | "eliminated" | "champion";
}

interface PlayerCardProps {
  player: Player;
  onSelect?: () => void;
  selected?: boolean;
}

export function PlayerCard({ player, onSelect, selected = false }: PlayerCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "champion": return "bg-warning text-warning-foreground";
      case "active": return "bg-success text-success-foreground";
      case "eliminated": return "bg-muted text-muted-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const winPercentage = player.wins + player.losses > 0 
    ? Math.round((player.wins / (player.wins + player.losses)) * 100) 
    : 0;

  return (
    <Card 
      className={`transition-all duration-300 cursor-pointer hover:shadow-golf transform hover:scale-105 ${
        selected ? 'ring-2 ring-primary shadow-elevated' : 'shadow-card'
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-12 w-12 bg-gradient-golf">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {player.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{player.name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Handicap: {player.handicap}</span>
            </div>
          </div>
          <Badge className={getStatusColor(player.status)}>
            {player.status === "champion" && <Trophy className="h-3 w-3 mr-1" />}
            {player.status.charAt(0).toUpperCase() + player.status.slice(1)}
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-muted rounded-lg p-2">
            <p className="text-2xl font-bold text-success">{player.wins}</p>
            <p className="text-xs text-muted-foreground">Wins</p>
          </div>
          <div className="bg-muted rounded-lg p-2">
            <p className="text-2xl font-bold text-destructive">{player.losses}</p>
            <p className="text-xs text-muted-foreground">Losses</p>
          </div>
          <div className="bg-muted rounded-lg p-2">
            <p className="text-2xl font-bold text-primary">{winPercentage}%</p>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}