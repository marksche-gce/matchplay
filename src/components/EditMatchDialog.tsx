import { useState } from "react";
import { Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

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
  type: "singles" | "foursome";
  player1?: Player;
  player2?: Player;
  team1?: Team;
  team2?: Team;
  round: string;
  status: "scheduled" | "completed";
  date: string;
  time: string;
  tee?: string;
  winner?: string;
}

interface EditMatchDialogProps {
  match: Match;
  onMatchUpdate: (matchId: string, updates: Partial<Match>) => void;
  trigger?: React.ReactNode;
  availablePlayers?: Player[];
  tournamentStartDate?: string;
  tournamentEndDate?: string;
}

export function EditMatchDialog({ match, onMatchUpdate, trigger, availablePlayers = [], tournamentStartDate, tournamentEndDate }: EditMatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    round: match.round,
    status: match.status,
    player1Score: match.player1?.score?.toString() || "",
    player2Score: match.player2?.score?.toString() || "",
    winner: match.winner || "",
    player1Name: match.player1?.name || "",
    player2Name: match.player2?.name || ""
  });
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates: Partial<Match> = {
      round: formData.round,
      status: formData.status as Match["status"],
      winner: formData.winner === "no-winner" ? undefined : formData.winner
    };

    if (match.type === "singles") {
      const selectedPlayer1 = availablePlayers.find(p => p.name === formData.player1Name);
      const selectedPlayer2 = availablePlayers.find(p => p.name === formData.player2Name);
      
      updates.player1 = selectedPlayer1 ? {
        ...selectedPlayer1,
        score: formData.player1Score ? parseInt(formData.player1Score) : undefined
      } : match.player1;
      
      updates.player2 = selectedPlayer2 ? {
        ...selectedPlayer2,
        score: formData.player2Score ? parseInt(formData.player2Score) : undefined
      } : match.player2;
    }

    onMatchUpdate(match.id, updates);

    toast({
      title: "Match Updated!",
      description: `${match.round} has been successfully updated.`,
    });

    setOpen(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Edit3 className="h-4 w-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Edit Match
          </DialogTitle>
        </DialogHeader>

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
                <SelectContent>
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
                      <SelectContent>
                        {availablePlayers.map(player => (
                          <SelectItem key={player.name} value={player.name}>
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
                      <SelectContent>
                        {availablePlayers.map(player => (
                          <SelectItem key={player.name} value={player.name}>
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
                        <SelectContent>
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
      </DialogContent>
    </Dialog>
  );
}