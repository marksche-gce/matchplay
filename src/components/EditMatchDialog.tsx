import { useState } from "react";
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
  score?: number;
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
  onOpenChange
}: EditMatchDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [formData, setFormData] = useState({
    round: match?.round || "",
    status: match?.status || "scheduled",
    player1Score: match?.player1?.score?.toString() || "",
    player2Score: match?.player2?.score?.toString() || "",
    winner: match?.winner || "",
    player1Name: match?.player1?.name || "no-player",
    player2Name: match?.player2?.name || "no-opponent"
  });
  const { toast } = useToast();
  const { validateWinner, validateMatchCompletion } = useBracketValidation();

  console.log("EditMatchDialog rendering with match:", match);
  console.log("EditMatchDialog open state:", isOpen);
  console.log("EditMatchDialog available players:", allPlayers?.length || availablePlayers?.length);

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
    
    console.log("EditMatchDialog handleSubmit called with formData:", formData);
    
    const updates: Partial<Match> = {
      round: formData.round,
      status: formData.status as Match["status"]
    };

    // Handle winner selection properly
    if (formData.status === "completed") {
      if (formData.winner && formData.winner !== "no-winner") {
        updates.winner = formData.winner;
        console.log("Setting winner to:", formData.winner);
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
      
      const selectedPlayer1 = playersToSearch.find(p => p.name === formData.player1Name);
      const selectedPlayer2 = playersToSearch.find(p => p.name === formData.player2Name);
      
      updates.player1 = selectedPlayer1 ? {
        name: selectedPlayer1.name,
        handicap: selectedPlayer1.handicap,
        score: formData.player1Score ? parseInt(formData.player1Score) : undefined
      } : (formData.player1Name && formData.player1Name !== "no-player" ? match.player1 : undefined);
      
      updates.player2 = selectedPlayer2 ? {
        name: selectedPlayer2.name,
        handicap: selectedPlayer2.handicap,
        score: formData.player2Score ? parseInt(formData.player2Score) : undefined
      } : (formData.player2Name && formData.player2Name !== "no-opponent" ? match.player2 : undefined);
      
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
                          <SelectItem value="no-opponent">No Opponent</SelectItem>
                          {(allPlayers.length > 0 ? allPlayers : availablePlayers)
                            .filter(player => formData.player1Name !== "no-player" ? player.name !== formData.player1Name : true)
                            .sort((a, b) => a.handicap - b.handicap)
                            .map((player, index) => (
                              <SelectItem key={`player2-${player.name}-${index}`} value={player.name}>
                                {player.name} (HC: {player.handicap})
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
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="player1Score">{formData.player1Name || "Player 1"} Score</Label>
                          <Input
                            id="player1Score"
                            type="number"
                            placeholder="Score"
                            value={formData.player1Score}
                            onChange={(e) => handleInputChange("player1Score", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="player2Score">{formData.player2Name || "Player 2"} Score</Label>
                          <Input
                            id="player2Score"
                            type="number"
                            placeholder="Score"
                            value={formData.player2Score}
                            onChange={(e) => handleInputChange("player2Score", e.target.value)}
                          />
                        </div>
                      </div>

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
                    </>
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