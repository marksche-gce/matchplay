import { useState, useEffect } from "react";
import { Trophy, Award, Clock, Users, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MatchCard } from "./MatchCard";
import { EditMatchDialog } from "./EditMatchDialog";
import { useToast } from "@/hooks/use-toast";

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
  team1?: { 
    player1: Player;
    player2: Player;
    teamScore?: number;
  };
  team2?: { 
    player1: Player;
    player2: Player;
    teamScore?: number;
  };
  round: string;
  status: "scheduled" | "completed";
  date: string;
  time: string | null;
  tee?: string;
  winner?: string;
  nextMatchId?: string; // For progression
  previousMatch1Id?: string; // For tracking source matches
  previousMatch2Id?: string;
}

interface BracketRound {
  name: string;
  matches: Match[];
  roundNumber: number;
}

interface TournamentBracketProps {
  tournamentId: string;
  matches: Match[];
  players: { id: string; name: string; handicap: number; }[];
  onMatchUpdate: (matches: Match[]) => void;
  format: "matchplay" | "strokeplay" | "scramble";
}

export function TournamentBracket({ 
  tournamentId, 
  matches, 
  players, 
  onMatchUpdate,
  format 
}: TournamentBracketProps) {
  const [bracketData, setBracketData] = useState<BracketRound[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const { toast } = useToast();

  // Initialize bracket structure
  useEffect(() => {
    if (format === "matchplay") {
      generateBracket();
    }
  }, [matches, format]);

  const generateBracket = () => {
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    
    // Group matches by round
    const roundsMap = new Map<string, Match[]>();
    tournamentMatches.forEach(match => {
      const roundName = match.round;
      if (!roundsMap.has(roundName)) {
        roundsMap.set(roundName, []);
      }
      roundsMap.get(roundName)!.push(match);
    });

    // Create bracket structure with proper ordering
    const rounds: BracketRound[] = [];
    const roundOrder = ["Round 1", "Round 2", "Quarterfinals", "Semifinals", "Final"];
    
    roundOrder.forEach((roundName, index) => {
      if (roundsMap.has(roundName)) {
        rounds.push({
          name: roundName,
          matches: roundsMap.get(roundName)!,
          roundNumber: index + 1
        });
      }
    });

    setBracketData(rounds);
  };

  const validateWinnerProgression = (match: Match, winner: string): boolean => {
    // Check if the winner actually participated in the match
    if (match.type === "singles") {
      const validWinners = [match.player1?.name, match.player2?.name].filter(Boolean);
      return validWinners.includes(winner);
    } else if (match.type === "foursome") {
      const validWinners = ["team1", "team2"];
      return validWinners.includes(winner);
    }
    return false;
  };

  const progressWinner = (completedMatch: Match) => {
    if (!completedMatch.winner || completedMatch.status !== "completed") {
      return;
    }

    // Validate winner
    if (!validateWinnerProgression(completedMatch, completedMatch.winner)) {
      toast({
        title: "Invalid Winner",
        description: "The selected winner did not participate in this match.",
        variant: "destructive"
      });
      return;
    }

    // Find the next match that this winner should advance to
    const nextMatch = matches.find(m => 
      m.previousMatch1Id === completedMatch.id || 
      m.previousMatch2Id === completedMatch.id
    );

    if (nextMatch && nextMatch.status === "scheduled") {
      // Progress the winner to the next match
      const updatedMatches = matches.map(match => {
        if (match.id === nextMatch.id) {
          let updatedMatch = { ...match };

          if (completedMatch.type === "singles" && completedMatch.winner) {
            const winnerPlayer = completedMatch.winner === completedMatch.player1?.name 
              ? completedMatch.player1 
              : completedMatch.player2;
            
            if (match.previousMatch1Id === completedMatch.id) {
              updatedMatch.player1 = winnerPlayer ? { ...winnerPlayer, score: undefined } : undefined;
            } else if (match.previousMatch2Id === completedMatch.id) {
              updatedMatch.player2 = winnerPlayer ? { ...winnerPlayer, score: undefined } : undefined;
            }
          } else if (completedMatch.type === "foursome" && completedMatch.winner) {
            const winnerTeam = completedMatch.winner === "team1" 
              ? completedMatch.team1 
              : completedMatch.team2;
            
            if (match.previousMatch1Id === completedMatch.id) {
              updatedMatch.team1 = winnerTeam ? { 
                ...winnerTeam, 
                teamScore: undefined,
                player1: { ...winnerTeam.player1, score: undefined },
                player2: { ...winnerTeam.player2, score: undefined }
              } : undefined;
            } else if (match.previousMatch2Id === completedMatch.id) {
              updatedMatch.team2 = winnerTeam ? { 
                ...winnerTeam, 
                teamScore: undefined,
                player1: { ...winnerTeam.player1, score: undefined },
                player2: { ...winnerTeam.player2, score: undefined }
              } : undefined;
            }
          }

          return updatedMatch;
        }
        return match;
      });

      onMatchUpdate(updatedMatches);
      
      toast({
        title: "Winner Advanced!",
        description: `${completedMatch.winner} has been advanced to the next round.`,
      });
    }
  };

  const handleMatchUpdate = (matchId: string, updates: Partial<Match>) => {
    const updatedMatches = matches.map(match => {
      if (match.id === matchId) {
        const updatedMatch = { ...match, ...updates };
        
        // If match is being completed, validate and progress winner
        if (updatedMatch.status === "completed" && updatedMatch.winner) {
          // Validate winner first
          if (!validateWinnerProgression(updatedMatch, updatedMatch.winner)) {
            toast({
              title: "Invalid Winner",
              description: "The selected winner did not participate in this match.",
              variant: "destructive"
            });
            return match; // Don't update if winner is invalid
          }
          
          // Progress winner after state update
          setTimeout(() => progressWinner(updatedMatch), 100);
        }
        
        return updatedMatch;
      }
      return match;
    });

    onMatchUpdate(updatedMatches);
  };

  const generateInitialBracket = () => {
    if (players.length < 2) {
      toast({
        title: "Not Enough Players",
        description: "At least 2 players are required to generate a bracket.",
        variant: "destructive"
      });
      return;
    }

    // Calculate bracket size (nearest power of 2)
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(players.length)));
    const rounds = Math.log2(bracketSize);
    
    const newMatches: Match[] = [];
    let matchIdCounter = Date.now();

    // Generate all rounds
    for (let round = 1; round <= rounds; round++) {
      const matchesInRound = Math.pow(2, rounds - round);
      const roundName = getRoundName(round, rounds);
      
      for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
        const match: Match = {
          id: (matchIdCounter++).toString(),
          tournamentId,
          type: "singles",
          round: roundName,
          status: round === 1 ? "scheduled" : "scheduled",
          date: new Date().toISOString().split('T')[0],
          time: "09:00",
          tee: (matchIndex + 1).toString()
        };

        // For first round, assign players
        if (round === 1) {
          const player1Index = matchIndex * 2;
          const player2Index = matchIndex * 2 + 1;
          
          if (player1Index < players.length) {
            match.player1 = players[player1Index];
          }
          if (player2Index < players.length) {
            match.player2 = players[player2Index];
          }
        } else {
          // Set up connections to previous matches
          const prevRoundMatchIndex1 = matchIndex * 2;
          const prevRoundMatchIndex2 = matchIndex * 2 + 1;
          const prevRoundMatches = newMatches.filter(m => m.round === getRoundName(round - 1, rounds));
          
          if (prevRoundMatches[prevRoundMatchIndex1]) {
            match.previousMatch1Id = prevRoundMatches[prevRoundMatchIndex1].id;
          }
          if (prevRoundMatches[prevRoundMatchIndex2]) {
            match.previousMatch2Id = prevRoundMatches[prevRoundMatchIndex2].id;
          }
        }

        newMatches.push(match);
      }
    }

    onMatchUpdate([...matches, ...newMatches]);
    
    toast({
      title: "Bracket Generated!",
      description: `Tournament bracket created with ${newMatches.length} matches across ${rounds} rounds.`,
    });
  };

  const getRoundName = (round: number, totalRounds: number): string => {
    if (round === totalRounds) return "Final";
    if (round === totalRounds - 1) return "Semifinals";
    if (round === totalRounds - 2) return "Quarterfinals";
    return `Round ${round}`;
  };

  const getMatchProgress = () => {
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    const completed = tournamentMatches.filter(m => m.status === "completed").length;
    const total = tournamentMatches.length;
    return { completed, total };
  };

  const progress = getMatchProgress();

  if (format !== "matchplay") {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Bracket View</h3>
          <p className="text-muted-foreground">
            Bracket visualization is only available for Match Play tournaments.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Tournament Bracket
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Progress: {progress.completed}/{progress.total} matches completed
              </p>
            </div>
            {bracketData.length === 0 && (
              <Button onClick={generateInitialBracket}>
                Generate Bracket
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Bracket Display */}
      {bracketData.length > 0 ? (
        <ScrollArea className="w-full">
          <div className="flex gap-8 p-4 min-w-max">
            {bracketData.map((round, roundIndex) => (
              <div key={round.name} className="flex flex-col gap-4 min-w-80">
                <div className="text-center">
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    {round.name}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    {round.matches.filter(m => m.status === "completed").length}/{round.matches.length} completed
                  </p>
                </div>
                
                <div className="space-y-6">
                  {round.matches.map((match, matchIndex) => (
                    <div key={match.id} className="relative">
                      <MatchCard
                        match={match}
                        onEditMatch={(matchId) => {
                          const selectedMatch = matches.find(m => m.id === matchId);
                          setSelectedMatch(selectedMatch || null);
                        }}
                      />
                      
                      {/* Connection lines to next round */}
                      {roundIndex < bracketData.length - 1 && (
                        <div className="absolute top-1/2 -right-8 transform -translate-y-1/2">
                          <ChevronRight className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Bracket Generated</h3>
            <p className="text-muted-foreground mb-4">
              Generate a tournament bracket to visualize match progression and automatic winner advancement.
            </p>
            <Button onClick={generateInitialBracket} size="lg">
              Generate Tournament Bracket
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Match Dialog */}
      {selectedMatch && (
        <EditMatchDialog
          match={selectedMatch}
          onMatchUpdate={handleMatchUpdate}
          availablePlayers={players}
          trigger={<div />}
        />
      )}
    </div>
  );
}