import { useState } from "react";
import { Plus, Trophy, Users, Calendar, Filter, Settings, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TournamentHeader } from "./TournamentHeader";
import { PlayerCard } from "./PlayerCard";
import { MatchCard } from "./MatchCard";
import { CreateMatchDialog } from "./CreateMatchDialog";
import { CreateTournamentDialog } from "./CreateTournamentDialog";
import { CreatePlayerDialog } from "./CreatePlayerDialog";
import { TournamentSelector } from "./TournamentSelector";
import { TournamentManagement } from "./TournamentManagement";
import { useToast } from "@/hooks/use-toast";

interface Tournament {
  id: string;
  name: string;
  course: string;
  description?: string;
  startDate: string;
  endDate: string;
  maxPlayers: number;
  format: "matchplay" | "strokeplay" | "scramble";
  status: "upcoming" | "active" | "completed";
  players: string[];
}

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
  // For singles matches
  player1?: MatchPlayer;
  player2?: MatchPlayer;
  // For foursome matches
  team1?: Team;
  team2?: Team;
  round: string;
  status: "scheduled" | "in-progress" | "completed";
  date: string;
  time: string;
  tee?: string;
  winner?: string;
}

// Initial mock data
const initialTournaments: Tournament[] = [
  {
    id: "1",
    name: "Spring Championship 2024",
    course: "Pebble Beach Golf Links",
    description: "Annual spring tournament featuring professional players",
    startDate: "2024-03-15",
    endDate: "2024-03-17",
    maxPlayers: 32,
    format: "matchplay",
    status: "active",
    players: ["1", "2", "3", "4", "5", "6"]
  }
];

const initialPlayers: Player[] = [
  { id: "1", name: "Tiger Woods", handicap: 0, wins: 15, losses: 2, status: "active" },
  { id: "2", name: "Rory McIlroy", handicap: 2, wins: 12, losses: 3, status: "active" },
  { id: "3", name: "Jordan Spieth", handicap: 1, wins: 10, losses: 5, status: "active" },
  { id: "4", name: "Justin Thomas", handicap: 1, wins: 8, losses: 4, status: "eliminated" },
  { id: "5", name: "Brooks Koepka", handicap: 0, wins: 11, losses: 3, status: "active" },
  { id: "6", name: "Dustin Johnson", handicap: 1, wins: 9, losses: 6, status: "active" },
];

const initialMatches: Match[] = [
  {
    id: "1",
    tournamentId: "1",
    type: "singles",
    player1: { name: "Tiger Woods", handicap: 0, score: 3 },
    player2: { name: "Rory McIlroy", handicap: 2, score: 1 },
    round: "Quarterfinal 1",
    status: "completed",
    date: "Mar 16",
    time: "9:00 AM",
    tee: "Tee 1",
    winner: "Tiger Woods"
  },
  {
    id: "2",
    tournamentId: "1",
    type: "foursome",
    team1: {
      player1: { name: "Jordan Spieth", handicap: 1 },
      player2: { name: "Justin Thomas", handicap: 1 },
      teamScore: 2
    },
    team2: {
      player1: { name: "Brooks Koepka", handicap: 0 },
      player2: { name: "Dustin Johnson", handicap: 1 },
      teamScore: 1
    },
    round: "Foursome Match 1",
    status: "in-progress",
    date: "Mar 16",
    time: "9:15 AM",
    tee: "Tee 10"
  },
  {
    id: "3",
    tournamentId: "1",
    type: "singles",
    player1: { name: "Dustin Johnson", handicap: 1 },
    player2: { name: "Justin Thomas", handicap: 1 },
    round: "Quarterfinal 3",
    status: "scheduled",
    date: "Mar 16",
    time: "2:00 PM",
    tee: "Tee 1"
  }
];

