import { useState } from "react";
import { Users, User, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Player {
  id: string;
  name: string;
  email?: string;
  handicap: number;
  wins: number;
  losses: number;
  status: "active" | "eliminated" | "champion";
}

interface MatchPlayer {
  name: string;
  handicap: number;
  score?: number;
}

interface Team {
  player1: MatchPlayer;
  player2: MatchPlayer;
  teamScore?: number;
}

interface Match {
  id: string;
  tournamentId: string;
  type: "singles" | "foursome";
  player1?: MatchPlayer;
  player2?: MatchPlayer;
  team1?: Team;
  team2?: Team;
  round: string;
  status: "scheduled" | "completed";
  date: string;
  time: string | null;
  tee?: string;
  winner?: string;
}

interface CreateMatchDialogProps {
  tournamentId: string;
  availablePlayers: Player[];
  onMatchCreate: (match: Omit<Match, "id">) => void;
  trigger?: React.ReactNode;
  tournamentStartDate?: string;
  tournamentEndDate?: string;
}

export function CreateMatchDialog({ 
  tournamentId, 
  availablePlayers, 
  onMatchCreate, 
  trigger,
  tournamentStartDate,
  tournamentEndDate
}: CreateMatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [matchType, setMatchType] = useState<"singles" | "foursome">("singles");
  const [formData, setFormData] = useState({
    round: "",
    // Singles
    player1Id: "",
    player2Id: "",
    // Foursome
    team1Player1Id: "",
    team1Player2Id: "",
    team2Player1Id: "",
    team2Player2Id: ""
  });
  
  const { toast } = useToast();

  const getPlayerById = (id: string) => availablePlayers.find(p => p.id === id);

  const getUsedPlayerIds = () => {
    const ids = [];
    if (matchType === "singles") {
      if (formData.player1Id) ids.push(formData.player1Id);
      if (formData.player2Id) ids.push(formData.player2Id);
    } else {
      if (formData.team1Player1Id) ids.push(formData.team1Player1Id);
      if (formData.team1Player2Id) ids.push(formData.team1Player2Id);
      if (formData.team2Player1Id) ids.push(formData.team2Player1Id);
      if (formData.team2Player2Id) ids.push(formData.team2Player2Id);
    }
    return ids;
  };

  const getAvailablePlayersForSelect = (currentFieldId?: string) => {
    const usedIds = getUsedPlayerIds();
    return availablePlayers.filter(p => 
      !usedIds.includes(p.id) || p.id === currentFieldId
    );
  };

  const handleCreateMatch = () => {
    // Validation
    if (!formData.round.trim()) {
      toast({
        title: "Round Required",
        description: "Please enter a round name.",
        variant: "destructive"
      });
      return;
    }

    if (matchType === "singles") {
      if (!formData.player1Id || !formData.player2Id) {
        toast({
          title: "Players Required",
          description: "Please select both players for the singles match.",
          variant: "destructive"
        });
        return;
      }

      if (formData.player1Id === formData.player2Id) {
        toast({
          title: "Invalid Selection",
          description: "A player cannot play against themselves.",
          variant: "destructive"
        });
        return;
      }
    } else {
      if (!formData.team1Player1Id || !formData.team1Player2Id || 
          !formData.team2Player1Id || !formData.team2Player2Id) {
        toast({
          title: "Teams Incomplete",
          description: "Please select all four players for the foursome match.",
          variant: "destructive"
        });
        return;
      }

      const allPlayerIds = [
        formData.team1Player1Id,
        formData.team1Player2Id,
        formData.team2Player1Id,
        formData.team2Player2Id
      ];
      const uniqueIds = new Set(allPlayerIds);
      
      if (uniqueIds.size !== 4) {
        toast({
          title: "Duplicate Players",
          description: "Each player can only be selected once in a foursome match.",
          variant: "destructive"
        });
        return;
      }
    }

    // Create match object
    const match: Omit<Match, "id"> = {
      tournamentId,
      type: matchType,
      round: formData.round,
      status: "scheduled",
      date: tournamentStartDate || new Date().toISOString().split('T')[0],
      time: null,
      tee: undefined
    };

    if (matchType === "singles") {
      const player1 = getPlayerById(formData.player1Id)!;
      const player2 = getPlayerById(formData.player2Id)!;
      
      match.player1 = {
        name: player1.name,
        handicap: player1.handicap
      };
      match.player2 = {
        name: player2.name,
        handicap: player2.handicap
      };
    } else {
      const team1Player1 = getPlayerById(formData.team1Player1Id)!;
      const team1Player2 = getPlayerById(formData.team1Player2Id)!;
      const team2Player1 = getPlayerById(formData.team2Player1Id)!;
      const team2Player2 = getPlayerById(formData.team2Player2Id)!;

      match.team1 = {
        player1: { name: team1Player1.name, handicap: team1Player1.handicap },
        player2: { name: team1Player2.name, handicap: team1Player2.handicap }
      };
      match.team2 = {
        player1: { name: team2Player1.name, handicap: team2Player1.handicap },
        player2: { name: team2Player2.name, handicap: team2Player2.handicap }
      };
    }

    onMatchCreate(match);
    
    // Reset form
    setFormData({
      round: "",
      player1Id: "",
      player2Id: "",
      team1Player1Id: "",
      team1Player2Id: "",
      team2Player1Id: "",
      team2Player2Id: ""
    });
    
    setOpen(false);
    
    toast({
      title: "Match Created",
      description: `${matchType === "singles" ? "Singles" : "Foursome"} match has been scheduled successfully.`,
    });
  };

  const resetForm = () => {
    setFormData({
      round: "",
      player1Id: "",
      player2Id: "",
      team1Player1Id: "",
      team1Player2Id: "",
      team2Player1Id: "",
      team2Player2Id: ""
    });
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Match
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Match</DialogTitle>
          <DialogDescription>
            Set up a new match by selecting players and configuring match details.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Match Type Selection */}
          <div className="space-y-2">
            <Label>Match Type</Label>
            <Tabs value={matchType} onValueChange={(value: "singles" | "foursome") => {
              setMatchType(value);
              resetForm();
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="singles" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Singles
                </TabsTrigger>
                <TabsTrigger value="foursome" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Foursome
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Player Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Player Selection</Label>
            
            {matchType === "singles" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Player 1</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={formData.player1Id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, player1Id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Player 1" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailablePlayersForSelect(formData.player1Id).map(player => (
                          <SelectItem key={player.id} value={player.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{player.name}</span>
                              <Badge variant="outline" className="ml-2">HC: {player.handicap}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Player 2</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={formData.player2Id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, player2Id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Player 2" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailablePlayersForSelect(formData.player2Id).map(player => (
                          <SelectItem key={player.id} value={player.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{player.name}</span>
                              <Badge variant="outline" className="ml-2">HC: {player.handicap}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Team 1</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Player 1</Label>
                      <Select
                        value={formData.team1Player1Id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, team1Player1Id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Player" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailablePlayersForSelect(formData.team1Player1Id).map(player => (
                            <SelectItem key={player.id} value={player.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{player.name}</span>
                                <Badge variant="outline" className="ml-2">HC: {player.handicap}</Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Player 2</Label>
                      <Select
                        value={formData.team1Player2Id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, team1Player2Id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Player" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailablePlayersForSelect(formData.team1Player2Id).map(player => (
                            <SelectItem key={player.id} value={player.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{player.name}</span>
                                <Badge variant="outline" className="ml-2">HC: {player.handicap}</Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Team 2</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Player 1</Label>
                      <Select
                        value={formData.team2Player1Id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, team2Player1Id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Player" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailablePlayersForSelect(formData.team2Player1Id).map(player => (
                            <SelectItem key={player.id} value={player.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{player.name}</span>
                                <Badge variant="outline" className="ml-2">HC: {player.handicap}</Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Player 2</Label>
                      <Select
                        value={formData.team2Player2Id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, team2Player2Id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Player" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailablePlayersForSelect(formData.team2Player2Id).map(player => (
                            <SelectItem key={player.id} value={player.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{player.name}</span>
                                <Badge variant="outline" className="ml-2">HC: {player.handicap}</Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Match Details */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Match Details</Label>
            
            <div>
              <Label htmlFor="round">Round/Stage</Label>
              <Input
                id="round"
                placeholder="e.g., Quarterfinal 1, Round 1"
                value={formData.round}
                onChange={(e) => setFormData(prev => ({ ...prev, round: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateMatch}>
            Create Match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}