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
        processAutoAdvanceByes(); // Handle bye matches
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

    // Find winner in completed match
    const winnerPlayer = completedMatch.winner === completedMatch.player1?.name ? completedMatch.player1 : completedMatch.player2;
    if (!winnerPlayer) {
      console.log("Winner player not found in completed match");
      return currentMatches;
    }

    // Use bracket data structure to find next match
    let nextMatchFound = false;
    const updatedBracketData = bracketData.map(round => {
      const updatedMatches = round.matches.map(match => {
        // Check if this match should receive a winner from the completed match
        if (match.previousMatch1Id === completedMatch.id) {
          console.log("Adding winner to player1 position in match:", match.id);
          const updatedMatch = { ...match, player1: { ...winnerPlayer, score: undefined } };
          nextMatchFound = true;
          
          // Update bracket display
          return updatedMatch;
        } else if (match.previousMatch2Id === completedMatch.id) {
          console.log("Adding winner to player2 position in match:", match.id);
          const updatedMatch = { ...match, player2: { ...winnerPlayer, score: undefined } };
          nextMatchFound = true;
          
          // Update bracket display
          return updatedMatch;
        }
        return match;
      });
      
      return { ...round, matches: updatedMatches };
    });

    if (nextMatchFound) {
      console.log("Winner successfully advanced in bracket display");
      setBracketData(updatedBracketData);
      
      toast({
        title: "Winner Advanced!",
        description: `${completedMatch.winner} has been advanced to the next round.`,
      });
    } else {
      console.log("No next match found for winner advancement");
    }

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

  const processAutoAdvanceByes = async () => {
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    const byeMatches = tournamentMatches.filter(m => 
      m.status === "scheduled" && 
      m.player1 && 
      !m.player2 && // Only one player in the match
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.id) // Only real database matches
    );

    if (byeMatches.length === 0) return;

    console.log(`Processing ${byeMatches.length} bye matches`);

    let updatedMatches = [...matches];
    let hasChanges = false;

    for (const byeMatch of byeMatches) {
      console.log(`Auto-advancing ${byeMatch.player1?.name} from bye match ${byeMatch.id}`);
      
      try {
        // Complete the bye match with the single player as winner
        const completedByeMatch = {
          ...byeMatch,
          status: "completed" as const,
          winner: byeMatch.player1?.name
        };

        // Update match in database
        const winnerPlayer = players.find(p => p.name === byeMatch.player1?.name);
        if (winnerPlayer) {
          const { error: updateError } = await supabase
            .from('matches')
            .update({
              status: 'completed',
              winner_id: winnerPlayer.id
            })
            .eq('id', byeMatch.id);

          if (updateError) throw updateError;

          // Progress winner to next match in database
          await progressWinnerToDatabase(completedByeMatch, winnerPlayer);
        }

        // Update the match in the local array
        const matchIndex = updatedMatches.findIndex(m => m.id === byeMatch.id);
        if (matchIndex !== -1) {
          updatedMatches[matchIndex] = completedByeMatch;
          hasChanges = true;

          // Progress the winner immediately in UI
          updatedMatches = progressWinnerImmediately(updatedMatches, completedByeMatch);
        }

      } catch (error) {
        console.error(`Error processing bye match ${byeMatch.id}:`, error);
        // Continue with other bye matches even if one fails
      }
    }

    if (hasChanges) {
      onMatchUpdate(updatedMatches);
      
      toast({
        title: "Bye Matches Auto-Advanced",
        description: `${byeMatches.length} players with free passes have been advanced to the next round.`,
      });
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

  const progressWinnerToDatabase = async (completedMatch: Match, winnerPlayer: { id: string; name: string; handicap: number }) => {
    try {
      // Find the next match in the database based on bracket relationships
      const { data: nextMatches, error: nextMatchError } = await supabase
        .from('matches')
        .select('*')
        .or(`previous_match_1_id.eq.${completedMatch.id},previous_match_2_id.eq.${completedMatch.id}`);

      if (nextMatchError) throw nextMatchError;

      if (nextMatches && nextMatches.length > 0) {
        const nextMatch = nextMatches[0];
        
        // Determine which position the winner should be placed in
        const position = nextMatch.previous_match_1_id === completedMatch.id ? 1 : 2;
        
        // Check if participant already exists
        const { data: existingParticipant, error: checkError } = await supabase
          .from('match_participants')
          .select('*')
          .eq('match_id', nextMatch.id)
          .eq('position', position)
          .single();

        if (checkError && checkError.code !== 'PGRST116') { // Not found is okay
          throw checkError;
        }

        if (existingParticipant) {
          // Update existing participant
          const { error: updateError } = await supabase
            .from('match_participants')
            .update({
              player_id: winnerPlayer.id,
              score: null // Reset score for new match
            })
            .eq('id', existingParticipant.id);

          if (updateError) throw updateError;
        } else {
          // Create new participant
          const { error: insertError } = await supabase
            .from('match_participants')
            .insert({
              match_id: nextMatch.id,
              player_id: winnerPlayer.id,
              position: position,
              team_number: null,
              score: null
            });

          if (insertError) throw insertError;
        }

        console.log(`Winner ${winnerPlayer.name} advanced to next match in database`);
      }
    } catch (error) {
      console.error('Error progressing winner to database:', error);
      throw error;
    }
  };

  const handleMatchUpdate = async (matchId: string, updates: Partial<Match>) => {
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

    try {
      const originalMatch = matches.find(m => m.id === matchId);
      if (!originalMatch) return;

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

      const updatedMatch = updatedMatches.find(m => m.id === matchId);
      if (!updatedMatch) return;

      // Prepare database updates
      const dbUpdates: any = {
        status: updates.status,
        round: updates.round,
        match_date: updates.date || null,
        match_time: updates.time || null,
        tee: updates.tee || null,
        winner_id: null
      };

      // Update match in database
      const { error: matchError } = await supabase
        .from('matches')
        .update(dbUpdates)
        .eq('id', matchId);

      if (matchError) throw matchError;

      // Check if players actually changed (not just score updates)
      const playersChanged = 
        (originalMatch.player1?.name !== updatedMatch.player1?.name) ||
        (originalMatch.player2?.name !== updatedMatch.player2?.name);

      // Check if scores changed
      const scoresChanged = 
        (originalMatch.player1?.score !== updatedMatch.player1?.score) ||
        (originalMatch.player2?.score !== updatedMatch.player2?.score);

      // Update participants only if players changed or scores changed
      if (playersChanged || scoresChanged) {
        // Get current participants
        const { data: currentParticipants, error: fetchError } = await supabase
          .from('match_participants')
          .select('*')
          .eq('match_id', matchId);

        if (fetchError) throw fetchError;

        // Update or insert participants
        const participantUpdates = [];
        
        if (updatedMatch.player1) {
          const player1 = players.find(p => p.name === updatedMatch.player1?.name);
          if (player1) {
            const existingParticipant = currentParticipants?.find(p => p.position === 1);
            if (existingParticipant) {
              // Update existing participant
              participantUpdates.push(
                supabase
                  .from('match_participants')
                  .update({
                    player_id: player1.id,
                    score: updatedMatch.player1.score || null
                  })
                  .eq('id', existingParticipant.id)
              );
            } else {
              // Insert new participant
              participantUpdates.push(
                supabase
                  .from('match_participants')
                  .insert({
                    match_id: matchId,
                    player_id: player1.id,
                    position: 1,
                    team_number: null,
                    score: updatedMatch.player1.score || null
                  })
              );
            }
          }
        }
        
        if (updatedMatch.player2) {
          const player2 = players.find(p => p.name === updatedMatch.player2?.name);
          if (player2) {
            const existingParticipant = currentParticipants?.find(p => p.position === 2);
            if (existingParticipant) {
              // Update existing participant
              participantUpdates.push(
                supabase
                  .from('match_participants')
                  .update({
                    player_id: player2.id,
                    score: updatedMatch.player2.score || null
                  })
                  .eq('id', existingParticipant.id)
              );
            } else {
              // Insert new participant
              participantUpdates.push(
                supabase
                  .from('match_participants')
                  .insert({
                    match_id: matchId,
                    player_id: player2.id,
                    position: 2,
                    team_number: null,
                    score: updatedMatch.player2.score || null
                  })
              );
            }
          }
        }

        // Execute all participant updates
        for (const updatePromise of participantUpdates) {
          const { error: participantError } = await updatePromise;
          if (participantError) throw participantError;
        }
      }

      // Handle winner progression
      if (updatedMatch.status === "completed" && updatedMatch.winner) {
        // Find winner player
        const winnerPlayer = players.find(p => p.name === updatedMatch.winner);
        if (winnerPlayer) {
          // Update winner_id in database
          const { error: winnerError } = await supabase
            .from('matches')
            .update({ winner_id: winnerPlayer.id })
            .eq('id', matchId);

          if (winnerError) throw winnerError;

          // Progress winner to next match
          await progressWinnerToDatabase(updatedMatch, winnerPlayer);
        }
      }

      // Update local state
      let finalMatches = updatedMatches;
      if (updatedMatch.status === "completed" && updatedMatch.winner) {
        finalMatches = progressWinnerImmediately(updatedMatches, updatedMatch);
      }

      onMatchUpdate(finalMatches);

      toast({
        title: "Match Updated!",
        description: "Match has been successfully saved to the database.",
      });

    } catch (error) {
      console.error('Error updating match:', error);
      toast({
        title: "Error Updating Match",
        description: "Failed to save changes to database. Please try again.",
        variant: "destructive"
      });
    }
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
                          console.log("Edit match clicked for ID:", matchId);
                          // Allow editing of all matches, including placeholder ones
                          const selectedMatch = matches.find(m => m.id === matchId);
                          console.log("Selected match found:", selectedMatch);
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
            console.log("Dialog onOpenChange called with:", open);
            if (!open) {
              console.log("Closing dialog, clearing selectedMatch");
              setSelectedMatch(null);
            }
          }}
          onMatchUpdate={(matchId, updates) => {
            console.log("Dialog onMatchUpdate called for match:", matchId);
            handleMatchUpdate(matchId, updates);
            setSelectedMatch(null); // Close dialog after update
          }}
          availablePlayers={players}
        />
      )}
    </div>
  );
}