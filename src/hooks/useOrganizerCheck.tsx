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
        // Use raw query to avoid TypeScript enum issues
        const { data, error } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', user.id)
          .limit(10);

        if (error) {
          console.error('Error checking organizer status:', error);
          setIsOrganizer(false);
        } else {
          // Check if user has tenant_admin or organizer role
          const hasOrganizerRole = data && data.length > 0 && 
            data.some((role: any) => role.role === 'tenant_admin' || role.role === 'organizer');
          setIsOrganizer(hasOrganizerRole);
        }
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