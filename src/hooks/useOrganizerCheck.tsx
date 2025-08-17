import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useOrganizerCheck() {
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const checkOrganizerStatus = async () => {
      if (!user) {
        setIsOrganizer(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'organizer'])
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking organizer status:', error);
        }

        setIsOrganizer(!!data);
      } catch (error) {
        console.error('Error checking organizer status:', error);
        setIsOrganizer(false);
      } finally {
        setLoading(false);
      }
    };

    checkOrganizerStatus();
  }, [user]);

  return { isOrganizer, loading };
}