import { useState } from "react";
import { Plus, Trophy, Users, Calendar, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TournamentHeader } from "./TournamentHeader";
import { PlayerCard } from "./PlayerCard";
import { MatchCard } from "./MatchCard";

// Mock data for demonstration
const tournamentData = {
  name: "Spring Championship 2024",
  course: "Pebble Beach Golf Links",
  date: "March 15-17, 2024",
  players: 32,
  status: "active" as const
};

const players = [
  { id: "1", name: "Tiger Woods", handicap: 0, wins: 15, losses: 2, status: "active" as const },
  { id: "2", name: "Rory McIlroy", handicap: 2, wins: 12, losses: 3, status: "active" as const },
  { id: "3", name: "Jordan Spieth", handicap: 1, wins: 10, losses: 5, status: "active" as const },
  { id: "4", name: "Justin Thomas", handicap: 1, wins: 8, losses: 4, status: "eliminated" as const },
  { id: "5", name: "Brooks Koepka", handicap: 0, wins: 11, losses: 3, status: "active" as const },
  { id: "6", name: "Dustin Johnson", handicap: 1, wins: 9, losses: 6, status: "active" as const },
];

const matches = [
  {
    id: "1",
    player1: { name: "Tiger Woods", handicap: 0, score: 3 },
    player2: { name: "Rory McIlroy", handicap: 2, score: 1 },
    round: "Quarterfinal 1",
    status: "completed" as const,
    date: "Mar 16",
    time: "9:00 AM",
    tee: "Tee 1",
    winner: "Tiger Woods"
  },
  {
    id: "2",
    player1: { name: "Jordan Spieth", handicap: 1 },
    player2: { name: "Brooks Koepka", handicap: 0 },
    round: "Quarterfinal 2",
    status: "in-progress" as const,
    date: "Mar 16",
    time: "9:15 AM",
    tee: "Tee 10"
  },
  {
    id: "3",
    player1: { name: "Dustin Johnson", handicap: 1 },
    player2: { name: "Justin Thomas", handicap: 1 },
    round: "Quarterfinal 3",
    status: "scheduled" as const,
    date: "Mar 16",
    time: "2:00 PM",
    tee: "Tee 1"
  }
];

export function TournamentDashboard() {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const activePlayers = players.filter(p => p.status === "active");
  const eliminatedPlayers = players.filter(p => p.status === "eliminated");

  return (
    <div className="min-h-screen bg-gradient-course">
      <div className="container mx-auto px-4 py-6 space-y-6">
        <TournamentHeader tournament={tournamentData} />
        
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
                  <p className="text-2xl font-bold">{matches.filter(m => m.status === "completed").length}</p>
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
                  <p className="text-2xl font-bold">{matches.filter(m => m.status === "in-progress").length}</p>
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
                  <p className="text-2xl font-bold">{matches.filter(m => m.status === "scheduled").length}</p>
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
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Player
              </Button>
              <Button variant="premium">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Match
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
                  {matches.slice(0, 3).map(match => (
                    <MatchCard 
                      key={match.id} 
                      match={match}
                      onScoreUpdate={() => console.log("Update score for", match.id)}
                      onViewDetails={() => console.log("View details for", match.id)}
                    />
                  ))}
                </CardContent>
              </Card>
              
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Top Players</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {players
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
                  }
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {players.map(player => (
                <PlayerCard 
                  key={player.id} 
                  player={player}
                  onSelect={() => setSelectedPlayer(player.id)}
                  selected={selectedPlayer === player.id}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="matches" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {matches.map(match => (
                <MatchCard 
                  key={match.id} 
                  match={match}
                  onScoreUpdate={() => console.log("Update score for", match.id)}
                  onViewDetails={() => console.log("View details for", match.id)}
                />
              ))}
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