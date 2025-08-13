import { useState, useEffect, useCallback } from "react";
import { Trophy, Award, Clock, Users, ChevronRight, Trash2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getRoundName, getNextRoundName, ROUND_PROGRESSION } from '@/lib/tournamentUtils';
import { EditMatchDialog } from "./EditMatchDialog";
import { ManualMatchSetup } from "./ManualMatchSetup";
import { OptimizedMatchCard } from "./OptimizedMatchCard";
import { ManualProgressionButton } from "./ManualProgressionButton";
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
  status: "pending" | "scheduled" | "completed";
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

  // Function to create Round 2 matches with winners - improved logic
  const createRound2WithWinners = async () => {
    console.log("=== CREATING ROUND 2 WITH WINNERS ===");
    
    try {
      // First check if Round 2 matches already exist
      const { data: existingRound2, error: checkError } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('round', 'Round 2');
        
      if (checkError) {
        console.error("Error checking existing Round 2:", checkError);
        return;
      }
      
      if (existingRound2 && existingRound2.length > 0) {
        toast({
          title: "Round 2 Already Exists",
          description: `Found ${existingRound2.length} Round 2 matches already created.`,
        });
        return;
      }
      
      // Get all Round 1 matches with winners
      const { data: round1Matches, error: fetchError } = await supabase
        .from('matches')
        .select(`
          *,
          match_participants (
            id,
            player_id,
            position,
            score,
            is_placeholder,
            placeholder_name,
            players (
              id,
              name,
              handicap
            )
          )
        `)
        .eq('tournament_id', tournamentId)
        .eq('round', 'Round 1')
        .eq('status', 'completed')
        .not('winner_id', 'is', null)
        .order('created_at');
        
      if (fetchError) {
        console.error("Error fetching Round 1 matches:", fetchError);
        return;
      }
      
      console.log("Round 1 completed matches with winners:", round1Matches?.length);
      
      if (!round1Matches || round1Matches.length < 2) {
        toast({
          title: "Not Ready",
          description: "Need at least 2 completed Round 1 matches to create Round 2.",
          variant: "destructive"
        });
        return;
      }
      
      // Create Round 2 matches by pairing winners from consecutive Round 1 matches
      const round2Matches = [];
      for (let i = 0; i < round1Matches.length; i += 2) {
        const match1 = round1Matches[i];
        const match2 = round1Matches[i + 1];
        
        if (match1) {
          round2Matches.push({
            tournament_id: tournamentId,
            type: "singles",
            round: "Round 2",
            status: "scheduled",
            match_date: null,
            match_time: null,
            tee: null,
            winner_id: null,
            previous_match_1_id: match1.id,
            previous_match_2_id: match2?.id || null
          });
        }
      }
      
      console.log("Creating", round2Matches.length, "Round 2 matches");
      
      // Insert Round 2 matches
      const { data: createdMatches, error: createError } = await supabase
        .from('matches')
        .insert(round2Matches)
        .select();
        
      if (createError) {
        console.error("Error creating Round 2 matches:", createError);
        toast({
          title: "Error",
          description: "Failed to create Round 2 matches.",
          variant: "destructive"
        });
        return;
      }
      
      console.log("Successfully created", createdMatches.length, "Round 2 matches");
      
      // Add winners as participants to Round 2 matches
      const participantsToAdd = [];
      
      for (let i = 0; i < createdMatches.length; i++) {
        const newMatch = createdMatches[i];
        const match1 = round1Matches[i * 2];
        const match2 = round1Matches[i * 2 + 1];
        
        // Add winner from first previous match as position 1
        if (match1?.winner_id) {
          const winner1 = players.find(p => p.id === match1.winner_id);
          if (winner1) {
            participantsToAdd.push({
              match_id: newMatch.id,
              player_id: winner1.id,
              position: 1,
              score: null,
              is_placeholder: false,
              placeholder_name: null
            });
            console.log(`Adding ${winner1.name} to position 1 of Round 2 match`);
          }
        }
        
        // Add winner from second previous match as position 2
        if (match2?.winner_id) {
          const winner2 = players.find(p => p.id === match2.winner_id);
          if (winner2) {
            participantsToAdd.push({
              match_id: newMatch.id,
              player_id: winner2.id,
              position: 2,
              score: null,
              is_placeholder: false,
              placeholder_name: null
            });
            console.log(`Adding ${winner2.name} to position 2 of Round 2 match`);
          }
        } else if (match1) {
          // If only one match, add placeholder for position 2
          participantsToAdd.push({
            match_id: newMatch.id,
            player_id: null,
            position: 2,
            score: null,
            is_placeholder: true,
            placeholder_name: "TBD"
          });
        }
      }
      
      // Insert all participants at once
      if (participantsToAdd.length > 0) {
        const { error: participantError } = await supabase
          .from('match_participants')
          .insert(participantsToAdd);
          
        if (participantError) {
          console.error("Error adding participants to Round 2:", participantError);
          toast({
            title: "Warning",
            description: "Round 2 matches created but failed to add participants.",
            variant: "destructive"
          });
        } else {
          console.log("Successfully added", participantsToAdd.length, "participants to Round 2");
        }
      }
      
      toast({
        title: "Round 2 Created!",
        description: `Successfully created ${createdMatches.length} Round 2 matches with winners.`,
      });
      
      // Refresh the bracket to show Round 2
      await refreshMatchData();
      
    } catch (error) {
      console.error("Error creating Round 2:", error);
      toast({
        title: "Error",
        description: "Failed to create Round 2 matches.",
        variant: "destructive"
      });
    }
  };

  // Function to refresh match data from database
  const refreshMatchData = async () => {
    console.log("=== REFRESHING MATCH DATA FROM DATABASE ===");
    try {
      // Fetch all matches with participants for this tournament
      const { data: dbMatches, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          match_participants (
            id,
            player_id,
            position,
            score,
            is_placeholder,
            placeholder_name,
            players (
              id,
              name,
              handicap
            )
          )
        `)
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: true })
        .order('created_at', { ascending: true });

      if (matchError) {
        console.error("Error refreshing match data:", matchError);
        toast({
          title: "Error",
          description: "Failed to refresh match data from database.",
          variant: "destructive"
        });
        return;
      }

      console.log("Fresh match data from database:", dbMatches?.length || 0, "matches");

      if (!dbMatches || dbMatches.length === 0) {
        console.log("No matches found in database for tournament:", tournamentId);
        // Clear bracket data if no matches exist
        setBracketData([]);
        onMatchUpdate(matches.filter(m => m.tournamentId !== tournamentId));
        return;
      }

      // Convert database matches to Match format
      const freshMatches: Match[] = dbMatches.map(dbMatch => {
        const participants = dbMatch.match_participants || [];
        console.log(`Processing match ${dbMatch.id}, round ${dbMatch.round}, participants:`, participants.length);
        
        const player1Data = participants.find(p => p.position === 1);
        const player2Data = participants.find(p => p.position === 2);

        let player1: Player | undefined;
        let player2: Player | undefined;

        if (player1Data) {
          if (player1Data.is_placeholder) {
            player1 = {
              name: player1Data.placeholder_name || "TBD",
              handicap: 0,
              score: player1Data.score || undefined
            };
          } else if (player1Data.players) {
            player1 = {
              name: player1Data.players.name,
              handicap: Number(player1Data.players.handicap || 0),
              score: player1Data.score || undefined
            };
          } else if (player1Data.player_id) {
            // Fallback: find player in players array
            const foundPlayer = players.find(p => p.id === player1Data.player_id);
            if (foundPlayer) {
              player1 = {
                name: foundPlayer.name,
                handicap: Number(foundPlayer.handicap || 0),
                score: player1Data.score || undefined
              };
            }
          }
        }

        if (player2Data) {
          if (player2Data.is_placeholder) {
            player2 = {
              name: player2Data.placeholder_name || "TBD",
              handicap: 0,
              score: player2Data.score || undefined
            };
          } else if (player2Data.players) {
            player2 = {
              name: player2Data.players.name,
              handicap: Number(player2Data.players.handicap || 0),
              score: player2Data.score || undefined
            };
          } else if (player2Data.player_id) {
            // Fallback: find player in players array
            const foundPlayer = players.find(p => p.id === player2Data.player_id);
            if (foundPlayer) {
              player2 = {
                name: foundPlayer.name,
                handicap: Number(foundPlayer.handicap || 0),
                score: player2Data.score || undefined
              };
            }
          }
        }

        console.log(`Match ${dbMatch.id} - Player 1:`, player1?.name, `Player 2:`, player2?.name);

        // Find winner name from winner_id
        let winner: string | undefined;
        if (dbMatch.winner_id) {
          const winnerPlayer = players.find(p => p.id === dbMatch.winner_id);
          winner = winnerPlayer?.name;
        }

        return {
          id: dbMatch.id,
          tournamentId: tournamentId,
          type: "singles" as const,
          player1,
          player2,
          round: dbMatch.round,
          status: dbMatch.status as "pending" | "scheduled" | "completed",
          date: dbMatch.match_date || new Date().toISOString().split('T')[0],
          time: dbMatch.match_time || "TBD",
          tee: dbMatch.tee?.toString(),
          winner,
          nextMatchId: dbMatch.next_match_id || undefined,
          previousMatch1Id: dbMatch.previous_match_1_id || undefined,
          previousMatch2Id: dbMatch.previous_match_2_id || undefined
        };
      });

      console.log("Converted fresh matches:", freshMatches.length);
      
      // Group matches by round for logging
      const matchesByRound = freshMatches.reduce((acc, match) => {
        if (!acc[match.round]) acc[match.round] = [];
        acc[match.round].push(match);
        return acc;
      }, {} as Record<string, Match[]>);
      
      console.log("Matches by round:", Object.keys(matchesByRound).map(round => `${round}: ${matchesByRound[round].length}`));

      // Update matches array in parent component
      const otherTournamentMatches = matches.filter(m => m.tournamentId !== tournamentId);
      const updatedMatches = [...otherTournamentMatches, ...freshMatches];
      
      console.log("Updating parent with", updatedMatches.length, "total matches");
      onMatchUpdate(updatedMatches);

      // Regenerate bracket immediately with fresh data
      generateBracket();

      console.log("=== MATCH DATA REFRESH COMPLETE ===");
    } catch (error) {
      console.error("Error refreshing match data:", error);
      toast({
        title: "Error",
        description: "Failed to refresh bracket data. Please try again.",
        variant: "destructive"
      });
    }
  };

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
    
    if (format === "matchplay" && matches.length > 0) {
      generateBracket();
      
      const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
      const databaseMatches = tournamentMatches.filter(m => 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.id)
      );
      
      console.log("Database matches found:", databaseMatches.length);
      console.log("Completed matches:", databaseMatches.filter(m => m.status === "completed").length);
      
      if (databaseMatches.length > 0) {
        setShowManualSetup(false);
        
        // Set up bracket relationships if needed
        setupBracketRelationships().catch(error => {
          console.error("Failed to setup bracket relationships:", error);
        });
        
        // Only auto-advance winners for matches that weren't just created
        // This prevents conflicts with the manual setup process
        if (databaseMatches.length > 0 && !tournamentMatches.some(m => 
          Date.now() - new Date(m.date).getTime() < 10000 // Created in last 10 seconds
        )) {
          autoAdvanceWinners(matches).catch(error => {
            console.error("Failed to auto-advance winners:", error);
          });
        }
      } else {
        setShowManualSetup(true);
      }
    }
    console.log("=== BRACKET EFFECT COMPLETE ===");
  }, [matches, players, maxPlayers]);

  // Re-enable auto-advance winners when matches are updated
  useEffect(() => {
    if (matches.length > 0) {
      // Check if all Round 1 matches are completed and auto-create Round 2
      checkAndCreateNextRound().catch(error => {
        console.error("Failed to check and create next round:", error);
      });
    }
  }, [matches]);

  // Function to check if a round is complete and create the next round automatically
  const checkAndCreateNextRound = async () => {
    console.log("=== CHECKING FOR ROUND COMPLETION ===");
    
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    
    // Check Round 1 completion
    const round1Matches = tournamentMatches.filter(m => m.round === "Round 1");
    const completedRound1 = round1Matches.filter(m => m.status === "completed" && m.winner);
    const round2Matches = tournamentMatches.filter(m => m.round === "Round 2");
    
    console.log(`Round 1: ${completedRound1.length}/${round1Matches.length} completed`);
    console.log(`Round 2: ${round2Matches.length} matches exist`);
    
    // If all Round 1 matches are completed but no Round 2 matches exist, create them
    if (round1Matches.length > 0 && 
        completedRound1.length === round1Matches.length && 
        completedRound1.length >= 2 && 
        round2Matches.length === 0) {
      
      console.log("All Round 1 matches completed - auto-creating Round 2");
      
      try {
        // Auto-create Round 2 with winners
        await createRound2WithWinners();
        
        toast({
          title: "Round 2 Ready!",
          description: "All Round 1 matches completed. Round 2 has been automatically created.",
        });
        
      } catch (error) {
        console.error("Error auto-creating Round 2:", error);
        toast({
          title: "Manual Action Needed",
          description: "Round 1 is complete. Please click 'Create Round 2' to continue.",
          variant: "destructive"
        });
      }
    }
    
    // Check for other rounds similarly
    if (round2Matches.length > 0) {
      const completedRound2 = round2Matches.filter(m => m.status === "completed" && m.winner);
      const round3Matches = tournamentMatches.filter(m => m.round === "Round 3");
      
      if (completedRound2.length === round2Matches.length && 
          completedRound2.length >= 1 && 
          round3Matches.length === 0) {
        
        console.log("All Round 2 matches completed - auto-creating Round 3");
        await createNextRoundMatches("Round 2", tournamentId);
      }
    }
  };

  // Automatic winner advancement - called after any match update
  const autoAdvanceWinners = async (updatedMatches: Match[]) => {
    console.log("=== AUTO ADVANCE WINNERS ===");
    
    const tournamentMatches = updatedMatches.filter(m => m.tournamentId === tournamentId);
    const completedMatches = tournamentMatches.filter(m => m.status === "completed" && m.winner);
    
    console.log(`Processing ${completedMatches.length} completed matches for auto-advancement`);
    
    // First, ensure next round matches exist for each completed round
    const completedRounds = [...new Set(completedMatches.map(m => m.round))];
    for (const round of completedRounds) {
      const roundMatches = tournamentMatches.filter(m => m.round === round);
      const completedInRound = roundMatches.filter(m => m.status === "completed" && m.winner);
      
      // If all matches in this round are completed, create next round
      if (roundMatches.length > 0 && completedInRound.length === roundMatches.length) {
        console.log(`All matches completed in ${round}, creating next round...`);
        await createNextRoundMatches(round, tournamentId);
      }
    }
    
    // Now advance winners to existing next round matches
    for (const completedMatch of completedMatches) {
      const winnerPlayerData = players.find(p => p.name === completedMatch.winner);
      if (winnerPlayerData) {
        console.log(`Auto-advancing winner: ${completedMatch.winner} from ${completedMatch.round}`);
        try {
          await progressWinnerToDatabase(completedMatch, winnerPlayerData);
        } catch (error) {
          console.error("Failed to auto-advance winner:", error);
        }
      }
    }
    
    // Auto-advance bye matches too
    const byeMatches = tournamentMatches.filter(m => {
      if (!m.player1 || !m.player2) return false;
      const hasRealPlayer = (m.player1.name && !m.player1.name.startsWith("no-opponent")) ||
                          (m.player2.name && !m.player2.name.startsWith("no-opponent"));
      const hasPlaceholder = m.player1.name?.startsWith("no-opponent") || 
                           m.player2.name?.startsWith("no-opponent") ||
                           !m.player1.name || !m.player2.name;
      return hasRealPlayer && hasPlaceholder && !m.winner;
    });
    
    for (const byeMatch of byeMatches) {
      const realPlayer = byeMatch.player1?.name && !byeMatch.player1.name.startsWith("no-opponent") 
        ? byeMatch.player1 
        : byeMatch.player2;
        
      if (realPlayer) {
        console.log(`Auto-advancing bye winner: ${realPlayer.name}`);
        const winnerPlayerData = players.find(p => p.name === realPlayer.name);
        if (winnerPlayerData) {
          // Mark match as completed with this winner
          const { error } = await supabase
            .from('matches')
            .update({ 
              winner_id: winnerPlayerData.id,
              status: 'completed' 
            })
            .eq('id', byeMatch.id);
            
          if (!error) {
            await progressWinnerToDatabase(byeMatch, winnerPlayerData);
          }
        }
      }
    }
    
    console.log("=== AUTO ADVANCE COMPLETE ===");
  };

  const generateBracket = () => {
    const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
    console.log("All tournament matches:", tournamentMatches);
    
    // Calculate proper bracket structure based on max players
    const totalRounds = Math.ceil(Math.log2(maxPlayers));
    console.log(`Generating bracket for ${maxPlayers} players with ${totalRounds} rounds`);
    
    // Define round names in correct order - use consistent numbering
    const roundNames: string[] = [];
    for (let i = 1; i <= totalRounds; i++) {
      roundNames.push(`Round ${i}`);
    }
    
    console.log("Round names:", roundNames);
    
    // Separate database matches (UUIDs) from generated matches (non-UUIDs)
    const databaseMatches = tournamentMatches.filter(m => 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.id)
    );
    
    console.log("Database matches found:", databaseMatches.length);
    
    // Group existing matches by round
    const roundsMap = new Map<string, Match[]>();
    databaseMatches.forEach(match => {
      const roundName = match.round;
      if (!roundsMap.has(roundName)) {
        roundsMap.set(roundName, []);
      }
      roundsMap.get(roundName)!.push(match);
    });

    // Create bracket structure with fixed number of matches per round
    const rounds: BracketRound[] = [];
    
    roundNames.forEach((roundName, roundIndex) => {
      const existingMatches = roundsMap.get(roundName) || [];
      const expectedMatches = Math.pow(2, totalRounds - (roundIndex + 1));
      
      console.log(`${roundName}: Expected ${expectedMatches} matches, found ${existingMatches.length}`);
      
      const roundMatches: Match[] = [];
      
      // Add existing database matches
      for (let i = 0; i < expectedMatches; i++) {
        const existingMatch = existingMatches[i];
        
        if (existingMatch) {
          // Use existing match
          roundMatches.push(existingMatch);
        } else {
          // Create placeholder for missing matches
          roundMatches.push({
            id: `placeholder-${roundName}-${i}`,
            tournamentId: tournamentId,
            type: "singles" as const,
            round: roundName,
            status: "pending" as const,
            date: new Date().toISOString().split('T')[0],
            time: "TBD"
          });
        }
      }
      
      rounds.push({
        name: roundName,
        matches: roundMatches,
        roundNumber: roundIndex + 1
      });
    });

    console.log("Generated bracket structure:");
    rounds.forEach(round => {
      console.log(`${round.name}: ${round.matches.length} matches`);
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
      
      // Winner successfully advanced
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
    
    const roundMapping = ROUND_PROGRESSION;
    
    const nextRound = getNextRoundName(currentRound);
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
        status: "pending",
        previous_match_1_id: prevMatch1?.id || null,
        previous_match_2_id: prevMatch2?.id || null
      });
    }
    
    console.log("Matches to create:", matchesToCreate);
    
    if (matchesToCreate.length > 0) {
      console.log("Attempting to insert", matchesToCreate.length, "matches into database...");
      const { data: createdMatches, error: createError } = await supabase
        .from('matches')
        .insert(matchesToCreate)
        .select();
        
      if (createError) {
        console.error("Error creating next round matches:", createError);
        console.error("Full error details:", JSON.stringify(createError, null, 2));
      } else {
        console.log("Successfully created", createdMatches?.length, "next round matches");
        console.log("Created matches:", createdMatches);
        
        // Immediately add winners as participants to the new matches
        await addWinnersToNewMatches(createdMatches, currentMatches);
        
        // Update bracket relationships for the newly created matches
        await setupBracketRelationships();
        
        // Refresh the matches to show the updated data
        await refreshMatchData();
      }
    } else {
      console.log("No matches to create - matchesToCreate is empty");
    }
    
    console.log("=== NEXT ROUND MATCHES CREATION COMPLETE ===");
  };

  const addWinnersToNewMatches = async (createdMatches: any[], currentMatches: any[]) => {
    console.log("=== ADDING WINNERS TO NEW MATCHES ===");
    
    for (const newMatch of createdMatches) {
      const participantsToAdd = [];
      
      // Find the previous matches for this new match
      const prevMatch1 = currentMatches.find(m => m.id === newMatch.previous_match_1_id);
      const prevMatch2 = currentMatches.find(m => m.id === newMatch.previous_match_2_id);
      
      // Add winner from previous match 1 to position 1
      if (prevMatch1 && prevMatch1.winner_id) {
        const winnerPlayer = players.find(p => p.id === prevMatch1.winner_id);
        if (winnerPlayer) {
          participantsToAdd.push({
            match_id: newMatch.id,
            player_id: winnerPlayer.id,
            position: 1,
            score: null,
            is_placeholder: false,
            placeholder_name: null
          });
          console.log(`Adding ${winnerPlayer.name} to position 1 of new match ${newMatch.id}`);
        }
      }
      
      // Add winner from previous match 2 to position 2
      if (prevMatch2 && prevMatch2.winner_id) {
        const winnerPlayer = players.find(p => p.id === prevMatch2.winner_id);
        if (winnerPlayer) {
          participantsToAdd.push({
            match_id: newMatch.id,
            player_id: winnerPlayer.id,
            position: 2,
            score: null,
            is_placeholder: false,
            placeholder_name: null
          });
          console.log(`Adding ${winnerPlayer.name} to position 2 of new match ${newMatch.id}`);
        }
      }
      
      // Insert participants if any
      if (participantsToAdd.length > 0) {
        const { error: participantError } = await supabase
          .from('match_participants')
          .insert(participantsToAdd);
          
        if (participantError) {
          console.error("Error adding participants to new match:", participantError);
        } else {
          console.log(`Successfully added ${participantsToAdd.length} participants to match ${newMatch.id}`);
        }
      }
    }
    
    console.log("=== WINNERS ADDED TO NEW MATCHES ===");
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
      console.log("=== ADVANCE WINNER DIRECTLY ===");
      console.log("Advancing winner:", winnerPlayer.name, "from match:", completedMatch.id);
      
      // Find the next match that this completed match feeds into
      const { data: nextMatch, error: nextMatchError } = await supabase
        .from('matches')
        .select('*')
        .or(`previous_match_1_id.eq.${completedMatch.id},previous_match_2_id.eq.${completedMatch.id}`)
        .maybeSingle();

      if (nextMatchError) {
        console.error("Error finding next match:", nextMatchError);
        throw nextMatchError;
      }

      if (!nextMatch) {
        console.log("No next match found - this might be the final match");
        return;
      }

      // Determine which position (1 or 2) the winner should go to
      const position = nextMatch.previous_match_1_id === completedMatch.id ? 1 : 2;
      
      console.log(`Advancing to match ${nextMatch.id}, position ${position}`);

      // Check if player is already in this match
      const { data: existingParticipant } = await supabase
        .from('match_participants')
        .select('*')
        .eq('match_id', nextMatch.id)
        .eq('player_id', winnerPlayer.id)
        .maybeSingle();

      if (existingParticipant) {
        console.log("Player already in next match, skipping");
        return;
      }

      // Check what's currently in the position we want to place the winner
      const { data: currentParticipants } = await supabase
        .from('match_participants')  
        .select('*')
        .eq('match_id', nextMatch.id)
        .order('position');

      console.log("Current participants in next match:", currentParticipants);

      // Find the correct position to insert or update
      let targetPosition = position;
      const existingAtPosition = currentParticipants?.find(p => p.position === position);

      if (existingAtPosition) {
        // Update existing participant at this position
        const { error: updateError } = await supabase
          .from('match_participants')
          .update({
            player_id: winnerPlayer.id,
            is_placeholder: false,
            placeholder_name: null,
            score: null
          })
          .eq('id', existingAtPosition.id);

        if (updateError) {
          console.error("Error updating participant:", updateError);
          throw updateError;
        }
      } else {
        // Insert new participant
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
          throw insertError;
        }
      }

      console.log(`Winner ${winnerPlayer.name} successfully advanced to next match!`);
      
      // Refresh match data to show the advanced winner in the bracket
      await refreshMatchData();
      
    } catch (error) {
      console.error('Error advancing winner:', error);
      throw error;
    }
  };

  const handleUpdateMatches = async () => {
    console.log("=== UPDATE MATCHES TRIGGERED ===");
    
    // Don't show toast to prevent flickering
    try {
      // Just regenerate bracket to show latest data
      console.log("Regenerating bracket display...");
      generateBracket();
      
      // Force a refresh from database
      await refreshMatchData();
      
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

      // Set up relationships between rounds - handle both new and legacy naming
      const totalRounds = Math.ceil(Math.log2(maxPlayers));
      
      // First get all unique round names from the database to determine naming convention
      const { data: existingRounds } = await supabase
        .from('matches')
        .select('round')
        .eq('tournament_id', tournamentId);
      
      let roundOrder: string[] = [];
      
      if (existingRounds?.some(r => r.round === 'Quarterfinals' || r.round === 'Semifinals' || r.round === 'Final')) {
        // Use legacy naming convention
        roundOrder = ["Round 1", "Quarterfinals", "Semifinals", "Final"];
      } else {
        // Use new naming convention
        for (let i = 1; i <= totalRounds; i++) {
          roundOrder.push(`Round ${i}`);
        }
      }
      
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
      let winnerName: string | null = null;
      try {
        if (updates.winner) {
          if (typeof updates.winner === 'string') {
            winnerName = updates.winner;
          } else if (typeof updates.winner === 'object' && updates.winner !== null) {
            const winnerObj = updates.winner as any;
            if (winnerObj.value && winnerObj.value !== "undefined") {
              winnerName = winnerObj.value;
            }
          }
        }
      } catch (e) {
        console.log("Error parsing winner:", e);
      }
      
      console.log("Winner detection - raw:", updates.winner, "extracted:", winnerName);
      
      if (winnerName) {
        // Handle both real players and "no opponent" scenarios
        if (winnerName.startsWith('no-opponent')) {
          // This is a placeholder winner, don't set winner_id
          matchUpdates.winner_id = null;
          console.log("Placeholder winner, not setting winner_id:", winnerName);
        } else {
          const winnerPlayer = players.find(p => p.name === winnerName);
          if (winnerPlayer) {
            matchUpdates.winner_id = winnerPlayer.id;
            console.log("✅ Setting winner_id:", winnerPlayer.id, "for winner:", winnerName);
          } else {
            console.log("❌ Could not find player ID for winner:", winnerName);
            console.log("Available players:", players.map(p => ({ id: p.id, name: p.name })));
            matchUpdates.winner_id = null;
          }
        }
      } else {
        // Clear winner if no winner is set
        matchUpdates.winner_id = null;
        console.log("Clearing winner_id - no valid winner found");
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

          // Update or create participants for position 1
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
              // Use more reliable delete + insert pattern instead of UPSERT
              try {
                // First delete existing participant for this position
                await supabase
                  .from('match_participants')
                  .delete()
                  .eq('match_id', matchId)
                  .eq('position', 1);
                
                // Then insert new participant data
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
                } else {
                  console.log("Successfully updated position 1 participant");
                }
              } catch (error) {
                console.error("Error in position 1 participant update:", error);
                throw error;
              }
            }
          }
          
          // Update or create participants for position 2
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
              // Use more reliable delete + insert pattern instead of UPSERT
              try {
                // First delete existing participant for this position
                await supabase
                  .from('match_participants')
                  .delete()
                  .eq('match_id', matchId)
                  .eq('position', 2);
                
                // Then insert new participant data
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
                } else {
                  console.log("Successfully updated position 2 participant");
                }
              } catch (error) {
                console.error("Error in position 2 participant update:", error);
                throw error;
              }
            }
          }

          console.log("=== PARTICIPANT UPDATES COMPLETED SUCCESSFULLY ===");
        } catch (participantError) {
          console.error("Error in participant update process:", participantError);
          // Don't throw here - let the match update succeed even if participant update fails
          toast({
            title: "Warning",
            description: "Match updated but there was an issue updating participant data.",
            variant: "destructive"
          });
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
          // First check if we need to create Round 2 matches
          console.log("Checking if Round 2 matches need to be created...");
          const currentRoundMatches = matches.filter(m => m.tournamentId === tournamentId && m.round === "Round 1");
          const completedRound1Matches = currentRoundMatches.filter(m => m.status === "completed");
          const round2Matches = matches.filter(m => m.tournamentId === tournamentId && m.round === "Round 2");
          
          console.log("Round 1 matches:", currentRoundMatches.length);
          console.log("Completed Round 1 matches:", completedRound1Matches.length);
          console.log("Existing Round 2 matches:", round2Matches.length);
          
          // If we have enough completed matches but no Round 2 matches, create them
          if (completedRound1Matches.length >= 2 && round2Matches.length === 0) {
            console.log("Creating Round 2 matches automatically...");
            await createNextRoundMatches("Round 1", tournamentId);
            
            // Refresh match data after creating new round
            await refreshMatchData();
            return; // Exit early to let the refresh handle the update
          }
          
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
          if (originalMatch.player1.name.startsWith('no-opponent') || originalMatch.player1.name.startsWith('No Opponent')) {
            // Handle placeholder
            participants.push({
              match_id: dbMatchId,
              player_id: null,
              position: 1,
              team_number: null,
              score: null,
              is_placeholder: true,
              placeholder_name: originalMatch.player1.name
            });
          } else {
            // Handle real player
            const player1 = players.find(p => p.name === originalMatch.player1.name);
            if (player1) {
              participants.push({
                match_id: dbMatchId,
                player_id: player1.id,
                position: 1,
                team_number: null,
                score: null,
                is_placeholder: false,
                placeholder_name: null
              });
            }
          }
        }
        
        if (originalMatch.player2) {
          if (originalMatch.player2.name.startsWith('no-opponent') || originalMatch.player2.name.startsWith('No Opponent')) {
            // Handle placeholder
            participants.push({
              match_id: dbMatchId,
              player_id: null,
              position: 2,
              team_number: null,
              score: null,
              is_placeholder: true,
              placeholder_name: originalMatch.player2.name
            });
          } else {
            // Handle real player
            const player2 = players.find(p => p.name === originalMatch.player2.name);
            if (player2) {
              participants.push({
                match_id: dbMatchId,
                player_id: player2.id,
                position: 2,
                team_number: null,
                score: null,
                is_placeholder: false,
                placeholder_name: null
              });
            }
          }
        }
        
        if (participants.length > 0) {
          // First, delete any existing participants for this match to avoid duplicates
          const { error: deleteError } = await supabase
            .from('match_participants')
            .delete()
            .eq('match_id', dbMatchId);
            
          if (deleteError) {
            console.error("Error deleting existing participants:", deleteError);
          }
          
          // Then insert the new participants
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

  // Auto-advance winners when matches are updated
  useEffect(() => {
    const autoAdvance = async () => {
      if (!tournamentId || !matches.length) return;

      const tournamentMatches = matches.filter(m => m.tournamentId === tournamentId);
      const completedMatches = tournamentMatches.filter(m => 
        m.status === "completed" && 
        m.winner &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.id)
      );

      if (completedMatches.length > 0) {
        console.log(`Found ${completedMatches.length} completed matches for auto-advancement`);
        await handleUpdateMatches();
      }
    };

    autoAdvance();
  }, [matches, tournamentId]);

  // Regenerate bracket when data changes
  useEffect(() => {
    console.log("=== REGENERATE BRACKET EFFECT ===");
    console.log("Matches length:", matches.length);
    console.log("Tournament matches:", matches.filter(m => m.tournamentId === tournamentId).length);
    
    if (matches.length > 0 && format === "matchplay") {
      generateBracket();
    }
  }, [matches, maxPlayers, tournamentId, format]);

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
                onClick={refreshMatchData}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <ManualProgressionButton
                tournamentId={tournamentId}
                players={players}
                onRefreshNeeded={refreshMatchData}
              />
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
      {bracketData.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading bracket data...</p>
        </div>
      ) : (
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
                {round.matches.map((match, matchIndex) => {
                  const handleMatchClick = () => {
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
                  };

                  return (
                    <div key={match.id} className="relative">
                      <OptimizedMatchCard 
                        match={match}
                        matchIndex={matchIndex}
                        onMatchClick={handleMatchClick}
                      />
                    
                    {/* Connection lines to next round */}
                    {roundIndex < bracketData.length - 1 && (
                      <div className="absolute top-1/2 -right-8 transform -translate-y-1/2">
                        <ChevronRight className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
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