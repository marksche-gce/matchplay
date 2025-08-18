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
        // Prefer system_roles table if it exists (cast to any to bypass strict typed tables)
        const { data, error } = await (supabase as any)
          .from('system_roles' as any)
          .select('*')
          .eq('user_id', user.id)
          .eq('role', 'system_admin')
          .limit(1);

        if (error) {
          // If the table does not exist (42P01), fall back to no system admin
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const err: any = error as any;
          if (err?.code !== '42P01') {
            console.error('Error checking system admin status:', error);
          }
          setIsSystemAdmin(false);
        } else {
          setIsSystemAdmin(!!data && data.length > 0);
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
