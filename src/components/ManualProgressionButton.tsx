import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ManualProgressionButtonProps {
  tournamentId: string;
  players: { id: string; name: string; handicap: number; }[];
  onRefreshNeeded: () => void;
}

export function ManualProgressionButton({ 
  tournamentId, 
  players, 
  onRefreshNeeded 
}: ManualProgressionButtonProps) {
  const [isProgressing, setIsProgressing] = useState(false);
  const { toast } = useToast();

  const progressToNextRound = async () => {
    setIsProgressing(true);
    
    try {
      // Get all matches for this tournament
      const { data: allMatches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round')
        .order('created_at');

      if (error) throw error;

      if (!allMatches || allMatches.length === 0) {
        toast({
          title: "Keine Spiele gefunden",
          description: "Für dieses Turnier existieren keine Spiele.",
          variant: "destructive"
        });
        return;
      }

      // Group matches by round
      const matchesByRound = allMatches.reduce((acc, match) => {
        if (!acc[match.round]) acc[match.round] = [];
        acc[match.round].push(match);
        return acc;
      }, {} as Record<string, any[]>);

      // Find the current active round that needs progression
      const round1Matches = matchesByRound['Round 1'] || [];
      const round2Matches = matchesByRound['Round 2'] || [];
      const round3Matches = matchesByRound['Round 3'] || [];
      
      const completedRound1 = round1Matches.filter(m => m.status === 'completed' && m.winner_id);
      const completedRound2 = round2Matches.filter(m => m.status === 'completed' && m.winner_id);
      const completedRound3 = round3Matches.filter(m => m.status === 'completed' && m.winner_id);

      // Check what round we can progress to
      if (round1Matches.length > 0 && 
          completedRound1.length === round1Matches.length && 
          completedRound1.length >= 2 && 
          round2Matches.length === 0) {
        
        await createNextRound(completedRound1, 'Round 2');
        
      } else if (round2Matches.length > 0 && 
                 completedRound2.length === round2Matches.length && 
                 completedRound2.length >= 1 && 
                 round3Matches.length === 0) {
        
        await createNextRound(completedRound2, 'Round 3');
        
      } else if (round3Matches.length > 0 && 
                 completedRound3.length === round3Matches.length && 
                 completedRound3.length >= 1 && 
                 (matchesByRound['Round 4'] || []).length === 0) {
        
        await createNextRound(completedRound3, 'Round 4');
        
      } else {
        toast({
          title: "Keine Weiterleitung möglich",
          description: "Entweder sind alle Runden abgeschlossen oder aktuelle Rundenspiele sind nicht beendet.",
        });
      }

    } catch (error) {
      console.error("Error progressing round:", error);
      toast({
        title: "Fehler",
        description: "Weiterleitung zur nächsten Runde fehlgeschlagen.",
        variant: "destructive"
      });
    } finally {
      setIsProgressing(false);
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
        } else if (match1 && !match2) {
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
        title: `${roundName} erstellt!`,
        description: `${createdMatches.length} ${roundName} Spiele erfolgreich erstellt.`,
      });

      onRefreshNeeded();

    } catch (error) {
      console.error(`Error creating ${roundName}:`, error);
      throw error;
    }
  };

  return (
    <Button
      onClick={progressToNextRound}
      disabled={isProgressing}
      variant="default"
      className="gap-2"
    >
      {isProgressing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ChevronRight className="h-4 w-4" />
      )}
      {isProgressing ? "Wird weitergeleitet..." : "Runde weiterleiten"}
    </Button>
  );
}