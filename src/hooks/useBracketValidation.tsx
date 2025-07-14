import { useCallback } from "react";
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
  time: string;
  tee?: string;
  winner?: string;
  nextMatchId?: string;
  previousMatch1Id?: string;
  previousMatch2Id?: string;
}

export function useBracketValidation() {
  const { toast } = useToast();

  const validateWinner = useCallback((match: Match, winner: string): boolean => {
    if (!winner) return false;

    if (match.type === "singles") {
      const validWinners = [match.player1?.name, match.player2?.name].filter(Boolean);
      const isValid = validWinners.includes(winner);
      
      if (!isValid) {
        toast({
          title: "Invalid Winner Selection",
          description: `${winner} did not participate in this match. Valid winners are: ${validWinners.join(", ")}`,
          variant: "destructive"
        });
      }
      
      return isValid;
    } else if (match.type === "foursome") {
      const validWinners = ["team1", "team2"];
      const isValid = validWinners.includes(winner);
      
      if (!isValid) {
        toast({
          title: "Invalid Winner Selection",
          description: `Winner must be either "team1" or "team2" for foursome matches.`,
          variant: "destructive"
        });
      }
      
      return isValid;
    }

    return false;
  }, [toast]);

  const validateMatchCompletion = useCallback((match: Match): boolean => {
    // Check if match has required participants
    if (match.type === "singles") {
      if (!match.player1 || !match.player2) {
        toast({
          title: "Incomplete Match Setup",
          description: "Both players must be assigned before completing the match.",
          variant: "destructive"
        });
        return false;
      }
    } else if (match.type === "foursome") {
      if (!match.team1 || !match.team2) {
        toast({
          title: "Incomplete Match Setup",
          description: "Both teams must be assigned before completing the match.",
          variant: "destructive"
        });
        return false;
      }
    }

    // Check if scores are provided for completed matches
    if (match.status === "completed") {
      if (match.type === "singles") {
        if (match.player1?.score === undefined || match.player2?.score === undefined) {
          toast({
            title: "Missing Scores",
            description: "Both player scores must be provided to complete the match.",
            variant: "destructive"
          });
          return false;
        }
      } else if (match.type === "foursome") {
        if (match.team1?.teamScore === undefined || match.team2?.teamScore === undefined) {
          toast({
            title: "Missing Scores",
            description: "Both team scores must be provided to complete the match.",
            variant: "destructive"
          });
          return false;
        }
      }
    }

    return true;
  }, [toast]);

  const validateProgression = useCallback((matches: Match[], completedMatch: Match): boolean => {
    // Check if there are any incomplete matches in earlier rounds
    const currentRoundNumber = getRoundNumber(completedMatch.round);
    const earlierMatches = matches.filter(m => {
      const matchRoundNumber = getRoundNumber(m.round);
      return matchRoundNumber < currentRoundNumber && m.status !== "completed";
    });

    if (earlierMatches.length > 0) {
      toast({
        title: "Progression Error",
        description: `Cannot complete matches in ${completedMatch.round} while earlier rounds have incomplete matches.`,
        variant: "destructive"
      });
      return false;
    }

    // Check if both source matches are completed for advancement matches
    if (completedMatch.previousMatch1Id || completedMatch.previousMatch2Id) {
      const sourceMatch1 = matches.find(m => m.id === completedMatch.previousMatch1Id);
      const sourceMatch2 = matches.find(m => m.id === completedMatch.previousMatch2Id);

      if (sourceMatch1 && sourceMatch1.status !== "completed") {
        toast({
          title: "Source Match Incomplete",
          description: "Previous matches must be completed before this match can begin.",
          variant: "destructive"
        });
        return false;
      }

      if (sourceMatch2 && sourceMatch2.status !== "completed") {
        toast({
          title: "Source Match Incomplete",
          description: "Previous matches must be completed before this match can begin.",
          variant: "destructive"
        });
        return false;
      }
    }

    return true;
  }, [toast]);

  const preventNonWinnerAdvancement = useCallback((matches: Match[], match: Match): boolean => {
    // If this match has previous matches, ensure participants are winners from those matches
    if (match.previousMatch1Id || match.previousMatch2Id) {
      if (match.previousMatch1Id) {
        const sourceMatch1 = matches.find(m => m.id === match.previousMatch1Id);
        if (sourceMatch1 && sourceMatch1.status === "completed") {
          // Check if the advanced player/team is actually the winner
          if (match.type === "singles" && match.player1) {
            if (sourceMatch1.winner !== match.player1.name) {
              toast({
                title: "Invalid Advancement",
                description: `${match.player1.name} cannot advance as they did not win their previous match.`,
                variant: "destructive"
              });
              return false;
            }
          } else if (match.type === "foursome" && match.team1) {
            if (sourceMatch1.winner !== "team1" && sourceMatch1.winner !== "team2") {
              toast({
                title: "Invalid Advancement",
                description: "Invalid team advancement detected.",
                variant: "destructive"
              });
              return false;
            }
          }
        }
      }

      if (match.previousMatch2Id) {
        const sourceMatch2 = matches.find(m => m.id === match.previousMatch2Id);
        if (sourceMatch2 && sourceMatch2.status === "completed") {
          // Check if the advanced player/team is actually the winner
          if (match.type === "singles" && match.player2) {
            if (sourceMatch2.winner !== match.player2.name) {
              toast({
                title: "Invalid Advancement",
                description: `${match.player2.name} cannot advance as they did not win their previous match.`,
                variant: "destructive"
              });
              return false;
            }
          } else if (match.type === "foursome" && match.team2) {
            if (sourceMatch2.winner !== "team1" && sourceMatch2.winner !== "team2") {
              toast({
                title: "Invalid Advancement",
                description: "Invalid team advancement detected.",
                variant: "destructive"
              });
              return false;
            }
          }
        }
      }
    }

    return true;
  }, [toast]);

  const getRoundNumber = (roundName: string): number => {
    switch (roundName.toLowerCase()) {
      case "round 1": return 1;
      case "round 2": return 2;
      case "round 3": return 3;
      case "quarterfinals": return 4;
      case "semifinals": return 5;
      case "final": return 6;
      default: return parseInt(roundName.replace(/\D/g, '')) || 0;
    }
  };

  return {
    validateWinner,
    validateMatchCompletion,
    validateProgression,
    preventNonWinnerAdvancement
  };
}