import { useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AutoProgressionHandlerProps {
  tournamentId: string;
  players: { id: string; name: string; handicap: number; }[];
  onRefreshNeeded: () => void;
}

export function AutoProgressionHandler({ 
  tournamentId, 
  players, 
  onRefreshNeeded 
}: AutoProgressionHandlerProps) {
  const { toast } = useToast();

  useEffect(() => {
    if (!tournamentId) return;

    const checkRoundProgression = async () => {
      try {
        console.log("=== AUTO PROGRESSION CHECK ===");
        
        // Get all matches for this tournament
        const { data: allMatches, error } = await supabase
          .from('matches')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('round')
          .order('created_at');

        if (error) {
          console.error("Error fetching matches:", error);
          return;
        }

        if (!allMatches || allMatches.length === 0) {
          console.log("No matches found");
          return;
        }

        // Group matches by round
        const matchesByRound = allMatches.reduce((acc, match) => {
          if (!acc[match.round]) acc[match.round] = [];
          acc[match.round].push(match);
          return acc;
        }, {} as Record<string, any[]>);

        console.log("Matches by round:", Object.keys(matchesByRound).map(r => `${r}: ${matchesByRound[r].length}`));

        // Check Round 1 → Round 2 progression
        const round1Matches = matchesByRound['Round 1'] || [];
        const round2Matches = matchesByRound['Round 2'] || [];
        const completedRound1 = round1Matches.filter(m => m.status === 'completed' && m.winner_id);

        console.log(`Round 1: ${completedRound1.length}/${round1Matches.length} completed`);

        if (round1Matches.length > 0 && 
            completedRound1.length === round1Matches.length && 
            completedRound1.length >= 2 && 
            round2Matches.length === 0) {
          
          console.log("Creating Round 2 automatically...");
          await createRound2Automatically(completedRound1);
        }

        // Check Round 2 → Round 3 progression
        const round3Matches = matchesByRound['Round 3'] || [];
        const completedRound2 = round2Matches.filter(m => m.status === 'completed' && m.winner_id);

        if (round2Matches.length > 0 && 
            completedRound2.length === round2Matches.length && 
            completedRound2.length >= 1 && 
            round3Matches.length === 0) {
          
          console.log("Creating Round 3 automatically...");
          await createNextRound(completedRound2, 'Round 3');
        }

        // Check Round 3 → Round 4 (Final) progression
        const round4Matches = matchesByRound['Round 4'] || [];
        const completedRound3 = round3Matches.filter(m => m.status === 'completed' && m.winner_id);

        if (round3Matches.length > 0 && 
            completedRound3.length === round3Matches.length && 
            completedRound3.length >= 1 && 
            round4Matches.length === 0) {
          
          console.log("Creating Round 4 (Final) automatically...");
          await createNextRound(completedRound3, 'Round 4');
        }

      } catch (error) {
        console.error("Error in auto progression:", error);
      }
    };

    // Check immediately and then set up periodic checking
    checkRoundProgression();
    
    const interval = setInterval(checkRoundProgression, 2000);
    return () => clearInterval(interval);
  }, [tournamentId, players]);

  const createRound2Automatically = async (completedRound1Matches: any[]) => {
    try {
      console.log("Creating Round 2 with", completedRound1Matches.length, "completed Round 1 matches");
      
      // Create Round 2 matches
      const round2Matches = [];
      for (let i = 0; i < completedRound1Matches.length; i += 2) {
        const match1 = completedRound1Matches[i];
        const match2 = completedRound1Matches[i + 1];
        
        if (match1) {
          round2Matches.push({
            tournament_id: tournamentId,
            type: "singles",
            round: "Round 2",
            status: "scheduled",
            previous_match_1_id: match1.id,
            previous_match_2_id: match2?.id || null
          });
        }
      }

      const { data: createdMatches, error: createError } = await supabase
        .from('matches')
        .insert(round2Matches)
        .select();

      if (createError) throw createError;

      // Add winners as participants
      const participants = [];
      for (let i = 0; i < createdMatches.length; i++) {
        const newMatch = createdMatches[i];
        const match1 = completedRound1Matches[i * 2];
        const match2 = completedRound1Matches[i * 2 + 1];

        if (match1?.winner_id) {
          participants.push({
            match_id: newMatch.id,
            player_id: match1.winner_id,
            position: 1,
            is_placeholder: false
          });
        }

        if (match2?.winner_id) {
          participants.push({
            match_id: newMatch.id,
            player_id: match2.winner_id,
            position: 2,
            is_placeholder: false
          });
        } else if (match1) {
          // Add placeholder if only one match
          participants.push({
            match_id: newMatch.id,
            player_id: null,
            position: 2,
            is_placeholder: true,
            placeholder_name: "TBD"
          });
        }
      }

      if (participants.length > 0) {
        await supabase
          .from('match_participants')
          .insert(participants);
      }

      toast({
        title: "Round 2 Created!",
        description: `Automatically created ${createdMatches.length} Round 2 matches.`,
      });

      onRefreshNeeded();

    } catch (error) {
      console.error("Error creating Round 2:", error);
      toast({
        title: "Error",
        description: "Failed to automatically create Round 2.",
        variant: "destructive"
      });
    }
  };

  const createNextRound = async (completedMatches: any[], roundName: string) => {
    try {
      const nextRoundMatches = [];
      for (let i = 0; i < completedMatches.length; i += 2) {
        const match1 = completedMatches[i];
        const match2 = completedMatches[i + 1];
        
        if (match1) {
          nextRoundMatches.push({
            tournament_id: tournamentId,
            type: "singles",
            round: roundName,
            status: "scheduled",
            previous_match_1_id: match1.id,
            previous_match_2_id: match2?.id || null
          });
        }
      }

      const { data: createdMatches, error: createError } = await supabase
        .from('matches')
        .insert(nextRoundMatches)
        .select();

      if (createError) throw createError;

      // Add winners as participants
      const participants = [];
      for (let i = 0; i < createdMatches.length; i++) {
        const newMatch = createdMatches[i];
        const match1 = completedMatches[i * 2];
        const match2 = completedMatches[i * 2 + 1];

        if (match1?.winner_id) {
          participants.push({
            match_id: newMatch.id,
            player_id: match1.winner_id,
            position: 1,
            is_placeholder: false
          });
        }

        if (match2?.winner_id) {
          participants.push({
            match_id: newMatch.id,
            player_id: match2.winner_id,
            position: 2,
            is_placeholder: false
          });
        }
      }

      if (participants.length > 0) {
        await supabase
          .from('match_participants')
          .insert(participants);
      }

      toast({
        title: `${roundName} Created!`,
        description: `Automatically created ${createdMatches.length} ${roundName} matches.`,
      });

      onRefreshNeeded();

    } catch (error) {
      console.error(`Error creating ${roundName}:`, error);
    }
  };

  return null; // This is a logic-only component
}