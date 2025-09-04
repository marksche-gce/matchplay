import { useState } from "react";
import { 
  Settings, 
  Users, 
  Calendar, 
  Trophy, 
  BarChart3, 
  Edit, 
  Save, 
  X, 
  Plus,
  Trash2,
  Clock,
  Target,
  Award
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CreateMatchDialog } from "./CreateMatchDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

interface Match {
  id: string;
  tournamentId: string;
  type: "singles" | "foursome";
  player1?: { name: string; handicap: number; score?: number; };
  player2?: { name: string; handicap: number; score?: number; };
  team1?: { 
    player1: { name: string; handicap: number; score?: number; };
    player2: { name: string; handicap: number; score?: number; };
    teamScore?: number;
  };
  team2?: { 
    player1: { name: string; handicap: number; score?: number; };
    player2: { name: string; handicap: number; score?: number; };
    teamScore?: number;
  };
  round: string;
  status: "scheduled" | "in-progress" | "completed";
  date: string;
  time: string;
  tee?: string;
  winner?: string;
}

interface TournamentManagementProps {
  tournament: Tournament;
  players: Player[];
  matches: Match[];
  onTournamentUpdate: (tournament: Tournament) => void;
  onPlayerUpdate: (players: Player[]) => void;
  onMatchUpdate: (matches: Match[]) => void;
  onBack: () => void;
}

