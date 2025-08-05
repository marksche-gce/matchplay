import { useState, useEffect } from "react";
import { Trophy, Award, Clock, Users, ChevronRight, Trash2, RefreshCw } from "lucide-react";
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
  const [isAdvancingWinners, setIsAdvancingWinners] = useState(false); // Prevent multiple simultaneous executions
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
        
        // Ensure bracket relationships are set up before processing winners
        // But only if we're not already advancing winners to prevent loops
        if (!isAdvancingWinners) {
          console.log("Setting up bracket relationships...");
          setupBracketRelationships().then(async () => {
            console.log("Bracket relationships set up, calling advanceAllWinners...");
            await advanceAllWinners();
            console.log("Calling processAutoAdvanceByes...");
            await processAutoAdvanceByes();
          }).catch(error => {
            console.error("Failed to setup bracket relationships:", error);
          });
        } else {
          console.log("Already advancing winners, skipping automatic advancement in useEffect");
        }
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
    
    // Group existing matches by round and preserve their original order (DON'T CHANGE SORTING!)
    const roundsMap = new Map<string, Match[]>();
    matchesToUse.forEach(match => {
      const roundName = match.round;
      if (!roundsMap.has(roundName)) {
        roundsMap.set(roundName, []);
      }
      roundsMap.get(roundName)!.push(match);
    });

    // DO NOT SORT - preserve the original order of matches within each round
    // This ensures match 1 stays as match 1, match 2 stays as match 2, etc.

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
    
    // Create all rounds with expected number of matches and proper relationships
    roundNames.forEach((roundName, roundIndex) => {
      const existingMatches = roundsMap.get(roundName) || [];
      const expectedMatches = Math.pow(2, Math.max(0, totalRounds - (roundIndex + 1)));
      const allMatches: Match[] = [];
      
      // Add existing matches (already sorted consistently)
      existingMatches.forEach((match, matchIndex) => {
        // Set up progression relationships for existing matches
        if (roundIndex > 0) {
          const prevRoundName = roundNames[roundIndex - 1];
          const prevRoundMatches = roundsMap.get(prevRoundName) || [];
          
          // Each match in current round gets winners from 2 matches in previous round
          const prevMatchIndex1 = matchIndex * 2;
          const prevMatchIndex2 = matchIndex * 2 + 1;
          
          if (prevMatchIndex1 < prevRoundMatches.length) {
            match.previousMatch1Id = prevRoundMatches[prevMatchIndex1].id;
          }
          if (prevMatchIndex2 < prevRoundMatches.length) {
            match.previousMatch2Id = prevRoundMatches[prevMatchIndex2].id;
          }
        }
        
        allMatches.push(match);
      });
      
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
        if (roundIndex > 0) {
          const prevRoundName = roundNames[roundIndex - 1];
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
        roundNumber: roundIndex + 1
      });
    });

    console.log("Generated bracket with proper relationships:");
    rounds.forEach(round => {
      console.log(`${round.name}:`, round.matches.map(m => ({
        id: m.id,
        prev1: m.previousMatch1Id,
        prev2: m.previousMatch2Id
      })));
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
      
      // Don't show individual toast here - let advanceAllWinners handle consolidated messaging
      return updatedMatches;
    } else {
      console.log("No next match found for winner advancement");
      console.log("Looking for next match with previousMatch1Id or previousMatch2Id =", completedMatch.id);
      console.log("Available bracket matches:");
      bracketData.forEach(round => {
        round.matches.forEach(match => {
          console.log(`- Match ${match.id}: prev1=${match.previousMatch1Id}, prev2=${match.previousMatch2Id}`);
        });
      });
    }

    return currentMatches;
  };

  const advanceAllWinners = async () => {
    // Prevent multiple simultaneous executions
    if (isAdvancingWinners) {
      console.log("Already advancing winners, skipping...");
      return;
    }

    setIsAdvancingWinners(true);

    try {
      const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
      const completedMatches = tournamentMatches.filter(m => m.status === "completed" && m.winner);
      
      console.log("advanceAllWinners called with", completedMatches.length, "completed matches");
      completedMatches.forEach(match => {
        console.log("Processing completed match:", match.id, "winner:", match.winner);
      });
      
      if (completedMatches.length === 0) return;

      // Group matches by round and process in order to ensure proper advancement flow
      const completedByRound = completedMatches.reduce((acc, match) => {
        if (!acc[match.round]) acc[match.round] = [];
        acc[match.round].push(match);
        return acc;
      }, {});

      console.log("Completed matches by round:", Object.keys(completedByRound));

      // Process rounds in order and ensure next round matches exist
      const roundOrder = ["Round 1", "Quarterfinals", "Semifinals", "Final"];
      
      for (const round of roundOrder) {
        const roundMatches = completedByRound[round] || [];
        if (roundMatches.length === 0) continue;

        console.log(`Processing ${roundMatches.length} completed matches in ${round}`);
        
        // First, ensure next round matches exist if this isn't the final
        if (round !== "Final") {
          await createNextRoundMatches(round, tournamentId);
        }
      }

      let updatedMatches = [...matches];
      let hasChanges = false;
      let successfulAdvancements = 0;

    // Process all completed matches to advance winners
    for (const completedMatch of completedMatches) {
      console.log("Processing winner advancement for match:", completedMatch.id, "winner:", completedMatch.winner);
      
      // For database matches, use direct database advancement
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(completedMatch.id)) {
        const winnerPlayerData = players.find(p => p.name === completedMatch.winner);
        if (winnerPlayerData) {
          console.log("Advancing database match winner to database:", completedMatch.winner);
          try {
            await progressWinnerToDatabase(completedMatch, winnerPlayerData);
            successfulAdvancements++;
            hasChanges = true;
          } catch (error) {
            console.error("Failed to advance winner in database:", error);
          }
        }
      } else {
        // For placeholder matches, use UI advancement
        const previousMatches = updatedMatches;
        const advancedMatches = progressWinnerImmediately(previousMatches, completedMatch);
        
        if (advancedMatches !== previousMatches) {
          console.log("Changes detected after winner advancement");
          updatedMatches = advancedMatches;
          hasChanges = true;
          successfulAdvancements++;
        } else {
          console.log("No changes after winner advancement attempt");
        }
      }
    }

    if (hasChanges) {
      console.log("Changes detected in advanceAllWinners, but NOT calling onMatchUpdate to prevent loops");
      // DO NOT call onMatchUpdate here as it triggers the useEffect again and creates an endless loop
      // The bracket display is already updated via setBracketData in progressWinnerImmediately
      
      // Show single consolidated toast instead of multiple
      if (successfulAdvancements > 0) {
        toast({
          title: "Winners Advanced!",
          description: `${successfulAdvancements} winner${successfulAdvancements > 1 ? 's have' : ' has'} been advanced to the next round.`,
        });
      }
    } else {
      console.log("No changes to report to parent component");
    }
    } catch (error) {
      console.error("Error in advanceAllWinners:", error);
      toast({
        title: "Error",
        description: "Failed to advance winners. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAdvancingWinners(false);
    }
  };

  const processAutoAdvanceByes = async () => {
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    
    // Find bye matches: completed matches with only one real participant that should auto-advance
    const byeMatches = tournamentMatches.filter(m => {
      if (m.status !== "completed" || !m.player1 || !m.player2) return false;
      
      // Check if one participant is a placeholder (no opponent)
      const player1IsPlaceholder = m.player1.name?.startsWith("no-opponent");
      const player2IsPlaceholder = m.player2.name?.startsWith("no-opponent");
      
      // This is a bye match if one player is real and the other is a placeholder
      return (player1IsPlaceholder && !player2IsPlaceholder) || 
             (!player1IsPlaceholder && player2IsPlaceholder);
    });

    if (byeMatches.length === 0) return;

    console.log(`Processing ${byeMatches.length} bye matches for auto-advancement`);

    let updatedMatches = [...matches];
    let hasChanges = false;

    for (const byeMatch of byeMatches) {
      // Determine the winner (the real player, not the placeholder)
      const player1IsPlaceholder = byeMatch.player1?.name?.startsWith("no-opponent");
      const player2IsPlaceholder = byeMatch.player2?.name?.startsWith("no-opponent");
      
      let realWinner;
      if (player1IsPlaceholder && !player2IsPlaceholder) {
        realWinner = byeMatch.player2?.name;
      } else if (!player1IsPlaceholder && player2IsPlaceholder) {
        realWinner = byeMatch.player1?.name;
      }
      
      if (!realWinner) continue;
      
      console.log(`Auto-advancing ${realWinner} from bye match ${byeMatch.id}`);
      
      try {
        // Update the winner in the database if not already set
        if (!byeMatch.winner || byeMatch.winner !== realWinner) {
          const winnerPlayer = players.find(p => p.name === realWinner);
          if (winnerPlayer) {
            const { error: updateError } = await supabase
              .from('matches')
              .update({
                winner_id: winnerPlayer.id
              })
              .eq('id', byeMatch.id);

            if (updateError) {
              console.error("Error updating bye match winner:", updateError);
              continue;
            }
            
            console.log(`Updated bye match ${byeMatch.id} with winner ${realWinner}`);
            
            // Update local state
            const updatedByeMatch = { ...byeMatch, winner: realWinner };
            updatedMatches = updatedMatches.map(m => 
              m.id === byeMatch.id ? updatedByeMatch : m
            );
            hasChanges = true;
          }
        }
      } catch (error) {
        console.error(`Error processing bye match ${byeMatch.id}:`, error);
      }
    }

    if (hasChanges) {
      console.log("Auto-bye processing completed, updating matches");
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

  const createNextRoundMatches = async (currentRound: string, tournamentId: string) => {
    console.log("=== CREATING NEXT ROUND MATCHES ===");
    console.log("Current round:", currentRound);
    
    const roundMapping = {
      "Round 1": "Quarterfinals",
      "Quarterfinals": "Semifinals", 
      "Semifinals": "Final"
    };
    
    const nextRound = roundMapping[currentRound];
    if (!nextRound) {
      console.log("No next round for:", currentRound);
      return;
    }
    
    console.log("Creating matches for next round:", nextRound);
    
    // Check if next round matches already exist
    const { data: existingMatches, error: checkError } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', nextRound);
      
    if (checkError) {
      console.error("Error checking existing matches:", checkError);
      return;
    }
    
    if (existingMatches && existingMatches.length > 0) {
      console.log("Next round matches already exist:", existingMatches.length);
      return;
    }
    
    // Get current round matches to determine how many next round matches to create
    const { data: currentMatches, error: currentError } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', currentRound)
      .order('created_at');
      
    if (currentError) {
      console.error("Error getting current round matches:", currentError);
      return;
    }
    
    const nextRoundMatchCount = Math.ceil((currentMatches?.length || 0) / 2);
    console.log("Creating", nextRoundMatchCount, "matches for", nextRound);
    
    // Create next round matches
    const matchesToCreate = [];
    for (let i = 0; i < nextRoundMatchCount; i++) {
      const startIndex = i * 2;
      const prevMatch1 = currentMatches?.[startIndex];
      const prevMatch2 = currentMatches?.[startIndex + 1];
      
      matchesToCreate.push({
        tournament_id: tournamentId,
        type: "singles",
        round: nextRound,
        status: "scheduled",
        previous_match_1_id: prevMatch1?.id || null,
        previous_match_2_id: prevMatch2?.id || null
      });
    }
    
    if (matchesToCreate.length > 0) {
      const { data: createdMatches, error: createError } = await supabase
        .from('matches')
        .insert(matchesToCreate)
        .select();
        
      if (createError) {
        console.error("Error creating next round matches:", createError);
      } else {
        console.log("Successfully created", createdMatches?.length, "next round matches");
        
        // Update bracket relationships for the newly created matches
        await setupBracketRelationships();
      }
    }
    
    console.log("=== NEXT ROUND MATCHES CREATION COMPLETE ===");
  };

  // Standard tournament bracket advancement pattern
  const getAdvancementMapping = (matchIndex: number, totalMatches: number) => {
    // Standard pattern:
    // Match 1 (index 0) → Position 1 of Round 2 Match 1 (index 0)
    // Match 2 (index 1) → Position 2 of Round 2 Match 1 (index 0)
    // Match 3 (index 2) → Position 1 of Round 2 Match 2 (index 1)
    // Match 4 (index 3) → Position 2 of Round 2 Match 2 (index 1)
    // Match 5 (index 4) → Position 1 of Round 2 Match 3 (index 2)
    // Match 6 (index 5) → Position 2 of Round 2 Match 3 (index 2)
    
    const nextMatchIndex = Math.floor(matchIndex / 2);
    const position = (matchIndex % 2) + 1;
    
    return { nextMatchIndex, position };
  };
  const progressWinnerToDatabase = async (completedMatch: Match, winnerPlayer: { id: string; name: string; handicap: number }) => {
    try {
      console.log("=== PROGRESS WINNER TO DATABASE ===");
      console.log("Completed match:", completedMatch.id, "Round:", completedMatch.round);
      console.log("Winner player:", winnerPlayer.name, "ID:", winnerPlayer.id);
      
      // First try to find next match using bracket relationships
      console.log("Looking for next match using database relationships...");
      const { data: nextMatches, error: nextMatchError } = await supabase
        .from('matches')
        .select('*')
        .or(`previous_match_1_id.eq.${completedMatch.id},previous_match_2_id.eq.${completedMatch.id}`);

      if (nextMatchError) {
        console.log("Database query error:", nextMatchError);
        throw nextMatchError;
      }

      console.log("Found next matches from database:", nextMatches?.length || 0);
      
      // If no matches found in database with relationships, try alternative approach
      let nextMatch = null;
      let position = 1;
      
      if (nextMatches && nextMatches.length > 0) {
        nextMatch = nextMatches[0];
        position = nextMatch.previous_match_1_id === completedMatch.id ? 1 : 2;
        console.log("Using next match from database:", nextMatch.id, "Position:", position);
      } else {
        // Use custom advancement mapping for proper bracket positioning
        console.log("Using custom advancement mapping...");
        
        // Get current round matches to find the match index
        const { data: currentRoundMatches, error: currentRoundError } = await supabase
          .from('matches')
          .select('*')
          .eq('tournament_id', tournamentId)
          .eq('round', completedMatch.round)
          .order('created_at');
          
        if (currentRoundError) {
          console.error("Error getting current round matches:", currentRoundError);
          throw currentRoundError;
        }
        
        const matchIndex = currentRoundMatches?.findIndex(m => m.id === completedMatch.id) || 0;
        console.log("Match index in round:", matchIndex);
        
        const advancement = getAdvancementMapping(matchIndex, currentRoundMatches?.length || 0);
        console.log("Advancement mapping for match", matchIndex + 1, ":", advancement);
        console.log("This means: Match", matchIndex + 1, "winner goes to Round 2 Match", advancement.nextMatchIndex + 1, "Position", advancement.position);
        
        // Get next round matches
        const roundMapping = {
          "Round 1": "Quarterfinals",
          "Quarterfinals": "Semifinals", 
          "Semifinals": "Final"
        };
        
        const nextRound = roundMapping[completedMatch.round];
        console.log("Looking for next round:", nextRound);
        
        if (nextRound) {
        const { data: nextRoundMatches, error: nextRoundError } = await supabase
          .from('matches')
          .select('*')
          .eq('tournament_id', tournamentId)
          .eq('round', nextRound)
          .order('created_at');
          
        console.log("=== NEXT ROUND MATCH LOOKUP ===");
        console.log("Looking for next round:", nextRound);
        console.log("Found next round matches:", nextRoundMatches?.length || 0);
        console.log("Next round matches:", nextRoundMatches?.map(m => ({ id: m.id, round: m.round })) || []);
        
        if (!nextRoundError && nextRoundMatches && nextRoundMatches.length > advancement.nextMatchIndex) {
            nextMatch = nextRoundMatches[advancement.nextMatchIndex];
            position = advancement.position;
            console.log(`Using custom mapping: Match ${matchIndex + 1} winner → Match ${advancement.nextMatchIndex + 1} Position ${position}`);
          }
        }
      }

      if (!nextMatch) {
        console.log("No next match found for winner advancement - might be final match");
        return;
      }

      console.log("Advancing winner to match:", nextMatch.id, "at position:", position);
      
      // First check if this player is already in this match at ANY position to prevent duplicates
      const { data: existingPlayerInMatch, error: playerCheckError } = await supabase
        .from('match_participants')
        .select('*')
        .eq('match_id', nextMatch.id)
        .eq('player_id', winnerPlayer.id);

      if (playerCheckError) {
        console.error("Error checking for existing player in match:", playerCheckError);
        throw playerCheckError;
      }

      if (existingPlayerInMatch && existingPlayerInMatch.length > 0) {
        console.log(`Player ${winnerPlayer.name} is already in match ${nextMatch.id}, skipping advancement`);
        return;
      }
      
      // Check if participant already exists at this position
      const { data: existingParticipant, error: checkError } = await supabase
        .from('match_participants')
        .select('*')
        .eq('match_id', nextMatch.id)
        .eq('position', position)
        .maybeSingle(); // Use maybeSingle to avoid errors when no record found

      if (checkError) {
        console.error("Error checking existing participant:", checkError);
        throw checkError;
      }

      if (existingParticipant) {
        // Update existing participant only if it's a placeholder or different player
        if (existingParticipant.is_placeholder || existingParticipant.player_id !== winnerPlayer.id) {
          console.log("Updating existing participant for position:", position);
          const { error: updateError } = await supabase
            .from('match_participants')
            .update({
              player_id: winnerPlayer.id,
              score: null, // Reset score for new match
              is_placeholder: false,
              placeholder_name: null
            })
            .eq('id', existingParticipant.id);

          if (updateError) {
            console.error("Error updating participant:", updateError);
            throw updateError;
          }
        } else {
          console.log(`Position ${position} already has the correct player, skipping update`);
        }
      } else {
        // Create new participant
        console.log("Creating new participant for position:", position);
        const { error: insertError } = await supabase
          .from('match_participants')
          .insert({
            match_id: nextMatch.id,
            player_id: winnerPlayer.id,
            position: position,
            team_number: null,
            score: null,
            is_placeholder: false,
            placeholder_name: null
          });

        if (insertError) {
          console.error("Error inserting participant:", insertError);
          // If it's a duplicate key error, just log and continue (race condition)
          if (insertError.code === '23505') {
            console.log("Duplicate key detected, player already advanced by another process");
            return;
          }
          throw insertError;
        }
      }

      console.log(`Winner ${winnerPlayer.name} successfully advanced to next match in database`);
      console.log("=== END PROGRESS WINNER TO DATABASE ===");
    } catch (error) {
      console.error('Error progressing winner to database:', error);
      throw error;
    }
  };

  const handleUpdateMatches = async () => {
    console.log("=== UPDATE MATCHES TRIGGERED ===");
    
    toast({
      title: "Updating Matches...",
      description: "Processing winner advancement and bracket updates.",
    });

    try {
      const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
      const completedMatches = tournamentMatches.filter(m => m.status === "completed" && m.winner);
      
      console.log("Total tournament matches:", tournamentMatches.length);
      console.log("Completed matches with winners:", completedMatches.length);
      console.log("Completed matches:", completedMatches.map(m => ({
        id: m.id,
        round: m.round,
        winner: m.winner,
        player1: m.player1?.name,
        player2: m.player2?.name
      })));

      // First set up bracket relationships if they're missing
      console.log("Setting up bracket relationships...");
      await setupBracketRelationships();

      // Process all completed matches to advance winners
      console.log("Calling advanceAllWinners...");
      await advanceAllWinners();
      
      // Process bye matches (auto-advance players with no opponents)
      console.log("Calling processAutoAdvanceByes...");
      await processAutoAdvanceByes();

      // Regenerate bracket to ensure latest data is displayed
      console.log("Regenerating bracket display...");
      generateBracket();
      
      // Force a refresh by calling the parent's refresh method
      console.log("Triggering parent component refresh...");
      // The parent component will fetch fresh data and regenerate the bracket
      onMatchUpdate([...matches]); // Trigger refresh with current matches to force re-render
      
      toast({
        title: "Matches Updated!",
        description: "All winners have been advanced and bracket has been refreshed.",
      });
      
    } catch (error) {
      console.error('Error updating matches:', error);
      toast({
        title: "Error",
        description: `Failed to update matches: ${error.message}`,
        variant: "destructive"
      });
    }
    
    console.log("=== UPDATE MATCHES COMPLETE ===");
  };

  const setupBracketRelationships = async () => {
    console.log("=== SETTING UP BRACKET RELATIONSHIPS ===");
    try {
      // Get all matches for this tournament, preserving the order within each round
      const { data: allMatches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round')
        .order('created_at'); // Preserve creation order within each round

      if (error) throw error;

      console.log("Found tournament matches:", allMatches.length);

      // Group matches by round
      const matchesByRound = allMatches.reduce((acc, match) => {
        if (!acc[match.round]) acc[match.round] = [];
        acc[match.round].push(match);
        return acc;
      }, {});

      console.log("Matches by round:", Object.keys(matchesByRound));

      // Set up relationships between rounds
      const roundOrder = ["Round 1", "Quarterfinals", "Semifinals", "Final"];
      
      for (let i = 0; i < roundOrder.length - 1; i++) {
        const currentRound = roundOrder[i];
        const nextRound = roundOrder[i + 1];
        
        const currentMatches = matchesByRound[currentRound] || [];
        const nextMatches = matchesByRound[nextRound] || [];
        
        console.log(`Setting up relationships: ${currentRound} -> ${nextRound}`);
        console.log(`Current round matches: ${currentMatches.length}, Next round matches: ${nextMatches.length}`);
        
        // For each next round match, find the correct pair of previous matches
        for (let j = 0; j < nextMatches.length; j++) {
          const nextMatch = nextMatches[j];
          
          // Skip if relationships already exist
          if (nextMatch.previous_match_1_id && nextMatch.previous_match_2_id) {
            console.log(`Match ${nextMatch.id} already has relationships set up`);
            continue;
          }
          
          // For tournament bracket, each next match gets fed by 2 previous matches
          // We need to properly pair them based on bracket position
          const startIndex = j * 2;
          const prevMatch1 = currentMatches[startIndex];
          const prevMatch2 = currentMatches[startIndex + 1];
          
          if (prevMatch1 && prevMatch2) {
            console.log(`Linking ${prevMatch1.id} and ${prevMatch2.id} to ${nextMatch.id}`);
            
            // Update the next match with previous match references
            const { error: updateError } = await supabase
              .from('matches')
              .update({
                previous_match_1_id: prevMatch1.id,
                previous_match_2_id: prevMatch2.id
              })
              .eq('id', nextMatch.id);
              
            if (updateError) {
              console.error("Error updating match relationships:", updateError);
            } else {
              console.log(`Successfully linked matches to ${nextMatch.id}`);
            }
          } else if (prevMatch1) {
            // If only one previous match, set it as previous_match_1_id
            console.log(`Linking ${prevMatch1.id} to ${nextMatch.id} (single match)`);
            
            const { error: updateError } = await supabase
              .from('matches')
              .update({
                previous_match_1_id: prevMatch1.id
              })
              .eq('id', nextMatch.id);
              
            if (updateError) {
              console.error("Error updating single match relationship:", updateError);
            } else {
              console.log(`Successfully linked single match to ${nextMatch.id}`);
            }
          }
        }
        
        // Additionally, update each current round match with next_match_id
        for (let j = 0; j < currentMatches.length; j++) {
          const currentMatch = currentMatches[j];
          const nextMatchIndex = Math.floor(j / 2);
          const nextMatch = nextMatches[nextMatchIndex];
          
          if (nextMatch && !currentMatch.next_match_id) {
            console.log(`Setting next_match_id for ${currentMatch.id} to ${nextMatch.id}`);
            
            const { error: updateError } = await supabase
              .from('matches')
              .update({
                next_match_id: nextMatch.id
              })
              .eq('id', currentMatch.id);
              
            if (updateError) {
              console.error("Error updating next_match_id:", updateError);
            } else {
              console.log(`Successfully set next_match_id for ${currentMatch.id}`);
            }
          }
        }
      }
      
      console.log("=== BRACKET RELATIONSHIPS SETUP COMPLETE ===");
    } catch (error) {
      console.error('Error setting up bracket relationships:', error);
    }
  };

  const handleMatchUpdate = async (matchId: string, updates: Partial<Match>) => {
    console.log("🔥 handleMatchUpdate FUNCTION CALLED!");
    console.log("🔥 Match ID:", matchId);
    console.log("🔥 Updates:", updates);
    console.log("=== BRACKET MATCH UPDATE DEBUG ===");
    console.log("handleMatchUpdate called for match ID:", matchId, "updates:", updates);
    console.log("Original match data:", matches.find(m => m.id === matchId));
    
    // Check if this is a generated match (non-UUID ID)
    const isGeneratedMatch = !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId);
    
    console.log("Is generated match:", isGeneratedMatch, "Match ID:", matchId);
    console.log("=== STARTING MATCH UPDATE PROCESSING ===");
    
    if (isGeneratedMatch) {
      console.log("=== PROCESSING PLACEHOLDER MATCH ===");
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

        // Now insert match participants including placeholders
        const participants = [];
        if (updates.player1) {
          if (updates.player1.name?.startsWith("no-opponent")) {
            // Handle "no opponent" placeholder
            participants.push({
              match_id: newMatchId,
              player_id: null,
              position: 1,
              score: null,
              is_placeholder: true,
              placeholder_name: updates.player1.name
            });
          } else if (updates.player1.name && !updates.player1.name.startsWith("no-player")) {
            // Handle real player
            const player1Data = players.find(p => p.name === updates.player1.name);
            if (player1Data) {
              participants.push({
                match_id: newMatchId,
                player_id: player1Data.id,
                position: 1,
                score: updates.player1.score,
                is_placeholder: false,
                placeholder_name: null
              });
            }
          }
        }
        if (updates.player2) {
          if (updates.player2.name?.startsWith("no-opponent")) {
            // Handle "no opponent" placeholder
            participants.push({
              match_id: newMatchId,
              player_id: null,
              position: 2,
              score: null,
              is_placeholder: true,
              placeholder_name: updates.player2.name
            });
          } else if (updates.player2.name && !updates.player2.name.startsWith("no-player")) {
            // Handle real player
            const player2Data = players.find(p => p.name === updates.player2.name);
            if (player2Data) {
              participants.push({
                match_id: newMatchId,
                player_id: player2Data.id,
                position: 2,
                score: updates.player2.score,
                is_placeholder: false,
                placeholder_name: null
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

        // Check if match was completed with a winner - advance immediately
        let finalMatches = updatedMatches;
        if (databaseMatch.status === "completed" && databaseMatch.winner) {
          console.log("=== AUTOMATIC WINNER ADVANCEMENT (PLACEHOLDER CONVERSION) ===");
          console.log("Match completed with winner:", databaseMatch.winner);
          
          // First ensure bracket relationships are set up
          await setupBracketRelationships();
          
          // Progress winner immediately
          finalMatches = progressWinnerImmediately(updatedMatches, databaseMatch);
          
          // Also progress winner in database
          const winnerPlayer = players.find(p => p.name === databaseMatch.winner);
          if (winnerPlayer) {
            await progressWinnerToDatabase(databaseMatch, winnerPlayer);
          }
          
          console.log("=== WINNER ADVANCEMENT COMPLETE (PLACEHOLDER CONVERSION) ===");
        }

        toast({
          title: "Match Created & Updated!",
          description: databaseMatch.winner ? 
            `Match created! ${databaseMatch.winner} has been advanced to the next round.` :
            "Placeholder match converted to database match successfully.",
        });

        // Update parent component with the updated matches
        onMatchUpdate(finalMatches);
        
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
    console.log("=== PROCESSING DATABASE MATCH ===");
    console.log("Updating database match with ID:", matchId);
    
    try {
      console.log("=== STARTING DATABASE OPERATIONS ===");
      // Update match details in database
      const matchUpdates: any = {
        round: updates.round,
        status: updates.status
      };
      console.log("Basic match updates prepared:", matchUpdates);

      // Set winner_id based on winner name if provided
      if (updates.winner) {
        // Handle both real players and "no opponent" scenarios
        if (updates.winner.startsWith('no-opponent')) {
          // This is a placeholder winner, don't set winner_id
          matchUpdates.winner_id = null;
          console.log("Placeholder winner, not setting winner_id:", updates.winner);
        } else {
          const winnerPlayer = players.find(p => p.name === updates.winner);
          if (winnerPlayer) {
            matchUpdates.winner_id = winnerPlayer.id;
            console.log("Setting winner_id:", winnerPlayer.id, "for winner:", updates.winner);
          } else {
            console.log("Could not find player ID for winner:", updates.winner);
            console.log("Available players:", players.map(p => ({ id: p.id, name: p.name })));
            matchUpdates.winner_id = null;
          }
        }
      } else {
        // Clear winner if no winner is set
        matchUpdates.winner_id = null;
        console.log("Clearing winner_id");
      }

      // Set date and time if provided
      if (updates.date) matchUpdates.match_date = updates.date;
      if (updates.time && updates.time !== "TBD") matchUpdates.match_time = updates.time;
      if (updates.tee) matchUpdates.tee = updates.tee;

      console.log("Updating match in database with:", matchUpdates);
      console.log("=== CALLING SUPABASE MATCH UPDATE ===");

      const { error: matchError } = await supabase
        .from('matches')
        .update(matchUpdates)
        .eq('id', matchId);

      console.log("=== SUPABASE MATCH UPDATE COMPLETED ===");
      console.log("Match update error:", matchError);

      if (matchError) {
        console.error("Match update error:", matchError);
        throw matchError;
      }

      console.log("=== MATCH UPDATE SUCCESSFUL ===");
      // Handle player and score updates
      if (updates.player1 || updates.player2) {
        console.log("Updating player assignments");
        
        try {
          // Get existing participants first to understand current state
          console.log("=== FETCHING EXISTING PARTICIPANTS ===");
          const { data: existingParticipants, error: fetchError } = await supabase
            .from('match_participants')
            .select('*')
            .eq('match_id', matchId)
            .order('position');

          if (fetchError) {
            console.error("Error fetching existing participants:", fetchError);
            throw fetchError;
          }

          console.log("Existing participants:", existingParticipants);

          // Update participants one by one using direct UPDATE queries
          if (updates.player1) {
            console.log("=== UPDATING POSITION 1 ===");
            let participant1Data;
            
            if (updates.player1.name?.startsWith("no-opponent")) {
              // Handle "no opponent" placeholder
              console.log("Setting position 1 to placeholder:", updates.player1.name);
              participant1Data = {
                player_id: null,
                score: null,
                is_placeholder: true,
                placeholder_name: updates.player1.name
              };
            } else if (updates.player1.name && !updates.player1.name.startsWith("no-player")) {
              // Handle real player
              const player1Data = players.find(p => p.name === updates.player1?.name);
              if (player1Data) {
                console.log("Setting position 1 to player:", player1Data.name, "ID:", player1Data.id);
                participant1Data = {
                  player_id: player1Data.id,
                  score: updates.player1.score || null,
                  is_placeholder: false,
                  placeholder_name: null
                };
              } else {
                console.log("Could not find player1 data for:", updates.player1.name);
              }
            }

            if (participant1Data) {
              // Check if position 1 participant exists
              const position1Exists = existingParticipants?.some(p => p.position === 1);
              
              if (position1Exists) {
                console.log("Updating existing position 1 participant");
                const { error: updateError } = await supabase
                  .from('match_participants')
                  .update(participant1Data)
                  .eq('match_id', matchId)
                  .eq('position', 1);
                  
                if (updateError) {
                  console.error("Error updating position 1 participant:", updateError);
                  throw updateError;
                }
              } else {
                console.log("Inserting new position 1 participant");
                const { error: insertError } = await supabase
                  .from('match_participants')
                  .insert({
                    match_id: matchId,
                    position: 1,
                    ...participant1Data
                  });
                  
                if (insertError) {
                  console.error("Error inserting position 1 participant:", insertError);
                  throw insertError;
                }
              }
            }
          }
          
          if (updates.player2) {
            console.log("=== UPDATING POSITION 2 ===");
            let participant2Data;
            
            if (updates.player2.name?.startsWith("no-opponent")) {
              // Handle "no opponent" placeholder
              console.log("Setting position 2 to placeholder:", updates.player2.name);
              participant2Data = {
                player_id: null,
                score: null,
                is_placeholder: true,
                placeholder_name: updates.player2.name
              };
            } else if (updates.player2.name && !updates.player2.name.startsWith("no-player")) {
              // Handle real player
              const player2Data = players.find(p => p.name === updates.player2?.name);
              if (player2Data) {
                console.log("Setting position 2 to player:", player2Data.name, "ID:", player2Data.id);
                participant2Data = {
                  player_id: player2Data.id,
                  score: updates.player2.score || null,
                  is_placeholder: false,
                  placeholder_name: null
                };
              } else {
                console.log("Could not find player2 data for:", updates.player2.name);
              }
            }

            if (participant2Data) {
              // Check if position 2 participant exists
              const position2Exists = existingParticipants?.some(p => p.position === 2);
              
              if (position2Exists) {
                console.log("Updating existing position 2 participant");
                const { error: updateError } = await supabase
                  .from('match_participants')
                  .update(participant2Data)
                  .eq('match_id', matchId)
                  .eq('position', 2);
                  
                if (updateError) {
                  console.error("Error updating position 2 participant:", updateError);
                  throw updateError;
                }
              } else {
                console.log("Inserting new position 2 participant");
                const { error: insertError } = await supabase
                  .from('match_participants')
                  .insert({
                    match_id: matchId,
                    position: 2,
                    ...participant2Data
                  });
                  
                if (insertError) {
                  console.error("Error inserting position 2 participant:", insertError);
                  throw insertError;
                }
              }
            }
          }

          console.log("=== PARTICIPANT UPDATES COMPLETED SUCCESSFULLY ===");
        } catch (participantError) {
          console.error("Error in participant update process:", participantError);
          throw participantError;
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

      // Check if match was completed with a winner - advance immediately
      const completedMatch = updatedMatches.find(m => m.id === matchId);
      let finalMatches = updatedMatches;
      
      console.log("=== CHECKING FOR WINNER ADVANCEMENT ===");
      console.log("Completed match found:", !!completedMatch);
      console.log("Match status:", completedMatch?.status);
      console.log("Match winner:", completedMatch?.winner);
      console.log("Should advance:", completedMatch?.status === "completed" && !!completedMatch.winner);
      console.log("Current tournament matches count:", matches.filter(m => m.tournamentId === tournamentId).length);
      console.log("Round 1 matches:", matches.filter(m => m.tournamentId === tournamentId && m.round === "Round 1").length);
      console.log("Quarterfinals matches:", matches.filter(m => m.tournamentId === tournamentId && m.round === "Quarterfinals").length);
      
      if (completedMatch?.status === "completed" && completedMatch.winner) {
        console.log("=== AUTOMATIC WINNER ADVANCEMENT TRIGGERED ===");
        console.log("Match completed with winner:", completedMatch.winner);
        console.log("Advancing winner immediately...");
        
        try {
          // First ensure bracket relationships are set up
          console.log("Setting up bracket relationships for advancement...");
          await setupBracketRelationships();
          
          // Progress winner immediately in UI
          console.log("Progressing winner in UI...");
          finalMatches = progressWinnerImmediately(updatedMatches, completedMatch);
          
          // Update bracket display immediately with the advanced winner
          setBracketData(prevBracketData => {
            return prevBracketData.map(round => ({
              ...round,
              matches: round.matches.map(match => {
                // Update the completed match
                if (match.id === completedMatch.id) {
                  return { ...match, ...updates };
                }
                
                // Update next match with winner
                if (match.previousMatch1Id === completedMatch.id || match.previousMatch2Id === completedMatch.id) {
                  const winnerPlayer = players.find(p => p.name === completedMatch.winner);
                  if (winnerPlayer) {
                    const winnerData = {
                      name: winnerPlayer.name,
                      handicap: winnerPlayer.handicap,
                      score: undefined
                    };
                    
                    if (match.previousMatch1Id === completedMatch.id) {
                      return { ...match, player1: winnerData };
                    } else if (match.previousMatch2Id === completedMatch.id) {
                      return { ...match, player2: winnerData };
                    }
                  }
                }
                
                return match;
              })
            }));
          });
          
          // Also progress winner in database
          const winnerPlayer = players.find(p => p.name === completedMatch.winner);
          if (winnerPlayer) {
            console.log("Advancing winner to database:", winnerPlayer.name);
            await progressWinnerToDatabase(completedMatch, winnerPlayer);
          } else {
            console.log("Winner player not found in players list:", completedMatch.winner);
            console.log("Available players:", players.map(p => p.name));
          }
          
          console.log("=== WINNER ADVANCEMENT COMPLETE ===");
        } catch (error) {
          console.error("Error during winner advancement:", error);
        }
      } else {
        console.log("=== NO WINNER ADVANCEMENT NEEDED ===");
        console.log("Reason: Match not completed or no winner set");
      }

      toast({
        title: "Match Updated!",
        description: completedMatch?.winner ? 
          `Match completed! ${completedMatch.winner} has been advanced to the next round.` :
          "Match has been saved successfully.",
      });

      // Update parent component with the updated matches
      onMatchUpdate(finalMatches);

    } catch (error) {
      console.error('Error updating database match:', error);
      toast({
        title: "Error",
        description: "Failed to update match in database.",
        variant: "destructive"
      });
    }
  };

  // Save first round setup and generate complete bracket
  const saveFirstRoundSetup = async () => {
    try {
      console.log("=== SAVING FIRST ROUND SETUP ===");
      
      // Check if we have first round matches
      const firstRoundMatches = matches.filter(m => 
        m.tournamentId === tournamentId && m.round === "Round 1"
      );
      
      if (firstRoundMatches.length === 0) {
        toast({
          title: "No First Round Matches",
          description: "Please set up first round matches first using the manual setup.",
          variant: "destructive"
        });
        return;
      }
      
      console.log("First round matches found:", firstRoundMatches.length);
      
      // Calculate total rounds needed
      const totalRounds = Math.ceil(Math.log2(maxPlayers));
      console.log("Total rounds needed:", totalRounds);
      
      // Delete any existing matches beyond Round 1
      await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId)
        .neq('round', 'Round 1');
      
      // Generate complete bracket structure
      await generateCompleteBracketStructure(totalRounds, firstRoundMatches.length);
      
      // Setup proper bracket relationships
      await setupProperBracketRelationships(totalRounds);
      
      // Refresh the display
      generateBracket();
      
      toast({
        title: "Success",
        description: "Tournament bracket setup completed successfully!"
      });
      
    } catch (error) {
      console.error("Error saving first round setup:", error);
      toast({
        title: "Error",
        description: "Failed to save tournament setup. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Helper function to get round names
  const getRoundName = (round: number, totalRounds: number): string => {
    if (round === totalRounds) return "Final";
    if (round === totalRounds - 1) return "Semifinals";
    if (round === totalRounds - 2) return "Quarterfinals";
    return `Round ${round}`;
  };

  // Generate complete bracket structure
  const generateCompleteBracketStructure = async (totalRounds: number, firstRoundMatches: number) => {
    const allMatches = [];
    
    // Create matches for rounds 2 through final
    for (let round = 2; round <= totalRounds; round++) {
      const matchesInRound = Math.pow(2, totalRounds - round);
      const roundName = getRoundName(round, totalRounds);
      
      console.log(`Creating ${matchesInRound} matches for ${roundName}`);
      
      for (let matchInRound = 0; matchInRound < matchesInRound; matchInRound++) {
        const match = {
          tournament_id: tournamentId,
          round: roundName,
          type: 'singles', // Always singles for now
          status: 'scheduled'
        };
        
        allMatches.push(match);
      }
    }
    
    // Insert all matches into database
    if (allMatches.length > 0) {
      const { data: createdMatches, error: createError } = await supabase
        .from('matches')
        .insert(allMatches)
        .select('*')
        .order('created_at');
      
      if (createError) {
        console.error("Error creating matches:", createError);
        throw createError;
      }
      
      console.log("Successfully created", createdMatches?.length, "matches");
    }
  };

  // Setup proper bracket relationships with correct advancement logic
  const setupProperBracketRelationships = async (totalRounds: number) => {
    try {
      console.log("=== SETTING UP PROPER BRACKET RELATIONSHIPS ===");
      
      // Get all matches for this tournament, ordered by round and creation
      const { data: allMatches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('created_at');
      
      if (error) {
        console.error("Error fetching matches:", error);
        throw error;
      }
      
      console.log("All matches fetched:", allMatches?.length);
      if (!allMatches || allMatches.length === 0) return;
      
      // Group matches by round in correct order
      const matchesByRound: { [key: string]: any[] } = {};
      allMatches.forEach(match => {
        if (!matchesByRound[match.round]) {
          matchesByRound[match.round] = [];
        }
        matchesByRound[match.round].push(match);
      });
      
      // Setup relationships: Winner of match 1&2 → match 1 next round, Winner of match 3&4 → match 2 next round, etc.
      for (let round = 1; round < totalRounds; round++) {
        const currentRoundName = getRoundName(round, totalRounds);
        const nextRoundName = getRoundName(round + 1, totalRounds);
        
        const currentRoundMatches = matchesByRound[currentRoundName] || [];
        const nextRoundMatches = matchesByRound[nextRoundName] || [];
        
        console.log(`Setting up relationships from ${currentRoundName} (${currentRoundMatches.length}) to ${nextRoundName} (${nextRoundMatches.length})`);
        
        // Each pair of current round matches feeds into one next round match
        for (let i = 0; i < nextRoundMatches.length; i++) {
          const nextMatch = nextRoundMatches[i];
          const sourceMatch1 = currentRoundMatches[i * 2];     // Match 1, 3, 5, etc.
          const sourceMatch2 = currentRoundMatches[i * 2 + 1]; // Match 2, 4, 6, etc.
          
          if (sourceMatch1 && sourceMatch2) {
            console.log(`Setting up: Match ${i * 2 + 1} + Match ${i * 2 + 2} → Next Round Match ${i + 1}`);
            
            // Update the next round match with previous match references
            await supabase
              .from('matches')
              .update({
                previous_match_1_id: sourceMatch1.id,
                previous_match_2_id: sourceMatch2.id
              })
              .eq('id', nextMatch.id);
            
            // Update source matches with next match reference
            await supabase
              .from('matches')
              .update({ next_match_id: nextMatch.id })
              .eq('id', sourceMatch1.id);
              
            await supabase
              .from('matches')
              .update({ next_match_id: nextMatch.id })
              .eq('id', sourceMatch2.id);
          }
        }
      }
      
      console.log("Bracket relationships setup complete");
      
    } catch (error) {
      console.error("Error setting up bracket relationships:", error);
      throw error;
    }
  };

  // Complete reset function that clears ALL data and saves clean bracket to database
  const resetAllSetup = async () => {
    try {
      console.log("=== RESETTING ALL SETUP ===");
      
      // Clear all relationships first
      await supabase
        .from('matches')
        .update({
          next_match_id: null,
          previous_match_1_id: null,
          previous_match_2_id: null,
          winner_id: null
        })
        .eq('tournament_id', tournamentId);
      
      // Delete all match participants  
      const { data: matchIds } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId);
      
      if (matchIds && matchIds.length > 0) {
        await supabase
          .from('match_participants')
          .delete()
          .in('match_id', matchIds.map(m => m.id));
      }
      
      // Delete all matches
      const { error: deleteMatchesError } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId);
      
      if (deleteMatchesError) {
        console.error("Error deleting matches:", deleteMatchesError);
        throw deleteMatchesError;
      }
      
      // Update tournament status to ensure clean state
      await supabase
        .from('tournaments')
        .update({ 
          status: 'upcoming',
          updated_at: new Date().toISOString()
        })
        .eq('id', tournamentId);
      
      console.log("Database cleared completely - no new bracket structure created");
      
      // Reset local state to completely empty
      setBracketData([]);
      setSelectedMatch(null);
      setShowManualSetup(true);
      
      // Trigger refresh to reload from database (should be empty now)
      onMatchUpdate([]);
      
      console.log("=== RESET COMPLETE - FRESH BRACKET SAVED ===");
      
      toast({
        title: "Success",
        description: "Tournament reset and fresh bracket structure saved to database!"
      });
      
    } catch (error) {
      console.error("Error resetting setup:", error);
      toast({
        title: "Error",
        description: "Failed to reset tournament setup. Please try again.",
        variant: "destructive"
      });
    }
  };

  const deleteAllMatches = async () => {
    if (!tournamentId) return;
    
    try {
      console.log("=== DELETING ALL MATCHES ===");
      
      // Step 1: Clear all match relationships first to avoid foreign key constraints
      const { error: clearRelationshipsError } = await supabase
        .from('matches')
        .update({
          next_match_id: null,
          previous_match_1_id: null,
          previous_match_2_id: null
        })
        .eq('tournament_id', tournamentId);
        
      if (clearRelationshipsError) {
        console.error("Error clearing relationships:", clearRelationshipsError);
        throw clearRelationshipsError;
      }
      
      // Step 2: Get all match IDs for this tournament
      const { data: tournamentMatches, error: fetchError } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId);
        
      if (fetchError) {
        console.error("Error fetching match IDs:", fetchError);
        throw fetchError;
      }
      
      const matchIds = tournamentMatches?.map(m => m.id) || [];
      console.log(`Found ${matchIds.length} matches to delete`);
      
      // Step 3: Delete all match participants first
      if (matchIds.length > 0) {
        const { error: deleteParticipantsError } = await supabase
          .from('match_participants')
          .delete()
          .in('match_id', matchIds);
        
        if (deleteParticipantsError) {
          console.error("Error deleting participants:", deleteParticipantsError);
          // Don't throw, continue with match deletion
        } else {
          console.log("Successfully deleted match participants");
        }
      }
      
      // Step 4: Delete all matches for this tournament
      const { data: deletedMatches, error: deleteMatchesError } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId)
        .select();
        
      if (deleteMatchesError) {
        console.error("Error deleting matches:", deleteMatchesError);
        throw deleteMatchesError;
      }
      
      console.log(`Successfully deleted ${deletedMatches?.length || 0} matches`);
      
      // Step 5: Update local state
      const remainingMatches = matches.filter(m => m.tournamentId !== tournamentId);
      onMatchUpdate(remainingMatches);
      setBracketData([]);
      
      toast({
        title: "All Matches Deleted",
        description: `Successfully deleted ${deletedMatches?.length || 0} matches from the database.`,
        variant: "destructive"
      });
      
    } catch (error) {
      console.error("Error deleting matches:", error);
      toast({
        title: "Error",
        description: `Failed to delete matches from database: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
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
            <div className="flex gap-2">
              <Button
                onClick={saveFirstRoundSetup}
                variant="default"
                className="gap-2"
              >
                <Trophy className="h-4 w-4" />
                Save Setup 1. Round
              </Button>
              <Button
                onClick={() => resetAllSetup()}
                variant="destructive"
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Reset Setup
              </Button>
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
                                {match.player1?.name?.startsWith("no-opponent") ? "No Opponent" : (match.player1?.name || "TBD")}
                              </div>
                              {match.player1?.handicap !== undefined && !match.player1?.name?.startsWith("no-opponent") && (
                                <div className="text-xs text-muted-foreground">
                                  HC: {match.player1.handicap}
                                </div>
                              )}
                              {match.player1?.name?.startsWith("no-opponent") && (
                                <div className="text-xs text-muted-foreground italic">
                                  (Free Pass)
                                </div>
                              )}
                            </div>
                            
                            <div className="text-center text-xs text-muted-foreground">vs</div>
                            
                            <div className={`p-2 rounded border ${match.winner === match.player2?.name ? 'bg-primary/10 border-primary' : 'bg-muted/50'}`}>
                              <div className="text-sm font-medium">
                                {match.player2?.name?.startsWith("no-opponent") ? "No Opponent" : (match.player2?.name || (match.player1?.name && !match.player2 ? "No Opponent" : "TBD"))}
                              </div>
                              {match.player2?.handicap !== undefined && !match.player2?.name?.startsWith("no-opponent") && (
                                <div className="text-xs text-muted-foreground">
                                  HC: {match.player2.handicap}
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
            console.log("=== ABOUT TO CALL handleMatchUpdate ===");
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