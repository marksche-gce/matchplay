import { useState, useEffect } from "react";
import { Trophy, Award, Clock, Users, ChevronRight, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { EditMatchDialog } from "./EditMatchDialog";
import { ManualMatchSetup } from "./ManualMatchSetup";
import { useToast } from "@/hooks/use-toast";
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
  const [showManualSetup, setShowManualSetup] = useState(true);
  const { toast } = useToast();

  // Function to get available players for a specific match (excluding already assigned players)
  const getAvailablePlayersForMatch = (matchId: string) => {
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    const currentMatch = tournamentMatches.find(m => m.id === matchId);
    
    console.log("=== BRACKET PLAYER FILTERING DEBUG ===");
    console.log("Match ID being edited:", matchId);
    console.log("Tournament ID:", tournamentId);
    console.log("All matches for tournament:", tournamentMatches.length);
    console.log("Tournament matches:", tournamentMatches.map(m => ({ id: m.id, player1: m.player1?.name, player2: m.player2?.name })));
    
    // Get all assigned player names across all matches except the current one
    const assignedPlayerNames = new Set<string>();
    tournamentMatches.forEach(match => {
      if (match.id !== matchId) { // Exclude current match
        console.log(`Checking match ${match.id} (excluding current ${matchId})`);
        if (match.player1?.name) {
          assignedPlayerNames.add(match.player1.name);
          console.log(`Added player1: ${match.player1.name}`);
        }
        if (match.player2?.name) {
          assignedPlayerNames.add(match.player2.name);
          console.log(`Added player2: ${match.player2.name}`);
        }
      }
    });
    
    console.log("Assigned player names:", Array.from(assignedPlayerNames));
    console.log("Total players available:", players.length);
    
    // Return players not assigned to other matches
    const availablePlayers = players.filter(player => !assignedPlayerNames.has(player.name));
    console.log("Available players after filtering:", availablePlayers.map(p => p.name));
    console.log("=== END BRACKET DEBUG ===");
    
    return availablePlayers;
  };

  // Generate bracket structure on component mount and when players change
  useEffect(() => {
    console.log("=== BRACKET EFFECT DEBUG ===");
    console.log("Effect triggered - matches changed:", matches.length);
    console.log("Tournament ID:", tournamentId);
    console.log("Format:", format);
    
    if (format === "matchplay") {
      generateBracket();
      
      const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
      const databaseMatches = tournamentMatches.filter(m => 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.id)
      );
      
      console.log("Database matches found:", databaseMatches.length);
      console.log("Completed matches:", databaseMatches.filter(m => m.status === "completed").length);
      
      if (databaseMatches.length > 0) {
        setShowManualSetup(false);
        console.log("Calling advanceAllWinners...");
        advanceAllWinners();
        console.log("Calling processAutoAdvanceByes...");
        processAutoAdvanceByes();
      } else {
        setShowManualSetup(true);
      }
    }
    console.log("=== BRACKET EFFECT COMPLETE ===");
  }, [matches, players, maxPlayers]);

  const generateBracket = () => {
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    console.log("All tournament matches:", tournamentMatches);
    
    // Separate database matches (UUIDs) from generated matches (non-UUIDs)
    const databaseMatches = tournamentMatches.filter(m => 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.id)
    );
    const generatedMatches = tournamentMatches.filter(m => 
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.id)
    );
    
    console.log("Database matches found:", databaseMatches.length);
    console.log("Generated matches found:", generatedMatches.length);
    
    // Use database matches if they exist, otherwise use generated matches
    const matchesToUse = databaseMatches.length > 0 ? databaseMatches : generatedMatches;
    console.log("Using matches:", databaseMatches.length > 0 ? "database" : "generated", "count:", matchesToUse.length);
    
    // Group existing matches by round
    const roundsMap = new Map<string, Match[]>();
    matchesToUse.forEach(match => {
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
    console.log("Completed match player1:", completedMatch.player1);
    console.log("Completed match player2:", completedMatch.player2);

    // Find winner in completed match - handle both real players and "no opponent" scenarios
    let winnerPlayer;
    
    // First check if winner matches player1
    if (completedMatch.player1?.name === completedMatch.winner) {
      winnerPlayer = completedMatch.player1;
    }
    // Then check if winner matches player2
    else if (completedMatch.player2?.name === completedMatch.winner) {
      winnerPlayer = completedMatch.player2;
    }
    // If winner is a real player name but not found in participants, 
    // this happens in "no opponent" scenarios where only the real player was saved
    else if (completedMatch.winner && !completedMatch.winner.startsWith("no-opponent")) {
      // Find the real player and use them as winner
      const realPlayer = players.find(p => p.name === completedMatch.winner);
      if (realPlayer) {
        winnerPlayer = {
          name: realPlayer.name,
          handicap: realPlayer.handicap,
          score: undefined
        };
        console.log("Winner found in players list for no-opponent scenario:", winnerPlayer);
      }
    }
    
    if (!winnerPlayer) {
      console.log("Winner player not found in completed match or players list");
      console.log("Looking for winner:", completedMatch.winner);
      console.log("Available players:", players.map(p => p.name));
      return currentMatches;
    }
    
    console.log("Winner player identified:", winnerPlayer);

    // Update both matches array and bracket display
    let updatedMatches = [...currentMatches];
    let nextMatchFound = false;
    
    const updatedBracketData = bracketData.map(round => {
      const updatedRoundMatches = round.matches.map(match => {
        // Check if this match should receive a winner from the completed match
        if (match.previousMatch1Id === completedMatch.id) {
          console.log("Adding winner to player1 position in match:", match.id);
          const updatedMatch = { ...match, player1: { ...winnerPlayer, score: undefined } };
          nextMatchFound = true;
          
          // Update both bracket display and matches array
          const matchIndex = updatedMatches.findIndex(m => m.id === match.id);
          if (matchIndex !== -1) {
            updatedMatches[matchIndex] = updatedMatch;
          }
          
          // Also update database if this is a real match
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match.id)) {
            const winnerPlayerData = players.find(p => p.name === winnerPlayer.name);
            if (winnerPlayerData) {
              console.log("Advancing winner to database for next match:", match.id);
              progressWinnerToDatabase(completedMatch, winnerPlayerData).catch(error => {
                console.error("Failed to advance winner in database:", error);
              });
            }
          }
          
          return updatedMatch;
        } else if (match.previousMatch2Id === completedMatch.id) {
          console.log("Adding winner to player2 position in match:", match.id);
          const updatedMatch = { ...match, player2: { ...winnerPlayer, score: undefined } };
          nextMatchFound = true;
          
          // Update both bracket display and matches array
          const matchIndex = updatedMatches.findIndex(m => m.id === match.id);
          if (matchIndex !== -1) {
            updatedMatches[matchIndex] = updatedMatch;
          }
          
          // Also update database if this is a real match
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match.id)) {
            const winnerPlayerData = players.find(p => p.name === winnerPlayer.name);
            if (winnerPlayerData) {
              console.log("Advancing winner to database for next match:", match.id);
              progressWinnerToDatabase(completedMatch, winnerPlayerData).catch(error => {
                console.error("Failed to advance winner in database:", error);
              });
            }
          }
          
          return updatedMatch;
        }
        return match;
      });
      
      return { ...round, matches: updatedRoundMatches };
    });

    if (nextMatchFound) {
      console.log("Winner successfully advanced in bracket display and matches array");
      setBracketData(updatedBracketData);
      
      toast({
        title: "Winner Advanced!",
        description: `${completedMatch.winner} has been advanced to the next round.`,
      });
      
      return updatedMatches;
    } else {
      console.log("No next match found for winner advancement");
    }

    return currentMatches;
  };

  const advanceAllWinners = () => {
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    const completedMatches = tournamentMatches.filter(m => m.status === "completed" && m.winner);
    
    console.log("advanceAllWinners called with", completedMatches.length, "completed matches");
    completedMatches.forEach(match => {
      console.log("Processing completed match:", match.id, "winner:", match.winner);
    });
    
    if (completedMatches.length === 0) return;

    let updatedMatches = [...matches];
    let hasChanges = false;

    // Process all completed matches to advance winners
    completedMatches.forEach(completedMatch => {
      console.log("Processing winner advancement for match:", completedMatch.id, "winner:", completedMatch.winner);
      const previousMatches = updatedMatches;
      const advancedMatches = progressWinnerImmediately(previousMatches, completedMatch);
      
      if (advancedMatches !== previousMatches) {
        console.log("Changes detected after winner advancement");
        updatedMatches = advancedMatches;
        hasChanges = true;
      } else {
        console.log("No changes after winner advancement attempt");
      }
    });

    if (hasChanges) {
      console.log("Calling onMatchUpdate with", updatedMatches.length, "updated matches");
      onMatchUpdate(updatedMatches);
    } else {
      console.log("No changes to report to parent component");
    }
  };

  const processAutoAdvanceByes = async () => {
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    
    // Find bye matches: either no player2 OR player2 is a "no-opponent" placeholder
    const byeMatches = tournamentMatches.filter(m => 
      m.status === "scheduled" && 
      m.player1 && 
      (!m.player2 || m.player2.name?.startsWith("no-opponent")) && // No player2 OR "no-opponent" placeholder
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
    console.log("=== BRACKET MATCH UPDATE DEBUG ===");
    console.log("handleMatchUpdate called for match ID:", matchId, "updates:", updates);
    console.log("Original match data:", matches.find(m => m.id === matchId));
    
    // Check if this is a generated match (non-UUID ID)
    const isGeneratedMatch = !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId);
    
    console.log("Is generated match:", isGeneratedMatch, "Match ID:", matchId);
    
    if (isGeneratedMatch) {
      console.log("Converting placeholder match to database match");
      
      // Find the placeholder match in bracketData
      let placeholderMatch: Match | null = null;
      for (const round of bracketData) {
        const foundMatch = round.matches.find(m => m.id === matchId);
        if (foundMatch) {
          placeholderMatch = foundMatch;
          break;
        }
      }
      
      if (!placeholderMatch) {
        toast({
          title: "Error",
          description: "Could not find placeholder match data.",
          variant: "destructive"
        });
        return;
      }
      
      try {
        // Create a new database match from the placeholder
        const matchData = {
          tournament_id: tournamentId,
          type: "singles",
          round: updates.round || placeholderMatch.round,
          status: updates.status || placeholderMatch.status,
          match_date: null,
          match_time: null,
          tee: null,
          winner_id: null,
          next_match_id: null,
          previous_match_1_id: null,
          previous_match_2_id: null
        };

        const { data: createdMatch, error: createError } = await supabase
          .from('matches')
          .insert([matchData])
          .select('id')
          .single();

        if (createError) throw createError;

        const newMatchId = createdMatch.id;
        console.log("Created new database match with ID:", newMatchId);

        // Now insert match participants
        const participants = [];
        if (updates.player1) {
          if (updates.player1.name && !updates.player1.name.startsWith("no-opponent") && !updates.player1.name.startsWith("no-player")) {
            const player1Data = players.find(p => p.name === updates.player1.name);
            if (player1Data) {
              participants.push({
                match_id: newMatchId,
                player_id: player1Data.id,
                position: 1,
                score: updates.player1.score
              });
            }
          }
        }
        if (updates.player2) {
          if (updates.player2.name && !updates.player2.name.startsWith("no-opponent") && !updates.player2.name.startsWith("no-player")) {
            const player2Data = players.find(p => p.name === updates.player2.name);
            if (player2Data) {
              participants.push({
                match_id: newMatchId,
                player_id: player2Data.id,
                position: 2,
                score: updates.player2.score
              });
            }
          }
        }

        if (participants.length > 0) {
          const { error: participantError } = await supabase
            .from('match_participants')
            .insert(participants);

          if (participantError) throw participantError;
        }

        // Create the new database match object
        const databaseMatch: Match = {
          id: newMatchId,
          tournamentId: tournamentId,
          type: "singles",
          round: updates.round || placeholderMatch.round,
          status: updates.status || placeholderMatch.status,
          date: placeholderMatch.date,
          time: placeholderMatch.time,
          tee: placeholderMatch.tee,
          winner: updates.winner,
          player1: updates.player1,
          player2: updates.player2,
          nextMatchId: placeholderMatch.nextMatchId,
          previousMatch1Id: placeholderMatch.previousMatch1Id,
          previousMatch2Id: placeholderMatch.previousMatch2Id
        };

        // Replace placeholder match with database match in the matches array
        const updatedMatches = matches.map(m => m.id === matchId ? databaseMatch : m).concat(
          matches.some(m => m.id === matchId) ? [] : [databaseMatch]
        );

        // Update bracket display immediately
        setBracketData(prevBracketData => {
          return prevBracketData.map(round => ({
            ...round,
            matches: round.matches.map(m => {
              if (m.id === matchId) {
                return databaseMatch;
              }
              return m;
            })
          }));
        });

        toast({
          title: "Match Created & Updated!",
          description: "Placeholder match converted to database match successfully.",
        });

        // Update parent component with the updated matches
        onMatchUpdate(updatedMatches);
        
        return;

      } catch (error) {
        console.error('Error converting placeholder to database match:', error);
        toast({
          title: "Error",
          description: "Failed to create database match from placeholder.",
          variant: "destructive"
        });
        return;
      }
    }

    // Handle database match updates
    console.log("Updating database match");
    
    try {
      // Update match details in database
      const matchUpdates: any = {
        round: updates.round,
        status: updates.status
      };

      // Set winner_id based on winner name if provided
      if (updates.winner) {
        const winnerPlayer = players.find(p => p.name === updates.winner);
        if (winnerPlayer) {
          matchUpdates.winner_id = winnerPlayer.id;
        }
      }

      // Set date and time if provided
      if (updates.date) matchUpdates.match_date = updates.date;
      if (updates.time && updates.time !== "TBD") matchUpdates.match_time = updates.time;
      if (updates.tee) matchUpdates.tee = updates.tee;

      console.log("Updating match in database with:", matchUpdates);

      const { error: matchError } = await supabase
        .from('matches')
        .update(matchUpdates)
        .eq('id', matchId);

      if (matchError) {
        console.error("Match update error:", matchError);
        throw matchError;
      }

      // Handle player and score updates
      if (updates.player1 || updates.player2) {
        console.log("Updating player assignments");
        
        // Delete existing participants for this match
        console.log("Deleting existing participants for match:", matchId);
        const { error: deleteError } = await supabase
          .from('match_participants')
          .delete()
          .eq('match_id', matchId);

        if (deleteError) {
          console.error("Error deleting existing participants:", deleteError);
          throw deleteError;
        }

        // Wait longer and verify deletion completed
        console.log("Waiting for deletion to complete...");
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Verify deletion completed by checking if any participants still exist
        const { data: remainingParticipants, error: checkError } = await supabase
          .from('match_participants')
          .select('id')
          .eq('match_id', matchId);
          
        if (checkError) {
          console.error("Error checking remaining participants:", checkError);
          throw checkError;
        }
        
        if (remainingParticipants && remainingParticipants.length > 0) {
          console.log("Still have", remainingParticipants.length, "participants, waiting longer...");
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log("Deletion verified complete, proceeding with insert...");

        // Insert new participants
        console.log("Preparing to insert participants...");
        const participants = [];
        if (updates.player1) {
          // Handle "no opponent" cases - don't try to find player data for these
          if (updates.player1.name && !updates.player1.name.startsWith("no-opponent") && !updates.player1.name.startsWith("no-player")) {
            const player1Data = players.find(p => p.name === updates.player1?.name);
            if (player1Data) {
              console.log("Adding player1 participant:", player1Data.name, "ID:", player1Data.id);
              participants.push({
                match_id: matchId,
                player_id: player1Data.id,
                position: 1,
                score: updates.player1.score
              });
            } else {
              console.log("Could not find player1 data for:", updates.player1.name);
            }
          } else {
            console.log("Skipping database insert for no-opponent player1:", updates.player1.name);
          }
        }
        if (updates.player2) {
          // Handle "no opponent" cases - don't try to find player data for these
          if (updates.player2.name && !updates.player2.name.startsWith("no-opponent") && !updates.player2.name.startsWith("no-player")) {
            const player2Data = players.find(p => p.name === updates.player2?.name);
            if (player2Data) {
              console.log("Adding player2 participant:", player2Data.name, "ID:", player2Data.id);
              participants.push({
                match_id: matchId,
                player_id: player2Data.id,
                position: 2,
                score: updates.player2.score
              });
            } else {
              console.log("Could not find player2 data for:", updates.player2.name);
            }
          } else {
            console.log("Skipping database insert for no-opponent player2:", updates.player2.name);
          }
        }

        console.log("Final participants array:", participants);
        if (participants.length > 0) {
          console.log("Inserting", participants.length, "participants into database...");
          const { error: participantError } = await supabase
            .from('match_participants')
            .insert(participants);

          if (participantError) {
            console.error("Participant insert error:", participantError);
            throw participantError;
          }
          console.log("Successfully inserted all participants");
        } else {
          console.log("No participants to insert (all were no-opponent entries)");
        }
      }

      // Update the match in local state with the changes
      const updatedMatches = matches.map(match => {
        if (match.id === matchId) {
          const updatedMatch = { ...match, ...updates };
          return updatedMatch;
        }
        return match;
      });

      // Immediately update bracket display with the changes
      setBracketData(prevBracketData => {
        return prevBracketData.map(round => ({
          ...round,
          matches: round.matches.map(match => {
            if (match.id === matchId) {
              return { ...match, ...updates };
            }
            return match;
          })
        }));
      });

      // Check if match was completed and progress winner
      const completedMatch = updatedMatches.find(m => m.id === matchId);
      let finalMatches = updatedMatches;
      
      if (completedMatch?.status === "completed" && completedMatch.winner) {
        console.log("Processing winner progression for completed match");
        finalMatches = progressWinnerImmediately(updatedMatches, completedMatch);
        
        // Also progress winner in database
        const winnerPlayer = players.find(p => p.name === completedMatch.winner);
        if (winnerPlayer) {
          await progressWinnerToDatabase(completedMatch, winnerPlayer);
        }
      }

      toast({
        title: "Match Updated!",
        description: "Match has been saved to database successfully.",
      });

      // Update parent component with the updated matches
      onMatchUpdate(finalMatches);
      
      // Immediately update the bracket display to reflect changes
      setTimeout(() => {
        generateBracket();
      }, 100);

    } catch (error) {
      console.error('Error updating database match:', error);
      toast({
        title: "Error",
        description: "Failed to update match in database.",
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
          </div>
        </CardHeader>
      </Card>

      {/* Bracket Display - Always show bracket structure */}
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
                    <Card 
                      className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/20"
                      onClick={() => {
                        console.log("Match clicked for edit:", match.id);
                        let selectedMatch = matches.find(m => m.id === match.id);
                        
                        // If not found, look in bracketData (for placeholder matches)
                        if (!selectedMatch) {
                          for (const round of bracketData) {
                            const foundMatch = round.matches.find(m => m.id === match.id);
                            if (foundMatch) {
                              selectedMatch = foundMatch;
                              break;
                            }
                          }
                        }
                        
                        setSelectedMatch(selectedMatch || null);
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Match Status */}
                          <div className="flex items-center justify-between">
                            <Badge 
                              variant={match.status === "completed" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {match.status === "completed" ? "Completed" : "Scheduled"}
                            </Badge>
                            {match.winner && (
                              <Trophy className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          
                          {/* Players */}
                          <div className="space-y-2">
                            <div className={`p-2 rounded border ${match.winner === match.player1?.name ? 'bg-primary/10 border-primary' : 'bg-muted/50'}`}>
                              <div className="text-sm font-medium">
                                {match.player1?.name || "TBD"}
                              </div>
                              {match.player1?.handicap !== undefined && (
                                <div className="text-xs text-muted-foreground">
                                  HC: {match.player1.handicap}
                                </div>
                              )}
                            </div>
                            
                            <div className="text-center text-xs text-muted-foreground">vs</div>
                            
                            <div className={`p-2 rounded border ${match.winner === match.player2?.name ? 'bg-primary/10 border-primary' : 'bg-muted/50'}`}>
                              <div className="text-sm font-medium">
                                {match.player2?.name || (match.player1?.name && !match.player2 ? "No Opponent" : "TBD")}
                              </div>
                              {match.player2?.handicap !== undefined && (
                                <div className="text-xs text-muted-foreground">
                                  HC: {match.player2.handicap}
                                </div>
                              )}
                              {match.player1?.name && !match.player2 && (
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
            console.log("=== BRACKET DIALOG UPDATE ===");
            console.log("Dialog onMatchUpdate called for match:", matchId);
            console.log("Updates received:", updates);
            console.log("Original match data:", selectedMatch);
            console.log("Available players for filtering:", getAvailablePlayersForMatch(selectedMatch.id));
            handleMatchUpdate(matchId, updates);
            setSelectedMatch(null); // Close dialog after update
          }}
          availablePlayers={getAvailablePlayersForMatch(selectedMatch.id)}
          allPlayers={players}
          maxPlayers={maxPlayers}
          registeredPlayers={players.length}
        />
      )}
    </div>
  );
}