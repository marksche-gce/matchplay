import { useState, useEffect } from "react";
import { Trophy, Award, Clock, Users, ChevronRight, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MatchCard } from "./MatchCard";
import { EditMatchDialog } from "./EditMatchDialog";
import { useToast } from "@/hooks/use-toast";
import { useBracketGeneration } from "@/hooks/useBracketGeneration";
import { supabase } from "@/integrations/supabase/client";

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
  onCreateMatch: (matchData: Omit<Match, "id">) => Promise<void>;
  format: "matchplay" | "strokeplay" | "scramble";
  maxPlayers: number;
}

export function TournamentBracket({ 
  tournamentId, 
  matches, 
  players, 
  onMatchUpdate,
  onCreateMatch,
  format,
  maxPlayers 
}: TournamentBracketProps) {
  const [bracketData, setBracketData] = useState<BracketRound[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const { toast } = useToast();
  const { generateTournamentBracket, fillFirstRoundMatches } = useBracketGeneration();

  // Only advance winners when brackets exist and matches change
  useEffect(() => {
    if (format === "matchplay") {
      // Always generate bracket structure from existing matches for display
      const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
      if (tournamentMatches.length > 0) {
        generateBracket(); // Show existing matches in bracket view
        advanceAllWinners();
      }
    }
  }, [matches]);

  const generateBracket = () => {
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    console.log("All tournament matches:", tournamentMatches);
    
    // Group existing matches by round
    const roundsMap = new Map<string, Match[]>();
    tournamentMatches.forEach(match => {
      const roundName = match.round;
      if (!roundsMap.has(roundName)) {
        roundsMap.set(roundName, []);
      }
      roundsMap.get(roundName)!.push(match);
    });

    // Create bracket structure with proper ordering - always show all rounds with expected matches
    const rounds: BracketRound[] = [];
    const totalRounds = Math.ceil(Math.log2(maxPlayers));
    
    // Generate all round names based on tournament size
    const roundNames: string[] = [];
    for (let i = 1; i <= totalRounds; i++) {
      if (i === totalRounds) roundNames.push("Final");
      else if (i === totalRounds - 1) roundNames.push("Semifinals");
      else if (i === totalRounds - 2) roundNames.push("Quarterfinals");
      else roundNames.push(`Round ${i}`);
    }
    
    // Create all rounds with expected number of matches
    roundNames.forEach((roundName, index) => {
      const existingMatches = roundsMap.get(roundName) || [];
      const expectedMatches = Math.pow(2, Math.max(0, totalRounds - (index + 1)));
      const allMatches: Match[] = [];
      
      // Add existing matches
      allMatches.push(...existingMatches);
      
      // Fill remaining slots with placeholder matches that show source connections
      const remainingSlots = Math.max(0, expectedMatches - existingMatches.length);
      for (let i = 0; i < remainingSlots; i++) {
        const matchIndex = existingMatches.length + i;
        const placeholderMatch: Match = {
          id: `placeholder-${roundName}-${i}`,
          tournamentId: tournamentId,
          type: "singles" as const,
          round: roundName,
          status: "scheduled" as const,
          date: new Date().toISOString().split('T')[0],
          time: "TBD"
        };

        // Set up connections to previous matches for non-first rounds
        if (index > 0) {
          const prevRoundName = roundNames[index - 1];
          const prevRoundMatches = roundsMap.get(prevRoundName) || [];
          const prevRoundMatchIndex1 = matchIndex * 2;
          const prevRoundMatchIndex2 = matchIndex * 2 + 1;
          
          // Look for existing matches or create placeholder references
          if (prevRoundMatchIndex1 < prevRoundMatches.length) {
            placeholderMatch.previousMatch1Id = prevRoundMatches[prevRoundMatchIndex1].id;
          } else {
            placeholderMatch.previousMatch1Id = `placeholder-${prevRoundName}-${prevRoundMatchIndex1 - prevRoundMatches.length}`;
          }
          
          if (prevRoundMatchIndex2 < prevRoundMatches.length) {
            placeholderMatch.previousMatch2Id = prevRoundMatches[prevRoundMatchIndex2].id;
          } else {
            placeholderMatch.previousMatch2Id = `placeholder-${prevRoundName}-${prevRoundMatchIndex2 - prevRoundMatches.length}`;
          }
        }

        allMatches.push(placeholderMatch);
      }
      
      rounds.push({
        name: roundName,
        matches: allMatches,
        roundNumber: index + 1
      });
    });

    setBracketData(rounds);
  };

  const progressWinnerImmediately = (currentMatches: Match[], completedMatch: Match): Match[] => {
    if (!completedMatch.winner || completedMatch.status !== "completed") {
      return currentMatches;
    }

    console.log("Processing winner advancement for:", completedMatch.winner, "from match:", completedMatch.id);

    // Use bracket structure to find next match
    const tournamentMatches = currentMatches.filter(m => m.tournamentId === completedMatch.tournamentId);
    const roundsMap = new Map<string, Match[]>();
    tournamentMatches.forEach(match => {
      const roundName = match.round;
      if (!roundsMap.has(roundName)) {
        roundsMap.set(roundName, []);
      }
      roundsMap.get(roundName)!.push(match);
    });

    // Find current round and match position
    const currentRoundMatches = roundsMap.get(completedMatch.round) || [];
    const currentMatchIndex = currentRoundMatches.findIndex(m => m.id === completedMatch.id);
    
    if (currentMatchIndex === -1) {
      console.log("Current match not found in round");
      return currentMatches;
    }

    // Determine next round using the same logic as bracket generation
    const totalRounds = Math.ceil(Math.log2(maxPlayers));
    const roundNames: string[] = [];
    for (let i = 1; i <= totalRounds; i++) {
      if (i === totalRounds) roundNames.push("Final");
      else if (i === totalRounds - 1) roundNames.push("Semifinals");
      else if (i === totalRounds - 2) roundNames.push("Quarterfinals");
      else roundNames.push(`Round ${i}`);
    }
    
    const currentRoundIndex = roundNames.indexOf(completedMatch.round);
    if (currentRoundIndex === -1 || currentRoundIndex === roundNames.length - 1) {
      console.log("No next round available");
      return currentMatches; // No next round or already final
    }

    const nextRoundName = roundNames[currentRoundIndex + 1];
    const nextRoundMatches = roundsMap.get(nextRoundName) || [];
    
    console.log("Current round:", completedMatch.round, "index:", currentRoundIndex);
    console.log("Next round name:", nextRoundName);
    console.log("Next round matches:", nextRoundMatches.length);
    console.log("Available rounds:", Array.from(roundsMap.keys()));
    
    // Calculate which match in the next round this winner should advance to
    const nextMatchIndex = Math.floor(currentMatchIndex / 2);
    const nextMatch = nextRoundMatches[nextMatchIndex];

    console.log("Next match index:", nextMatchIndex, "Next match found:", nextMatch?.id, "for winner:", completedMatch.winner);

    if (nextMatch) {
      // Find the winner player from the completed match participants
      const winnerPlayer = completedMatch.winner === completedMatch.player1?.name ? completedMatch.player1 : completedMatch.player2;
      
      if (!winnerPlayer) {
        console.log("Winner player not found in completed match");
        return currentMatches;
      }

      console.log("Advancing winner to position:", currentMatchIndex % 2 === 0 ? 1 : 2);

      const updatedMatches = currentMatches.map(match => {
        if (match.id === nextMatch.id) {
          const updatedMatch = { ...match };
          
          // Add winner to correct position (even index -> player1, odd index -> player2)
          if (currentMatchIndex % 2 === 0) {
            updatedMatch.player1 = { ...winnerPlayer, score: undefined };
          } else {
            updatedMatch.player2 = { ...winnerPlayer, score: undefined };
          }
          
          return updatedMatch;
        }
        return match;
      });
      
      // Update database if this is a real match (not placeholder)
      const isRealMatch = !/^placeholder-/.test(nextMatch.id);
      if (isRealMatch) {
        const position = currentMatchIndex % 2 === 0 ? 1 : 2;
        const winnerDbPlayer = players.find(p => p.name === winnerPlayer.name);
        
        if (winnerDbPlayer) {
          console.log("Adding winner to database match:", nextMatch.id, "position:", position);
          // Add participant to next match in database
          supabase
            .from('match_participants')
            .insert({
              match_id: nextMatch.id,
              player_id: winnerDbPlayer.id,
              position: position,
              team_number: null,
              score: null
            })
            .then(({ error }) => {
              if (error && !error.message.includes('duplicate')) {
                console.error('Error adding participant to next match:', error);
              } else {
                console.log("Winner successfully added to database");
              }
            });
        }
      }
      
      toast({
        title: "Winner Advanced!",
        description: `${completedMatch.winner} has been advanced to the next round.`,
      });
      
      return updatedMatches;
    }

    console.log("No next match found");
    return currentMatches;
  };

  const advanceAllWinners = () => {
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    const completedMatches = tournamentMatches.filter(m => m.status === "completed" && m.winner);
    
    if (completedMatches.length === 0) return;

    let updatedMatches = [...matches];
    let hasChanges = false;

    // Process all completed matches to advance winners
    completedMatches.forEach(completedMatch => {
      const previousMatches = updatedMatches;
      const advancedMatches = progressWinnerImmediately(previousMatches, completedMatch);
      
      if (advancedMatches !== previousMatches) {
        updatedMatches = advancedMatches;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onMatchUpdate(updatedMatches);
    }
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

  const handleMatchUpdate = (matchId: string, updates: Partial<Match>) => {
    // Check if this is a generated match (non-UUID ID) - these shouldn't be persisted to database
    const isGeneratedMatch = !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId);
    
    if (isGeneratedMatch) {
      toast({
        title: "Create Database Matches First",
        description: "Click 'Create Database Matches' to save the bracket before editing matches.",
        variant: "destructive"
      });
      return;
    }

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
        }
        
        return updatedMatch;
      }
      return match;
    });

    // Progress winner immediately after updating matches
    let finalMatches = updatedMatches;
    const completedMatch = updatedMatches.find(m => m.id === matchId);
    
    if (completedMatch?.status === "completed" && completedMatch.winner) {
      finalMatches = progressWinnerImmediately(updatedMatches, completedMatch);
    }

    onMatchUpdate(finalMatches);
  };

  const deleteAllMatches = () => {
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    const remainingMatches = matches.filter(m => m.tournamentId !== tournamentId);
    
    onMatchUpdate(remainingMatches);
    setBracketData([]);
    
    toast({
      title: "All Matches Deleted",
      description: `${tournamentMatches.length} matches have been deleted from the tournament.`,
      variant: "destructive"
    });
  };

  const generateInitialBracket = () => {
    const newMatches = generateTournamentBracket(tournamentId, players, maxPlayers);
    onMatchUpdate([...matches, ...newMatches]);
  };

  const createDatabaseMatches = async () => {
    if (!bracketData.length) {
      toast({
        title: "No Bracket Generated",
        description: "Generate a bracket first before creating database matches.",
        variant: "destructive"
      });
      return;
    }

    try {
      let createdCount = 0;
      const matchIdMap = new Map<string, string>(); // Map from temp ID to real UUID
      
      // First pass: Create all matches without relationships
      const allMatches = [];
      for (const round of bracketData) {
        for (const match of round.matches) {
          // Only create matches that have at least one player
          if (match.player1) {
            const matchData = {
              tournament_id: tournamentId,
              type: "singles",
              round: match.round,
              status: match.status,
              match_date: null,
              match_time: null,
              tee: null,
              winner_id: null,
              next_match_id: null,
              previous_match_1_id: null,
              previous_match_2_id: null
            };
            allMatches.push({ tempId: match.id, matchData, originalMatch: match });
          }
        }
      }

      // Create all matches in database first
      const { data: createdMatches, error: createError } = await supabase
        .from('matches')
        .insert(allMatches.map(m => m.matchData))
        .select('id');

      if (createError) throw createError;

      // Map temp IDs to real UUIDs
      createdMatches.forEach((dbMatch, index) => {
        matchIdMap.set(allMatches[index].tempId, dbMatch.id);
      });

      // Second pass: Update relationships
      const relationshipUpdates = [];
      for (const round of bracketData) {
        for (const match of round.matches) {
          if (match.player1) {
            const realMatchId = matchIdMap.get(match.id);
            if (realMatchId) {
              const updates: any = {};
              
              if (match.nextMatchId) {
                const nextRealId = matchIdMap.get(match.nextMatchId);
                if (nextRealId) updates.next_match_id = nextRealId;
              }
              
              if (match.previousMatch1Id) {
                const prev1RealId = matchIdMap.get(match.previousMatch1Id);
                if (prev1RealId) updates.previous_match_1_id = prev1RealId;
              }
              
              if (match.previousMatch2Id) {
                const prev2RealId = matchIdMap.get(match.previousMatch2Id);
                if (prev2RealId) updates.previous_match_2_id = prev2RealId;
              }
              
              if (Object.keys(updates).length > 0) {
                relationshipUpdates.push({ id: realMatchId, updates });
              }
            }
          }
        }
      }

      // Update relationships in database
      for (const { id, updates } of relationshipUpdates) {
        const { error: updateError } = await supabase
          .from('matches')
          .update(updates)
          .eq('id', id);
        
        if (updateError) throw updateError;
      }

      // Create match participants
      for (let i = 0; i < allMatches.length; i++) {
        const dbMatchId = createdMatches[i].id;
        const originalMatch = allMatches[i].originalMatch;
        
        const participants = [];
        
        if (originalMatch.player1) {
          const player1 = players.find(p => p.name === originalMatch.player1.name);
          if (player1) {
            participants.push({
              match_id: dbMatchId,
              player_id: player1.id,
              position: 1,
              team_number: null,
              score: null
            });
          }
        }
        
        if (originalMatch.player2) {
          const player2 = players.find(p => p.name === originalMatch.player2.name);
          if (player2) {
            participants.push({
              match_id: dbMatchId,
              player_id: player2.id,
              position: 2,
              team_number: null,
              score: null
            });
          }
        }
        
        if (participants.length > 0) {
          const { error: participantsError } = await supabase
            .from('match_participants')
            .insert(participants);
          
          if (participantsError) throw participantsError;
        }
        
        createdCount++;
      }

      toast({
        title: "Database Matches Created!",
        description: `Successfully created ${createdCount} matches with bracket relationships.`,
      });

      // Refresh matches to show the created ones
      onMatchUpdate([...matches]);
    } catch (error) {
      console.error('Error creating database matches:', error);
      toast({
        title: "Error Creating Matches",
        description: "Failed to create matches in database. Please try again.",
        variant: "destructive"
      });
    }
  };

  const fillFirstRound = () => {
    console.log("fillFirstRound called");
    
    try {
      const updatedMatches = fillFirstRoundMatches(tournamentId, players, matches);
      onMatchUpdate(updatedMatches);
    } catch (error) {
      console.error("Error in fillFirstRound:", error);
      toast({
        title: "Error",
        description: "Failed to fill first round. Please try again.",
        variant: "destructive"
      });
    }
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
            <div className="flex items-center gap-2">
              {bracketData.length === 0 ? (
                <Button onClick={generateInitialBracket}>
                  Generate Bracket
                </Button>
              ) : (
                <>
                  <Button onClick={fillFirstRound} variant="outline" size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    Fill First Round
                  </Button>
                  
                  <Button onClick={createDatabaseMatches} variant="default" size="sm">
                    Create Database Matches
                  </Button>
                  
                  <Button onClick={() => setBracketData([])} variant="secondary" size="sm">
                    Clear Brackets
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All Matches
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete All Matches</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete all matches? This will permanently remove all match data and cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteAllMatches} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete All Matches
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
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
                        previousMatches={matches.filter(m => m.tournamentId === tournamentId)}
                        showScores={false}
                        onEditMatch={(matchId) => {
                          // Allow editing of all matches, including placeholder ones
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
          open={!!selectedMatch}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedMatch(null);
            }
          }}
          onMatchUpdate={(matchId, updates) => {
            handleMatchUpdate(matchId, updates);
            setSelectedMatch(null); // Close dialog after update
          }}
          availablePlayers={players}
        />
      )}
    </div>
  );
}