export function TournamentDashboard() {
  const [tournaments, setTournaments] = useState<Tournament[]>(initialTournaments);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(initialTournaments[0]?.id || null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showManagement, setShowManagement] = useState(false);
  const { toast } = useToast();

  const currentTournament = tournaments.find(t => t.id === selectedTournament);
  const tournamentPlayers = currentTournament ? players.filter(p => currentTournament.players.includes(p.id)) : [];
  const tournamentMatches = matches.filter(m => m.tournamentId === selectedTournament);

  const handleCreateTournament = (tournamentData: Omit<Tournament, "id" | "players">) => {
    const newTournament: Tournament = {
      ...tournamentData,
      id: Date.now().toString(),
      players: []
    };
    setTournaments(prev => [...prev, newTournament]);
    setSelectedTournament(newTournament.id);
  };

  const handleCreatePlayer = (playerData: Omit<Player, "id">) => {
    if (!selectedTournament) {
      toast({
        title: "No Tournament Selected",
        description: "Please select a tournament before adding players.",
        variant: "destructive"
      });
      return;
    }

    const currentTournament = tournaments.find(t => t.id === selectedTournament);
    if (!currentTournament) return;

    if (currentTournament.players.length >= currentTournament.maxPlayers) {
      toast({
        title: "Tournament Full",
        description: `This tournament is limited to ${currentTournament.maxPlayers} players.`,
        variant: "destructive"
      });
      return;
    }

    const newPlayer: Player = {
      ...playerData,
      id: Date.now().toString()
    };

    setPlayers(prev => [...prev, newPlayer]);
    setTournaments(prev => prev.map(t => 
      t.id === selectedTournament 
        ? { ...t, players: [...t.players, newPlayer.id] }
        : t
    ));
  };

  const handleBulkCreatePlayers = (playersData: Omit<Player, "id">[]) => {
    if (!selectedTournament) {
      toast({
        title: "No Tournament Selected",
        description: "Please select a tournament before adding players.",
        variant: "destructive"
      });
      return;
    }

    const currentTournament = tournaments.find(t => t.id === selectedTournament);
    if (!currentTournament) return;

    const availableSlots = currentTournament.maxPlayers - currentTournament.players.length;
    const playersToAdd = playersData.slice(0, availableSlots);

    if (playersToAdd.length < playersData.length) {
      toast({
        title: "Tournament Capacity",
        description: `Only ${playersToAdd.length} players could be added due to tournament capacity limit.`,
        variant: "default"
      });
    }

    const newPlayers: Player[] = playersToAdd.map((playerData, index) => ({
      ...playerData,
      id: (Date.now() + index).toString()
    }));

    setPlayers(prev => [...prev, ...newPlayers]);
    setTournaments(prev => prev.map(t => 
      t.id === selectedTournament 
        ? { ...t, players: [...t.players, ...newPlayers.map(p => p.id)] }
        : t
    ));
  };

  const handleDeleteTournament = (tournamentId: string) => {
    setTournaments(prev => prev.filter(t => t.id !== tournamentId));
    setMatches(prev => prev.filter(m => m.tournamentId !== tournamentId));
    
    if (selectedTournament === tournamentId) {
      setSelectedTournament(null);
    }
    
    toast({
      title: "Tournament Deleted",
      description: "Tournament and all associated data have been removed.",
    });
  };

  const handleActivateTournament = (tournamentId: string) => {
    setTournaments(prev => prev.map(t => 
      t.id === tournamentId 
        ? { ...t, status: "active" as const }
        : t
    ));
    
    toast({
      title: "Tournament Activated",
      description: "Tournament is now active and ready for matches.",
    });
  };

  const handleCreateMatch = (matchData: Omit<Match, "id">) => {
    const newMatch: Match = {
      ...matchData,
      id: Date.now().toString()
    };
    setMatches(prev => [...prev, newMatch]);
  };

  const handleAutoScheduleMatches = () => {
    if (!selectedTournament) {
      toast({
        title: "No Tournament Selected",
        description: "Please select a tournament before auto-scheduling matches.",
        variant: "destructive"
      });
      return;
    }

    const activePlayers = tournamentPlayers.filter(p => p.status === "active");
    
    if (activePlayers.length < 2) {
      toast({
        title: "Not Enough Players",
        description: "At least 2 active players are required to schedule matches.",
        variant: "destructive"
      });
      return;
    }

    // Sort players by handicap (best to worst)
    const sortedPlayers = [...activePlayers].sort((a, b) => a.handicap - b.handicap);
    
    // Create matches pairing best vs worst handicap
    const newMatches: Match[] = [];
    const usedPlayers = new Set<string>();
    
    for (let i = 0; i < Math.floor(sortedPlayers.length / 2); i++) {
      const bestPlayer = sortedPlayers[i];
      const worstPlayer = sortedPlayers[sortedPlayers.length - 1 - i];
      
      // Skip if either player is already used (shouldn't happen with this algorithm, but safety check)
      if (usedPlayers.has(bestPlayer.id) || usedPlayers.has(worstPlayer.id)) {
        continue;
      }
      
      usedPlayers.add(bestPlayer.id);
      usedPlayers.add(worstPlayer.id);
      
      const match: Match = {
        id: (Date.now() + i).toString(),
        tournamentId: selectedTournament,
        type: "singles",
        player1: {
          name: bestPlayer.name,
          handicap: bestPlayer.handicap
        },
        player2: {
          name: worstPlayer.name,
          handicap: worstPlayer.handicap
        },
        round: `Round ${Math.floor(tournamentMatches.length / (activePlayers.length / 2)) + 1}`,
        status: "scheduled",
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: `${9 + i}:00 AM`,
        tee: `Tee ${(i % 2) === 0 ? '1' : '10'}`
      };
      
      newMatches.push(match);
    }
    
    if (newMatches.length === 0) {
      toast({
        title: "No Matches Created",
        description: "Unable to create any matches with current player selection.",
        variant: "destructive"
      });
      return;
    }
    
    setMatches(prev => [...prev, ...newMatches]);
    
    const oddPlayerCount = activePlayers.length % 2;
    const message = oddPlayerCount === 1 
      ? `${newMatches.length} matches scheduled! Note: ${sortedPlayers[Math.floor(sortedPlayers.length / 2)].name} has a bye.`
      : `${newMatches.length} matches scheduled successfully!`;
    
    toast({
      title: "Auto-Schedule Complete",
      description: message,
    });
  };
  
  const activePlayers = tournamentPlayers.filter(p => p.status === "active");

  // Show tournament management if requested
  if (showManagement && currentTournament) {
    return (
      <TournamentManagement
        tournament={currentTournament}
        players={players}
        matches={matches}
        onTournamentUpdate={(updatedTournament) => {
          setTournaments(prev => prev.map(t => 
            t.id === updatedTournament.id ? updatedTournament : t
          ));
        }}
        onPlayerUpdate={setPlayers}
        onMatchUpdate={setMatches}
        onBack={() => setShowManagement(false)}
      />
    );
  }

  // Show tournament selector if no tournament is selected or no tournaments exist
  if (!selectedTournament || !currentTournament) {
    return (
      <div className="min-h-screen bg-gradient-course">
        <div className="container mx-auto px-4 py-6">
          <TournamentSelector
            tournaments={tournaments}
            selectedTournament={selectedTournament}
            onTournamentSelect={setSelectedTournament}
            onCreateNew={() => setSelectedTournament(null)}
            onDeleteTournament={handleDeleteTournament}
            onActivateTournament={handleActivateTournament}
          />
          <div className="mt-6 text-center">
            <CreateTournamentDialog onTournamentCreate={handleCreateTournament} />
          </div>
        </div>
      </div>
    );
  }

  const tournamentHeaderData = {
    name: currentTournament.name,
    course: currentTournament.course,
    date: `${new Date(currentTournament.startDate).toLocaleDateString()}${currentTournament.endDate ? ` - ${new Date(currentTournament.endDate).toLocaleDateString()}` : ''}`,
    players: currentTournament.players.length,
    status: currentTournament.status
  };

  return (
    <div className="min-h-screen bg-gradient-course">
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <TournamentSelector
              tournaments={tournaments}
              selectedTournament={selectedTournament}
              onTournamentSelect={setSelectedTournament}
              onCreateNew={() => setSelectedTournament(null)}
              onDeleteTournament={handleDeleteTournament}
              onActivateTournament={handleActivateTournament}
            />
            <Button 
              variant="outline" 
              onClick={() => setShowManagement(true)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Manage Tournament
            </Button>
          </div>
        </div>
        
        <TournamentHeader tournament={tournamentHeaderData} />
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activePlayers.length}</p>
                  <p className="text-sm text-muted-foreground">Active Players</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <Trophy className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tournamentMatches.filter(m => m.status === "completed").length}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tournamentMatches.filter(m => m.status === "in-progress").length}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Filter className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tournamentMatches.filter(m => m.status === "scheduled").length}</p>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-background/80 backdrop-blur-sm shadow-card">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="players">Players</TabsTrigger>
              <TabsTrigger value="matches">Matches</TabsTrigger>
              <TabsTrigger value="bracket">Bracket</TabsTrigger>
            </TabsList>
            
            <div className="flex gap-2">
              <CreatePlayerDialog 
                onPlayerCreate={handleCreatePlayer} 
                onBulkPlayerCreate={handleBulkCreatePlayers}
              />
              <CreateTournamentDialog onTournamentCreate={handleCreateTournament} />
              <CreateMatchDialog
                tournamentId={selectedTournament}
                availablePlayers={tournamentPlayers}
                onMatchCreate={handleCreateMatch}
                trigger={
                  <Button variant="fairway">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Match
                  </Button>
                }
              />
              <Button 
                variant="premium" 
                onClick={handleAutoScheduleMatches}
                disabled={activePlayers.length < 2}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Auto-Schedule
              </Button>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Recent Matches</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tournamentMatches.length === 0 ? (
                    <div className="text-center py-8">
                      <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No matches scheduled yet</p>
                    </div>
                  ) : (
                    tournamentMatches.slice(0, 3).map(match => (
                      <MatchCard 
                        key={match.id} 
                        match={match}
                        onScoreUpdate={() => console.log("Update score for", match.id)}
                        onViewDetails={() => console.log("View details for", match.id)}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
              
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Top Players</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tournamentPlayers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No players added yet</p>
                    </div>
                  ) : (
                    tournamentPlayers
                      .sort((a, b) => (b.wins / (b.wins + b.losses || 1)) - (a.wins / (a.wins + a.losses || 1)))
                      .slice(0, 4)
                      .map(player => (
                        <PlayerCard 
                          key={player.id} 
                          player={player}
                          onSelect={() => setSelectedPlayer(player.id)}
                          selected={selectedPlayer === player.id}
                        />
                      ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tournamentPlayers.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Players Yet</h3>
                  <p className="text-muted-foreground mb-4">Add players to start the tournament</p>
                  <CreatePlayerDialog 
                    onPlayerCreate={handleCreatePlayer}
                    onBulkPlayerCreate={handleBulkCreatePlayers}
                    trigger={
                      <Button variant="premium">
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Player
                      </Button>
                    }
                  />
                </div>
              ) : (
                tournamentPlayers.map(player => (
                  <PlayerCard 
                    key={player.id} 
                    player={player}
                    onSelect={() => setSelectedPlayer(player.id)}
                    selected={selectedPlayer === player.id}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="matches" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {tournamentMatches.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Matches Scheduled</h3>
                  <p className="text-muted-foreground mb-4">Schedule matches to start the tournament</p>
                  <div className="flex gap-2 justify-center">
                    <CreateMatchDialog
                      tournamentId={selectedTournament}
                      availablePlayers={tournamentPlayers}
                      onMatchCreate={handleCreateMatch}
                      trigger={
                        <Button variant="fairway">
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule First Match
                        </Button>
                      }
                    />
                    {activePlayers.length >= 2 && (
                      <Button 
                        variant="premium" 
                        onClick={handleAutoScheduleMatches}
                        className="flex items-center gap-2"
                      >
                        <Zap className="h-4 w-4" />
                        Auto-Schedule Round
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                tournamentMatches.map(match => (
                  <MatchCard 
                    key={match.id} 
                    match={match}
                    onScoreUpdate={() => console.log("Update score for", match.id)}
                    onViewDetails={() => console.log("View details for", match.id)}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="bracket" className="space-y-6">
            <Card className="shadow-card">
              <CardContent className="p-8">
                <div className="text-center">
                  <Trophy className="h-16 w-16 text-warning mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Tournament Bracket</h3>
                  <p className="text-muted-foreground">
                    Interactive bracket view coming soon! Track the tournament progression through each round.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}