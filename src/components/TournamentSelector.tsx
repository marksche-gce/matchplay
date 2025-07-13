import { useState } from "react";
import { Trophy, Calendar, Users, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface TournamentSelectorProps {
  tournaments: Tournament[];
  selectedTournament: string | null;
  onTournamentSelect: (tournamentId: string) => void;
  onCreateNew: () => void;
}

export function TournamentSelector({ 
  tournaments, 
  selectedTournament, 
  onTournamentSelect, 
  onCreateNew 
}: TournamentSelectorProps) {
  const activeTournament = tournaments.find(t => t.id === selectedTournament);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming": return "bg-warning text-warning-foreground";
      case "active": return "bg-success text-success-foreground";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getFormatDisplay = (format: string) => {
    switch (format) {
      case "matchplay": return "Match Play";
      case "strokeplay": return "Stroke Play";
      case "scramble": return "Scramble";
      default: return format;
    }
  };

  if (tournaments.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-8 text-center">
          <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Tournaments Yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first tournament to get started with managing golf matchplay events.
          </p>
          <Button variant="premium" onClick={onCreateNew}>
            <Trophy className="h-4 w-4 mr-2" />
            Create Your First Tournament
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Tournament Selection
          </CardTitle>
          <Badge variant="outline">
            {tournaments.length} Tournament{tournaments.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <Select value={selectedTournament || ""} onValueChange={onTournamentSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tournament..." />
              </SelectTrigger>
              <SelectContent>
                {tournaments.map(tournament => (
                  <SelectItem key={tournament.id} value={tournament.id}>
                    <div className="flex items-center gap-2">
                      <span>{tournament.name}</span>
                      <Badge className={`${getStatusColor(tournament.status)} text-xs`}>
                        {tournament.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={onCreateNew}>
            Create New
          </Button>
        </div>

        {activeTournament && (
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{activeTournament.name}</h4>
                  <Badge className={getStatusColor(activeTournament.status)}>
                    {activeTournament.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(activeTournament.startDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{activeTournament.players.length}/{activeTournament.maxPlayers} players</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Format: {getFormatDisplay(activeTournament.format)}</span>
                  <span className="text-muted-foreground">{activeTournament.course}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}