export function TournamentManagement({
  tournament,
  players,
  matches,
  onTournamentUpdate,
  onPlayerUpdate,
  onMatchUpdate,
  onBack
}: TournamentManagementProps) {
  const [editingTournament, setEditingTournament] = useState(false);
  const [tournamentForm, setTournamentForm] = useState(tournament);
  const { toast } = useToast();

  const tournamentPlayers = players.filter(p => tournament.players.includes(p.id));
  const tournamentMatches = matches.filter(m => m.tournamentId === tournament.id);

  const handleSaveTournament = () => {
    onTournamentUpdate(tournamentForm);
    setEditingTournament(false);
    toast({
      title: "Turnier aktualisiert",
      description: "Turniereinstellungen wurden erfolgreich gespeichert.",
    });
  };

  const handleRemovePlayer = (playerId: string) => {
    const updatedTournament = {
      ...tournament,
      players: tournament.players.filter(id => id !== playerId)
    };
    onTournamentUpdate(updatedTournament);
    toast({
      title: "Spieler entfernt",
      description: "Spieler wurde vom Turnier entfernt.",
    });
  };

  const handleCreateMatch = (match: Omit<Match, "id">) => {
    const newMatch: Match = {
      ...match,
      id: (Date.now()).toString()
    };
    onMatchUpdate([...matches, newMatch]);
  };

  const handleClearAllMatches = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('clear-match-participants', {
        body: { tournamentId: tournament.id }
      });

      if (error) {
        console.error('Error clearing matches:', error);
        toast({
          title: "Fehler",
          description: "Matches konnten nicht gelöscht werden.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Matches gelöscht",
        description: `Alle ${data.matchesCleared || 0} Matches wurden erfolgreich zurückgesetzt.`,
      });

      // Refresh matches data if needed
      // This assumes the parent component will refresh the data
      
    } catch (error) {
      console.error('Error clearing matches:', error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive",
      });
    }
  };

  const getPlayerStats = (player: Player) => {
    const playerMatches = tournamentMatches.filter(m => 
      (m.player1?.name === player.name) || 
      (m.player2?.name === player.name) ||
      (m.team1?.player1.name === player.name) ||
      (m.team1?.player2.name === player.name) ||
      (m.team2?.player1.name === player.name) ||
      (m.team2?.player2.name === player.name)
    );
    
    const completed = playerMatches.filter(m => m.status === "completed");
    const wins = completed.filter(m => m.winner === player.name).length;
    
    return {
      totalMatches: playerMatches.length,
      completed: completed.length,
      wins,
      losses: completed.length - wins
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming": return "bg-warning text-warning-foreground";
      case "active": return "bg-success text-success-foreground";
      case "completed": return "bg-muted text-muted-foreground";
      case "scheduled": return "bg-info text-info-foreground";
      case "eliminated": return "bg-destructive text-destructive-foreground";
      case "champion": return "bg-success text-success-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-course">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={onBack} className="mb-2">
              ← Zurück zum Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Turnierverwaltung</h1>
            <p className="text-muted-foreground">{tournament.name}</p>
          </div>
          <Badge className={getStatusColor(tournament.status)}>
            {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
          </Badge>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="settings">Einstellungen</TabsTrigger>
            <TabsTrigger value="players">Spieler</TabsTrigger>
            <TabsTrigger value="matches">Spiele</TabsTrigger>
            <TabsTrigger value="statistics">Statistiken</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Spieler</p>
                      <p className="text-2xl font-bold">{tournamentPlayers.length}/{tournament.maxPlayers}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Spiele</p>
                      <p className="text-2xl font-bold">{tournamentMatches.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Abgeschlossen</p>
                      <p className="text-2xl font-bold">
                        {tournamentMatches.filter(m => m.status === "completed").length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Format</p>
                      <p className="text-lg font-semibold capitalize">{tournament.format}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Turnierdetails</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Platz</Label>
                    <p className="text-lg">{tournament.course}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Dauer</Label>
                    <p className="text-lg">
                      {new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  {tournament.description && (
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-muted-foreground">Beschreibung</Label>
                      <p className="text-lg">{tournament.description}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Turniereinstellungen</CardTitle>
                  <Button
                    variant={editingTournament ? "default" : "outline"}
                    onClick={() => editingTournament ? handleSaveTournament() : setEditingTournament(true)}
                  >
                    {editingTournament ? <Save className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
                    {editingTournament ? "Änderungen speichern" : "Turnier bearbeiten"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Turniername</Label>
                    <Input
                      id="name"
                      value={tournamentForm.name}
                      onChange={(e) => setTournamentForm(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!editingTournament}
                    />
                  </div>
                  <div>
                    <Label htmlFor="course">Platz</Label>
                    <Input
                      id="course"
                      value={tournamentForm.course}
                      onChange={(e) => setTournamentForm(prev => ({ ...prev, course: e.target.value }))}
                      disabled={!editingTournament}
                    />
                  </div>
                  <div>
                    <Label htmlFor="startDate">Startdatum</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={tournamentForm.startDate}
                      onChange={(e) => setTournamentForm(prev => ({ ...prev, startDate: e.target.value }))}
                      disabled={!editingTournament}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">Enddatum</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={tournamentForm.endDate}
                      onChange={(e) => setTournamentForm(prev => ({ ...prev, endDate: e.target.value }))}
                      disabled={!editingTournament}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxPlayers">Max. Spieler</Label>
                    <Input
                      id="maxPlayers"
                      type="number"
                      value={tournamentForm.maxPlayers}
                      onChange={(e) => setTournamentForm(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) }))}
                      disabled={!editingTournament}
                    />
                  </div>
                  <div>
                    <Label htmlFor="format">Format</Label>
                    <Select
                      value={tournamentForm.format}
                      onValueChange={(value: "matchplay" | "strokeplay" | "scramble") => 
                        setTournamentForm(prev => ({ ...prev, format: value }))
                      }
                      disabled={!editingTournament}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="matchplay">Matchplay</SelectItem>
                        <SelectItem value="strokeplay">Strokeplay</SelectItem>
                        <SelectItem value="scramble">Scramble</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Beschreibung</Label>
                  <Textarea
                    id="description"
                    value={tournamentForm.description || ""}
                    onChange={(e) => setTournamentForm(prev => ({ ...prev, description: e.target.value }))}
                    disabled={!editingTournament}
                    rows={3}
                  />
                </div>
                {editingTournament && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                      setTournamentForm(tournament);
                      setEditingTournament(false);
                    }}>
                      <X className="h-4 w-4 mr-2" />
                      Abbrechen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Turnierspieler ({tournamentPlayers.length}/{tournament.maxPlayers})</CardTitle>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Spieler hinzufügen
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tournamentPlayers.map((player) => {
                    const stats = getPlayerStats(player);
                    return (
                      <div key={player.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div>
                            <h3 className="font-semibold">{player.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Handicap: {player.handicap} • {stats.wins}W-{stats.losses}L ({stats.completed}/{stats.totalMatches})
                            </p>
                          </div>
                          <Badge className={getStatusColor(player.status)}>
                            {player.status}
                          </Badge>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                             <AlertDialogHeader>
                               <AlertDialogTitle>Spieler entfernen</AlertDialogTitle>
                               <AlertDialogDescription>
                                 Sind Sie sicher, dass Sie {player.name} von diesem Turnier entfernen möchten?
                               </AlertDialogDescription>
                             </AlertDialogHeader>
                             <AlertDialogFooter>
                               <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                               <AlertDialogAction onClick={() => handleRemovePlayer(player.id)}>
                                 Entfernen
                               </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matches" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Turnierspiele</CardTitle>
                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Alle Matches löschen
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Alle Matches löschen</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sind Sie sicher, dass Sie alle zugewiesenen Spieler aus den Matches entfernen möchten? 
                            Diese Aktion setzt alle Matches zurück und kann nicht rückgängig gemacht werden.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearAllMatches}>
                            Alle löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <CreateMatchDialog
                      tournamentId={tournament.id}
                      availablePlayers={tournamentPlayers}
                      onMatchCreate={handleCreateMatch}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tournamentMatches.map((match) => (
                    <div key={match.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{match.round}</Badge>
                          <Badge className={getStatusColor(match.status)}>
                            {match.status.replace("-", " ")}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {match.date} at {match.time}
                          {match.tee && ` • Tee ${match.tee}`}
                        </div>
                      </div>
                      
                      {match.type === "singles" ? (
                        <div className="flex items-center justify-between">
                          <div className="text-center">
                            <p className="font-semibold">{match.player1?.name}</p>
                            <p className="text-sm text-muted-foreground">HC: {match.player1?.handicap}</p>
                            {match.player1?.score !== undefined && (
                              <p className="text-lg font-bold">{match.player1.score}</p>
                            )}
                          </div>
                          <div className="text-center text-muted-foreground">VS</div>
                          <div className="text-center">
                            <p className="font-semibold">{match.player2?.name}</p>
                            <p className="text-sm text-muted-foreground">HC: {match.player2?.handicap}</p>
                            {match.player2?.score !== undefined && (
                              <p className="text-lg font-bold">{match.player2.score}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="text-center">
                            <p className="font-semibold">Team 1</p>
                            <p className="text-sm">{match.team1?.player1.name} & {match.team1?.player2.name}</p>
                            {match.team1?.teamScore !== undefined && (
                              <p className="text-lg font-bold">{match.team1.teamScore}</p>
                            )}
                          </div>
                          <div className="text-center text-muted-foreground">VS</div>
                          <div className="text-center">
                            <p className="font-semibold">Team 2</p>
                            <p className="text-sm">{match.team2?.player1.name} & {match.team2?.player2.name}</p>
                            {match.team2?.teamScore !== undefined && (
                              <p className="text-lg font-bold">{match.team2.teamScore}</p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {match.winner && (
                        <div className="mt-3 text-center">
                          <Badge className="bg-success text-success-foreground">
                            <Award className="h-3 w-3 mr-1" />
                            Gewinner: {match.winner}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {tournamentMatches.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Noch keine Spiele geplant</p>
                      <p className="text-sm">Erstellen Sie Spiele, um das Turnier zu starten</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="statistics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Spiel-Statistiken
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Gesamt Spiele:</span>
                      <span className="font-bold">{tournamentMatches.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Abgeschlossen:</span>
                      <span className="font-bold">{tournamentMatches.filter(m => m.status === "completed").length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Geplant:</span>
                      <span className="font-bold">{tournamentMatches.filter(m => m.status === "scheduled").length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Spieler-Statistiken
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Aktive Spieler:</span>
                      <span className="font-bold">{tournamentPlayers.filter(p => p.status === "active").length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Ausgeschieden:</span>
                      <span className="font-bold">{tournamentPlayers.filter(p => p.status === "eliminated").length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sieger:</span>
                      <span className="font-bold">{tournamentPlayers.filter(p => p.status === "champion").length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kapazität:</span>
                      <span className="font-bold">{Math.round((tournamentPlayers.length / tournament.maxPlayers) * 100)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Rangliste</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tournamentPlayers
                    .map(player => ({ ...player, ...getPlayerStats(player) }))
                    .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
                    .map((player, index) => (
                      <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold">{player.name}</p>
                            <p className="text-sm text-muted-foreground">HC: {player.handicap}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{player.wins}W - {player.losses}L</p>
                          <p className="text-sm text-muted-foreground">{player.completed}/{player.totalMatches} Spiele</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}