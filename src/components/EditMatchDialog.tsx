import { useState, useEffect } from "react";
import { Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useBracketValidation } from "@/hooks/useBracketValidation";

interface Player {
  name: string;
  handicap: number;
}

interface Team {
  player1: Player;
  player2: Player;
  teamScore?: number;
}

interface Match {
  id: string;
  tournamentId: string;
  type: "singles" | "foursome";
  player1?: Player;
  player2?: Player;
  team1?: Team;
  team2?: Team;
  round: string;
  status: "scheduled" | "completed";
  date: string;
  time: string | null;
  tee?: string;
  winner?: string;
  nextMatchId?: string;
  previousMatch1Id?: string;
  previousMatch2Id?: string;
}

interface EditMatchDialogProps {
  match: Match;
  onMatchUpdate: (matchId: string, updates: Partial<Match>) => void;
  trigger?: React.ReactNode;
  availablePlayers?: Player[];
  allPlayers?: { id: string; name: string; handicap: number; }[];
  tournamentStartDate?: string;
  tournamentEndDate?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  maxPlayers?: number;
  registeredPlayers?: number;
}

export function EditMatchDialog({ 
  match, 
  onMatchUpdate, 
  trigger, 
  availablePlayers = [], 
  allPlayers = [],
  tournamentStartDate, 
  tournamentEndDate,
  open: controlledOpen,
  onOpenChange,
  maxPlayers = 32,
  registeredPlayers = 0
}: EditMatchDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [formData, setFormData] = useState({
    round: match?.round || "",
    status: match?.status || "scheduled",
    winner: match?.winner || "",
    player1Name: match?.player1?.name || "no-player",
    player2Name: match?.player2?.name || "no-player"
  });

  // Update form data when match changes
  useEffect(() => {
    if (match) {
      setFormData({
        round: match.round || "",
        status: match.status || "scheduled",
        winner: match.winner || "",
        player1Name: match.player1?.name || "no-player",
        player2Name: match.player2?.name || "no-player"
      });
    }
  }, [match]);
  const { toast } = useToast();
  const { validateWinner, validateMatchCompletion } = useBracketValidation();

  // Calculate number of free wins needed
  const freeWinsNeeded = Math.max(0, maxPlayers - registeredPlayers);
  
  // Generate "no opponent" options based on free wins needed
  const noOpponentOptions = Array.from({ length: freeWinsNeeded }, (_, index) => ({
    value: `no-opponent-${index + 1}`,
    label: `No Opponent ${index + 1}`
  }));

  console.log("EditMatchDialog rendering with match:", match);
  console.log("EditMatchDialog open state:", isOpen);
  console.log("EditMatchDialog available players:", allPlayers?.length || availablePlayers?.length);
  console.log("Max players:", maxPlayers, "Registered players:", registeredPlayers);
  console.log("Free wins needed:", freeWinsNeeded);
  console.log("No opponent options:", noOpponentOptions);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!match) {
      toast({
        title: "Error",
        description: "Match data not available",
        variant: "destructive"
      });
      return;
    }
    
    console.log("=== EDIT MATCH DIALOG DEBUG ===");
    console.log("EditMatchDialog handleSubmit called with formData:", formData);
    console.log("Match being updated:", match);
    console.log("Available players passed to dialog:", allPlayers.length > 0 ? allPlayers : availablePlayers);
    
    // Apply auto-winner logic before creating updates
    const finalFormData = { ...formData };
    const player1IsNoPlayer = finalFormData.player1Name === "no-player" || finalFormData.player1Name?.startsWith("no-opponent");
    const player2IsNoPlayer = finalFormData.player2Name === "no-player" || finalFormData.player2Name?.startsWith("no-opponent");
    
    console.log("=== SUBMIT AUTO-WINNER CHECK ===");
    console.log("Player 1:", finalFormData.player1Name, "is no player:", player1IsNoPlayer);
    console.log("Player 2:", finalFormData.player2Name, "is no player:", player2IsNoPlayer);
    console.log("Player 1 name value:", JSON.stringify(finalFormData.player1Name));
    console.log("Player 2 name value:", JSON.stringify(finalFormData.player2Name));
    
    if (player1IsNoPlayer && !player2IsNoPlayer && finalFormData.player2Name) {
      // Player 1 has no opponent, Player 2 wins automatically
      console.log("🎯 SUBMIT: Player 2 wins automatically -", finalFormData.player2Name);
      finalFormData.status = "completed";
      finalFormData.winner = finalFormData.player2Name;
    } else if (player2IsNoPlayer && !player1IsNoPlayer && finalFormData.player1Name) {
      // Player 2 has no opponent, Player 1 wins automatically
      console.log("🎯 SUBMIT: Player 1 wins automatically -", finalFormData.player1Name);
      finalFormData.status = "completed";
      finalFormData.winner = finalFormData.player1Name;
    } else {
      console.log("❌ NO AUTO-WINNER TRIGGERED");
      console.log("Conditions: player1IsNoPlayer:", player1IsNoPlayer, "player2IsNoPlayer:", player2IsNoPlayer);
      console.log("Player names:", finalFormData.player1Name, finalFormData.player2Name);
    }
    
    console.log("Final form data before creating updates:", finalFormData);
    console.log("Final status:", finalFormData.status);
    console.log("Final winner:", finalFormData.winner);
    console.log("=== END SUBMIT AUTO-WINNER ===");
    
    const updates: Partial<Match> = {
      round: finalFormData.round,
      status: finalFormData.status as Match["status"]
    };

    // Handle winner selection properly
    if (finalFormData.status === "completed") {
      if (finalFormData.winner && finalFormData.winner !== "no-winner") {
        updates.winner = finalFormData.winner;
        console.log("Setting winner to:", finalFormData.winner);
      } else {
        updates.winner = undefined;
        console.log("No winner selected or explicitly set to no-winner");
      }
    } else {
      updates.winner = undefined;
      console.log("Match not completed, clearing winner");
    }

    // Create updated match for validation
    const updatedMatch = { ...match, ...updates };

    if (match.type === "singles") {
      // Use allPlayers if available, otherwise fallback to availablePlayers
      const playersToSearch = allPlayers.length > 0 ? allPlayers : availablePlayers;
      
      const selectedPlayer1 = playersToSearch.find(p => p.name === finalFormData.player1Name);
      const selectedPlayer2 = playersToSearch.find(p => p.name === finalFormData.player2Name);
      
      // Handle "no-opponent" assignments properly for player1
      if (finalFormData.player1Name && finalFormData.player1Name !== "no-player") {
        if (finalFormData.player1Name.startsWith("no-opponent")) {
          // This is a "no opponent" placeholder
          updates.player1 = {
            name: finalFormData.player1Name,
            handicap: 0
          };
        } else {
          // This is a real player
          const selectedPlayer1 = playersToSearch.find(p => p.name === finalFormData.player1Name);
          if (selectedPlayer1) {
            updates.player1 = {
              name: selectedPlayer1.name,
              handicap: selectedPlayer1.handicap
            };
          }
        }
      } else {
        updates.player1 = undefined;
      }
      
      // Handle "no-opponent" assignments properly for player2  
      if (finalFormData.player2Name && finalFormData.player2Name !== "no-player") {
        if (finalFormData.player2Name.startsWith("no-opponent")) {
          // This is a "no opponent" placeholder
          updates.player2 = {
            name: finalFormData.player2Name,
            handicap: 0
          };
        } else {
          // This is a real player
          const selectedPlayer2 = playersToSearch.find(p => p.name === finalFormData.player2Name);
          if (selectedPlayer2) {
            updates.player2 = {
              name: selectedPlayer2.name,
              handicap: selectedPlayer2.handicap
            };
          }
        }
      } else {
        updates.player2 = undefined;
      }
      
      // Update the validation match
      updatedMatch.player1 = updates.player1;
      updatedMatch.player2 = updates.player2;
    }

    // Validate match completion
    if (!validateMatchCompletion(updatedMatch)) {
      return;
    }

    // Validate winner if match is completed
    if (updatedMatch.status === "completed" && updatedMatch.winner) {
      if (!validateWinner(updatedMatch, updatedMatch.winner)) {
        return;
      }
    }

    console.log("=== FINAL MATCH UPDATE ===");
    console.log("About to call onMatchUpdate with match ID:", match.id);
    console.log("Final updates object:", updates);
    console.log("Updated match will have player1:", updates.player1);
    console.log("Updated match will have player2:", updates.player2);
    console.log("=== END FINAL UPDATE ===");
    
    console.log("Calling onMatchUpdate with:", match.id, updates);
    onMatchUpdate(match.id, updates);

    toast({
      title: "Match Updated!",
      description: `${match.round} has been successfully updated.`,
    });

    setOpen(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-complete match when winner is selected
      if (field === "winner" && value && value !== "no-winner") {
        newData.status = "completed";
      }
      // Auto-schedule match when winner is cleared
      if (field === "winner" && (value === "no-winner" || value === "")) {
        newData.status = "scheduled";
      }
      
      // Auto-complete match with "no opponent" and set winner
      if (field === "player1Name" || field === "player2Name") {
        const player1Value = field === "player1Name" ? value : newData.player1Name;
        const player2Value = field === "player2Name" ? value : newData.player2Name;
        
        console.log("=== AUTO-WINNER LOGIC ===");
        console.log("Player 1 value:", player1Value);
        console.log("Player 2 value:", player2Value);
        
        const player1IsNoPlayer = player1Value === "no-player" || player1Value?.startsWith("no-opponent");
        const player2IsNoPlayer = player2Value === "no-player" || player2Value?.startsWith("no-opponent");
        
        console.log("Player 1 is no player:", player1IsNoPlayer);
        console.log("Player 2 is no player:", player2IsNoPlayer);
        
        if (player1IsNoPlayer && !player2IsNoPlayer && player2Value) {
          // Player 1 has no opponent, Player 2 wins automatically
          console.log("AUTO-WIN: Player 2 wins automatically -", player2Value);
          newData.status = "completed";
          newData.winner = player2Value;
        } else if (player2IsNoPlayer && !player1IsNoPlayer && player1Value) {
          // Player 2 has no opponent (free pass), Player 1 wins automatically
          console.log("AUTO-WIN: Player 1 wins automatically -", player1Value);
          newData.status = "completed";
          newData.winner = player1Value;
        } else if (!player1IsNoPlayer && !player2IsNoPlayer) {
          // Both are real players, reset to scheduled if not manually completed
          if (newData.status === "completed" && !newData.winner) {
            newData.status = "scheduled";
          }
        }
        console.log("Final status:", newData.status);
        console.log("Final winner:", newData.winner);
        console.log("=== END AUTO-WINNER ===");
      }
      
      return newData;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Edit3 className="h-4 w-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md z-50 bg-background border shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Edit Match - {match?.round || 'Unknown Round'}
          </DialogTitle>
        </DialogHeader>

        {!match ? (
          <div className="p-4 text-center">
            <p className="text-muted-foreground">Match data not available</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="round">Round</Label>
                <Input
                  id="round"
                  value={formData.round}
                  onChange={(e) => handleInputChange("round", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {match.type === "singles" && (
                <div className="space-y-4 border-t pt-4">
                  <Label className="text-base font-semibold">Players</Label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="player1">Player 1</Label>
                      <Select value={formData.player1Name} onValueChange={(value) => handleInputChange("player1Name", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select player 1" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border z-50">
                          <SelectItem value="no-player">No Player</SelectItem>
                          {(allPlayers.length > 0 ? allPlayers : availablePlayers)
                            .filter(player => formData.player2Name !== "no-opponent" ? player.name !== formData.player2Name : true)
                            .sort((a, b) => a.handicap - b.handicap)
                             .map((player, index) => (
                               <SelectItem key={`player1-${player.name}-${index}`} value={player.name}>
                                {player.name} (HC: {player.handicap})
                              </SelectItem>
                            ))}
                          {noOpponentOptions.map((option) => (
                            <SelectItem key={`player1-${option.value}`} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="player2">Player 2</Label>
                      <Select value={formData.player2Name} onValueChange={(value) => handleInputChange("player2Name", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select player 2" />
                        </SelectTrigger>
                         <SelectContent className="bg-background border z-50">
                           <SelectItem value="no-player">No Player</SelectItem>
                           {(allPlayers.length > 0 ? allPlayers : availablePlayers)
                             .filter(player => formData.player1Name !== "no-player" ? player.name !== formData.player1Name : true)
                             .sort((a, b) => a.handicap - b.handicap)
                             .map((player, index) => (
                               <SelectItem key={`player2-${player.name}-${index}`} value={player.name}>
                                 {player.name} (HC: {player.handicap})
                               </SelectItem>
                             ))}
                           {noOpponentOptions.map((option) => (
                             <SelectItem key={option.value} value={option.value}>
                               {option.label}
                             </SelectItem>
                           ))}
                         </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
              
              {formData.status === "completed" && (
                <div className="space-y-4 border-t pt-4">
                  <Label className="text-base font-semibold">Match Results</Label>
                  
                  {match.type === "singles" && (
                    <div className="space-y-2">
                      <Label htmlFor="winner">Winner</Label>
                      <Select value={formData.winner} onValueChange={(value) => handleInputChange("winner", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select winner" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border z-50">
                          <SelectItem value="no-winner">(No winner yet)</SelectItem>
                          {formData.player1Name && <SelectItem value={formData.player1Name}>{formData.player1Name}</SelectItem>}
                          {formData.player2Name && <SelectItem value={formData.player2Name}>{formData.player2Name}</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" variant="default" className="flex-1">
                Update Match
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}