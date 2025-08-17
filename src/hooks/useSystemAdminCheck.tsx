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
        const { data, error } = await supabase
          .from('system_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'system_admin')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking system admin status:', error);
        }

        setIsSystemAdmin(!!data);
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