import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  status: string;
}

interface UserTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  user_role: 'tenant_admin' | 'manager' | 'organizer' | 'player';
}

interface TenantContextType {
  currentTenant: Tenant | null;
  userTenants: UserTenant[];
  loading: boolean;
  switchTenant: (tenantId: string) => void;
  refreshTenants: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [userTenants, setUserTenants] = useState<UserTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchUserTenants = async () => {
    if (!user) {
      setUserTenants([]);
      setCurrentTenant(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('get_user_tenants', { _user_id: user.id });

      if (error) {
        console.error('Error fetching user tenants:', error);
        return;
      }

      setUserTenants(data || []);

      // If no current tenant set and we have tenants, set the first one
      if (!currentTenant && data && data.length > 0) {
        const firstTenant = data[0];
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', firstTenant.tenant_id)
          .single();

        if (tenantData) {
          setCurrentTenant(tenantData);
          localStorage.setItem('currentTenantId', tenantData.id);
        }
      }
    } catch (error) {
      console.error('Error in fetchUserTenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchTenant = async (tenantId: string) => {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (!error && data) {
      setCurrentTenant(data);
      localStorage.setItem('currentTenantId', tenantId);
    }
  };

  const refreshTenants = () => {
    fetchUserTenants();
  };

  useEffect(() => {
    if (user) {
      // Check for stored tenant
      const storedTenantId = localStorage.getItem('currentTenantId');
      if (storedTenantId) {
        switchTenant(storedTenantId);
      }
      fetchUserTenants();
    } else {
      setCurrentTenant(null);
      setUserTenants([]);
      setLoading(false);
    }
  }, [user]);

  return (
    <TenantContext.Provider value={{
      currentTenant,
      userTenants,
      loading,
      switchTenant,
      refreshTenants
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}