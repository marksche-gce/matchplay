import { Clock, Calendar, MapPin, Award, Users, Edit3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Player {
  name: string;
  handicap: number;
  score?: number;
}

interface Team {
  player1: Player;
  player2: Player;
  teamScore?: number;
}

interface Match {
  id: string;
  type: "singles" | "foursome";
  // For singles matches
  player1?: Player;
  player2?: Player;
  // For foursome matches
  team1?: Team;
  team2?: Team;
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
  onEditMatch?: (matchId: string) => void;
}

export function MatchCard({ match, onScoreUpdate, onViewDetails, onEditMatch }: MatchCardProps) {
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
      case "completed": return <Award className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const renderPlayerCard = (player: Player, showScore: boolean = false, isWinner: boolean = false) => (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8 bg-gradient-golf">
        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
          {player.name.split(' ').map(n => n[0]).join('')}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{player.name}</p>
        <p className="text-xs text-muted-foreground">HC: {player.handicap}</p>
      </div>
      {showScore && player.score !== undefined && (
        <div className="text-right">
          <p className="text-lg font-bold">{player.score}</p>
          {isWinner && <Award className="h-5 w-5 text-warning inline ml-1" />}
        </div>
      )}
    </div>
  );

  const renderTeamCard = (team: Team, showScore: boolean = false, isWinner: boolean = false) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1 flex-1">
          {renderPlayerCard(team.player1)}
          {renderPlayerCard(team.player2)}
        </div>
        {showScore && team.teamScore !== undefined && (
          <div className="text-right ml-2">
            <p className="text-2xl font-bold">{team.teamScore}</p>
            {isWinner && <Award className="h-6 w-6 text-warning inline ml-1" />}
          </div>
        )}
      </div>
    </div>
  );

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
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="relative">
          {match.type === "singles" && match.player1 && match.player2 ? (
            <>
              {/* Singles Match - Player 1 */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 bg-gradient-golf">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {match.player1.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{match.player1.name}</p>
                      {match.winner === match.player1.name && (
                        <Award className="h-5 w-5 text-warning" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Handicap: {match.player1.handicap}</p>
                  </div>
                </div>
                {match.status === "completed" && match.player1.score !== undefined && (
                  <div className="text-right">
                    <p className="text-2xl font-bold">{match.player1.score}</p>
                  </div>
                )}
              </div>
              
              {/* VS Divider */}
              <div className="flex items-center justify-center py-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                  VS
                </div>
              </div>
              
              {/* Singles Match - Player 2 */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 bg-gradient-golf">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {match.player2.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{match.player2.name}</p>
                      {match.winner === match.player2.name && (
                        <Award className="h-5 w-5 text-warning" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Handicap: {match.player2.handicap}</p>
                  </div>
                </div>
                {match.status === "completed" && match.player2.score !== undefined && (
                  <div className="text-right">
                    <p className="text-2xl font-bold">{match.player2.score}</p>
                  </div>
                )}
              </div>
            </>
          ) : match.type === "foursome" && match.team1 && match.team2 ? (
            <>
              {/* Foursome Match - Team 1 */}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-sm font-medium text-muted-foreground">Team 1</span>
                </div>
                {renderTeamCard(match.team1, match.status === "completed", match.winner === "team1")}
              </div>
              
              {/* VS Divider */}
              <div className="flex items-center justify-center py-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                  VS
                </div>
              </div>
              
              {/* Foursome Match - Team 2 */}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-secondary rounded-full"></div>
                  <span className="text-sm font-medium text-muted-foreground">Team 2</span>
                </div>
                {renderTeamCard(match.team2, match.status === "completed", match.winner === "team2")}
              </div>
            </>
          ) : null}
        </div>
        
        <div className="flex gap-2">
          {onEditMatch && (
            <Button variant="outline" size="sm" onClick={() => onEditMatch(match.id)} className="gap-1">
              <Edit3 className="h-3 w-3" />
              Edit
            </Button>
          )}
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