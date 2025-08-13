import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users } from "lucide-react";

interface Player {
  name: string;
  handicap: number;
  score?: number;
}

interface Match {
  id: string;
  tournamentId: string;
  type: "singles" | "foursome";
  player1?: Player;
  player2?: Player;
  round: string;
  status: "scheduled" | "in-progress" | "completed";
  date: string;
  time: string | null;
  tee?: string;
  winner?: string;
}

interface OptimizedMatchCardProps {
  match: Match;
  matchIndex: number;
  onMatchClick: (match: Match) => void;
}

export const OptimizedMatchCard = ({ match, matchIndex, onMatchClick }: OptimizedMatchCardProps) => {
  const isGeneratedMatch = !match.id.includes('-');
  
  return (
    <div className="relative mb-4">
      <Card 
        className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${
          match.status === "completed" 
            ? "border-success bg-success/5" 
            : match.status === "scheduled" 
            ? "border-warning bg-warning/5" 
            : "border-muted"
        }`}
        onClick={() => onMatchClick(match)}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Match header */}
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs">
                Match {matchIndex + 1}
              </Badge>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {match.time || "TBD"}
                {match.tee && (
                  <>
                    <Users className="h-3 w-3 ml-2" />
                    Tee {match.tee}
                  </>
                )}
              </div>
            </div>
            
            {/* Players */}
            <div className="grid grid-cols-1 gap-2">
              <div className={`p-2 rounded border ${match.winner === match.player1?.name ? 'bg-success/10 border-success' : 'bg-muted/30'}`}>
                {match.player1?.name ? (
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">
                      {match.player1.name.replace(/^(no-player-|no-opponent-)/, '')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      HC: {match.player1.handicap}
                      {match.player1.score !== undefined && ` • Score: ${match.player1.score}`}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    No player assigned
                  </div>
                )}
              </div>
              
              <div className={`p-2 rounded border ${match.winner === match.player2?.name ? 'bg-success/10 border-success' : 'bg-muted/30'}`}>
                {match.player2?.name ? (
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">
                      {match.player2.name.replace(/^(no-player-|no-opponent-)/, '')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      HC: {match.player2.handicap}
                      {match.player2.score !== undefined && ` • Score: ${match.player2.score}`}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    No opponent assigned
                  </div>
                )}
                {(match.player2?.name?.startsWith("no-opponent") || (match.player1?.name && !match.player2)) && (
                  <div className="text-xs text-muted-foreground italic">
                    (Free Pass)
                  </div>
                )}
              </div>
            </div>
            
            {/* Winner display */}
            {match.winner && (
              <div className="text-center">
                <Badge variant="default" className="text-xs">
                  Winner: {match.winner}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};