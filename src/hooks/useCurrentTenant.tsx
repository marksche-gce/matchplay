import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface UserTenant {
  tenant_id: string;
  tenant_name: string;
  role: string;
}

export function useCurrentTenant() {
  const [currentTenant, setCurrentTenant] = useState<UserTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const getCurrentTenant = async () => {
      if (!user) {
        setCurrentTenant(null);
        setLoading(false);
        return;
      }

      try {
        // Check if user is system admin first
        const { data: systemRole } = await supabase
          .from('system_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'system_admin')
          .maybeSingle();

        if (systemRole) {
          setCurrentTenant({
            tenant_id: 'system',
            tenant_name: 'System Administrator',
            role: 'system_admin'
          });
          setLoading(false);
          return;
        }

        // Get tenant role
        const { data: tenantRole, error } = await supabase
          .from('user_roles')
          .select(`
            tenant_id,
            role,
            tenants (
              name
            )
          `)
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (error || !tenantRole) {
          setCurrentTenant(null);
        } else {
          setCurrentTenant({
            tenant_id: tenantRole.tenant_id,
            tenant_name: tenantRole.tenants?.name || 'Unbekannter Mandant',
            role: tenantRole.role
          });
        }
      } catch (error) {
        console.error('Error fetching current tenant:', error);
        setCurrentTenant(null);
      } finally {
        setLoading(false);
      }
    };

    getCurrentTenant();
  }, [user]);

  return { currentTenant, loading };
}