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
  status: "scheduled" | "completed";
  date: string;
  time: string | null;
  tee?: string;
  winner?: string;
  // For progression tracking
  previousMatch1Id?: string;
  previousMatch2Id?: string;
}

interface MatchCardProps {
  match: Match;
  onScoreUpdate?: () => void;
  onViewDetails?: () => void;
  onEditMatch?: (matchId: string) => void;
  previousMatches?: Match[]; // For showing source match information
  showScores?: boolean; // Control whether to show scores
}

export function MatchCard({ match, onScoreUpdate, onViewDetails, onEditMatch, previousMatches = [], showScores = true }: MatchCardProps) {
  const getStatusColor = (status: string, hasWinner: boolean = false) => {
    switch (status) {
      case "scheduled": return "bg-warning text-warning-foreground";
      case "completed": return hasWinner 
        ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-md" 
        : "bg-muted text-muted-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "scheduled": return <Clock className="h-3 w-3" />;
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

  // Helper function to get source match information
  const getSourceMatchInfo = (previousMatchId?: string) => {
    if (!previousMatchId) return null;
    const sourceMatch = previousMatches.find(m => m.id === previousMatchId);
    if (!sourceMatch) return `Winner of ${previousMatchId}`;
    
    // Build descriptive text based on match participants
    if (sourceMatch.type === "singles") {
      if (sourceMatch.player1 && sourceMatch.player2) {
        return `Winner of ${sourceMatch.player1.name} vs ${sourceMatch.player2.name}`;
      } else if (sourceMatch.player1) {
        return `${sourceMatch.player1.name} (Bye)`;
      } else {
        return `Winner of ${sourceMatch.round}`;
      }
    } else if (sourceMatch.type === "foursome") {
      if (sourceMatch.team1 && sourceMatch.team2) {
        const team1Text = `${sourceMatch.team1.player1.name}/${sourceMatch.team1.player2.name}`;
        const team2Text = `${sourceMatch.team2.player1.name}/${sourceMatch.team2.player2.name}`;
        return `Winner of ${team1Text} vs ${team2Text}`;
      } else {
        return `Winner of ${sourceMatch.round}`;
      }
    }
    return `Winner of ${sourceMatch.round}`;
  };

  return (
    <Card className="shadow-card hover:shadow-golf transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{match.round}</CardTitle>
          <Badge className={getStatusColor(match.status, !!match.winner)}>
            {getStatusIcon(match.status)}
            {match.status.replace('-', ' ').charAt(0).toUpperCase() + match.status.slice(1).replace('-', ' ')}
            {match.winner && match.status === "completed" && (
              <Award className="h-3 w-3 ml-1" />
            )}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="relative">
          {match.type === "singles" && match.player1 ? (
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
                        <Award className="h-6 w-6 text-yellow-500 drop-shadow-sm" />
                      )}
                      {!match.player2 && (
                        <Badge variant="secondary" className="text-xs">Free Pass</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Handicap: {match.player1.handicap}</p>
                  </div>
                </div>
                {showScores && match.status === "completed" && match.player1.score !== undefined && (
                  <div className="text-right">
                    <p className="text-2xl font-bold">{match.player1.score}</p>
                  </div>
                )}
              </div>
              
              {/* VS Divider or Free Pass indicator */}
              <div className="flex items-center justify-center py-2">
                {match.player2 ? (
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                    VS
                  </div>
                ) : (
                  <div className="w-12 h-8 bg-secondary/50 rounded-full flex items-center justify-center text-secondary-foreground font-medium text-xs border-2 border-dashed border-secondary">
                    BYE
                  </div>
                )}
              </div>
              
              {/* Singles Match - Player 2 or Bye */}
              {match.player2 ? (
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
                          <Award className="h-6 w-6 text-yellow-500 drop-shadow-sm" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Handicap: {match.player2.handicap}</p>
                    </div>
                  </div>
                  {showScores && match.status === "completed" && match.player2.score !== undefined && (
                    <div className="text-right">
                      <p className="text-2xl font-bold">{match.player2.score}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border-2 border-dashed border-muted">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-muted/50 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground italic">No Opponent</p>
                      <p className="text-sm text-muted-foreground">Automatic advance</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">
                    Bye
                  </Badge>
                </div>
              )}
            </>
          ) : match.type === "foursome" && match.team1 && match.team2 ? (
            <>
              {/* Foursome Match - Team 1 */}
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-sm font-medium text-muted-foreground">Team 1</span>
                </div>
                {renderTeamCard(match.team1, showScores && match.status === "completed", match.winner === "team1")}
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
                {renderTeamCard(match.team2, showScores && match.status === "completed", match.winner === "team2")}
              </div>
            </>
          ) : match.type === "singles" && !match.player1 ? (
            // Empty bracket - show source match information
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border-2 border-dashed border-muted">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-muted/50 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-muted-foreground italic">
                      {getSourceMatchInfo(match.previousMatch1Id) || "TBD"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {match.previousMatch1Id ? "From previous round" : "To be determined"}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-center py-2">
                <div className="w-8 h-8 bg-muted/50 rounded-full flex items-center justify-center text-muted-foreground font-bold text-sm">
                  VS
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border-2 border-dashed border-muted">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-muted/50 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-muted-foreground italic">
                      {getSourceMatchInfo(match.previousMatch2Id) || "TBD"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {match.previousMatch2Id ? "From previous round" : "To be determined"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        
        <div className="flex gap-2">
          {onEditMatch && (
            <Button variant="outline" size="sm" onClick={() => onEditMatch(match.id)} className="gap-1">
              <Edit3 className="h-3 w-3" />
              Edit
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