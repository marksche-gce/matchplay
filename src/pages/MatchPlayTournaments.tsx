import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trophy, Users, Calendar, Shield } from 'lucide-react';
import { TournamentDialog } from '@/components/tournament/TournamentDialog';
import { TournamentList } from '@/components/tournament/TournamentList';
import { TournamentView } from '@/components/tournament/TournamentView';
import { useAuth } from '@/hooks/useAuth';
import { useSystemAdminCheck } from '@/hooks/useSystemAdminCheck';
import { useOrganizerCheck } from '@/hooks/useOrganizerCheck';
import { useNavigate } from 'react-router-dom';

export function MatchPlayTournaments() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
const { user } = useAuth();
const { isSystemAdmin } = useSystemAdminCheck();
const { isOrganizer } = useOrganizerCheck();
const navigate = useNavigate();

  const handleTournamentSelect = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
  };

  const handleBackToList = () => {
    setSelectedTournamentId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-course p-4 pt-20">{/* pt-20 to account for fixed header */}
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">Matchplay Turniere</h1>
                <p className="text-muted-foreground">Golf Matchplay Turniere verwalten</p>
              </div>
            </div>
            
            {user && (
              <div className="flex gap-2">
                {isSystemAdmin && (
                  <Button 
                    onClick={() => navigate('/user-management')} 
                    variant="outline"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Benutzerverwaltung
                  </Button>
                )}
                {isOrganizer && (
                  <Button 
                    onClick={() => setShowCreateDialog(true)} 
                    variant="default"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Turnier erstellen
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tournament Statistics */}
        {/* TournamentList component will show tournament cards */}

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