import { Clock, Calendar, MapPin, Trophy, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Match {
  id: string;
  player1: { name: string; handicap: number; score?: number };
  player2: { name: string; handicap: number; score?: number };
  round: string;
  status: "scheduled" | "in-progress" | "completed";
  date: string;
  time: string;
  tee?: string;
  winner?: string;
}

interface MatchCardProps {
  match: Match;
  onScoreUpdate?: () => void;
  onViewDetails?: () => void;
}

export function MatchCard({ match, onScoreUpdate, onViewDetails }: MatchCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-warning text-warning-foreground";
      case "in-progress": return "bg-success text-success-foreground";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "scheduled": return <Clock className="h-3 w-3" />;
      case "in-progress": return <Users className="h-3 w-3" />;
      case "completed": return <Trophy className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <Card className="shadow-card hover:shadow-golf transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{match.round}</CardTitle>
          <Badge className={getStatusColor(match.status)}>
            {getStatusIcon(match.status)}
            {match.status.replace('-', ' ').charAt(0).toUpperCase() + match.status.slice(1).replace('-', ' ')}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {match.date}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {match.time}
          </div>
          {match.tee && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {match.tee}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="relative">
          {/* Player 1 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 bg-gradient-golf">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {match.player1.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{match.player1.name}</p>
                <p className="text-sm text-muted-foreground">Handicap: {match.player1.handicap}</p>
              </div>
            </div>
            {match.status === "completed" && match.player1.score !== undefined && (
              <div className="text-right">
                <p className="text-2xl font-bold">{match.player1.score}</p>
                {match.winner === match.player1.name && (
                  <Trophy className="h-4 w-4 text-warning inline" />
                )}
              </div>
            )}
          </div>
          
          {/* VS Divider */}
          <div className="flex items-center justify-center py-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
              VS
            </div>
          </div>
          
          {/* Player 2 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 bg-gradient-golf">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {match.player2.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{match.player2.name}</p>
                <p className="text-sm text-muted-foreground">Handicap: {match.player2.handicap}</p>
              </div>
            </div>
            {match.status === "completed" && match.player2.score !== undefined && (
              <div className="text-right">
                <p className="text-2xl font-bold">{match.player2.score}</p>
                {match.winner === match.player2.name && (
                  <Trophy className="h-4 w-4 text-warning inline" />
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          {match.status !== "completed" && onScoreUpdate && (
            <Button variant="outline" className="flex-1" onClick={onScoreUpdate}>
              {match.status === "scheduled" ? "Start Match" : "Update Score"}
            </Button>
          )}
          {onViewDetails && (
            <Button variant="ghost" onClick={onViewDetails}>
              Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}