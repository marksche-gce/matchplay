import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useSystemAdminCheck() {
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const checkSystemAdminStatus = async () => {
      if (!user) {
        setIsSystemAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Use the database function for checking system admin status
        const { data, error } = await supabase
          .rpc('is_system_admin', { _user_id: user.id });

        if (error) {
          console.error('Error checking system admin status:', error);
          setIsSystemAdmin(false);
        } else {
          console.log('System admin check result:', data);
          setIsSystemAdmin(!!data);
        }
      } catch (error) {
        console.error('Error checking system admin status:', error);
        setIsSystemAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkSystemAdminStatus();
  }, [user]);

  return { isSystemAdmin, loading };
}