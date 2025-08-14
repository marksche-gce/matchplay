import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trophy, Users, Calendar } from 'lucide-react';
import { TournamentDialog } from '@/components/tournament/TournamentDialog';
import { TournamentList } from '@/components/tournament/TournamentList';
import { TournamentView } from '@/components/tournament/TournamentView';
import { useAuth } from '@/hooks/useAuth';

export function MatchPlayTournaments() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const { user } = useAuth();

  const handleTournamentSelect = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
  };

  const handleBackToList = () => {
    setSelectedTournamentId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-course p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Match Play Tournaments</h1>
                <p className="text-muted-foreground">Manage golf match play competitions</p>
              </div>
            </div>
            
            {user && (
              <Button 
                onClick={() => setShowCreateDialog(true)} 
                className="bg-gradient-primary hover:opacity-90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Tournament
              </Button>
            )}
          </div>
        </div>

        {/* Tournament Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Active Tournaments</p>
                  <p className="text-2xl font-bold text-foreground">0</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-success" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Players</p>
                  <p className="text-2xl font-bold text-foreground">0</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-warning" />
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming Matches</p>
                  <p className="text-2xl font-bold text-foreground">0</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        {selectedTournamentId ? (
          <TournamentView 
            tournamentId={selectedTournamentId} 
            onBack={handleBackToList}
          />
        ) : (
          <TournamentList onTournamentSelect={handleTournamentSelect} />
        )}

        {/* Create Tournament Dialog */}
        <TournamentDialog 
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </div>
    </div>
  );
}