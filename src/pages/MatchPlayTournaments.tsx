import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trophy, Users, Calendar, Shield, Building2 } from 'lucide-react';
import { TournamentDialog } from '@/components/tournament/TournamentDialog';
import { TournamentList } from '@/components/tournament/TournamentList';
import { TournamentView } from '@/components/tournament/TournamentView';
import { useAuth } from '@/hooks/useAuth';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useOrganizerCheck } from '@/hooks/useOrganizerCheck';
import { useSystemAdminCheck } from '@/hooks/useSystemAdminCheck';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export function MatchPlayTournaments() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');
  const [tenants, setTenants] = useState<{id: string, name: string}[]>([]);
  const { user } = useAuth();
  const { isAdmin } = useAdminCheck();
  const { isOrganizer } = useOrganizerCheck();
  const { isSystemAdmin } = useSystemAdminCheck();
  const navigate = useNavigate();

  useEffect(() => {
    if (isSystemAdmin) {
      fetchTenants();
    }
  }, [isSystemAdmin]);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const handleTournamentSelect = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
  };

  const handleBackToList = () => {
    setSelectedTournamentId(null);
    // Trigger refresh of tournament list
    setRefreshTrigger(prev => prev + 1);
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
                {(isSystemAdmin || isAdmin || isOrganizer) && (
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

        {/* Tenant Filter for System Admins */}
        {isSystemAdmin && (
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Mandant filtern:</span>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger className="w-64 bg-background">
                  <SelectValue placeholder="Mandant auswählen" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">Alle Mandanten</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Main Content */}
        {selectedTournamentId ? (
          <TournamentView 
            tournamentId={selectedTournamentId} 
            onBack={handleBackToList}
          />
        ) : (
          <TournamentList 
            onTournamentSelect={handleTournamentSelect} 
            refreshTrigger={refreshTrigger}
            selectedTenantId={isSystemAdmin ? selectedTenantId : undefined}
          />
        )}

        {/* Create Tournament Dialog */}
        <TournamentDialog 
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={() => setRefreshTrigger(prev => prev + 1)}
        />
      </div>
    </div>
  );
}