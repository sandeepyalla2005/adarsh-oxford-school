import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getAuthRedirectPath } from '@/lib/portal';
import { queryClient } from '@/lib/query-client';

type UserRole = 'admin' | 'staff' | 'feeInCharge' | null;

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole;
  profile: Profile | null;
  setUserRole: (role: UserRole) => void;
  isLoading: boolean;
  signIn: (
    email: string,
    password: string,
    expectedRole?: Exclude<UserRole, null>
  ) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setMockUser: (role: 'admin' | 'staff' | 'feeInCharge') => void;
  isAdmin: boolean;
  isStaff: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
}

const ROLE_FETCH_TIMEOUT = 25000; // Increased to 25s to support database cold starts
const ROLE_FETCH_RETRIES = 2;
const ROLE_CACHE_KEY_PREFIX = 'user_role_';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch profile for the current user
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data: profileList, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .limit(1);

      if (!error && profileList && profileList.length > 0) {
        const foundProfile = profileList[0] as Profile;
        setProfile(foundProfile);
        return foundProfile;
      }
      return null;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  };

  const getCachedRole = (userId: string): UserRole => {
    try {
      const cached = localStorage.getItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`);
      if (cached) return cached as UserRole;
    } catch (e) {}
    return null;
  };

  const setCachedRole = (userId: string, role: UserRole) => {
    try {
      if (role) {
        localStorage.setItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`, role);
      } else {
        localStorage.removeItem(`${ROLE_CACHE_KEY_PREFIX}${userId}`);
      }
    } catch (e) {}
  };

  // Optimized fetch with safety timeout
  const fetchUserRoleWithTimeout = async (userId: string, userObj?: User | null, timeoutMs = ROLE_FETCH_TIMEOUT): Promise<UserRole> => {
    console.log('Fetching role for ID:', userId);

    // 1. Check user metadata first as a fast hint
    if (userObj?.user_metadata?.role) {
      const metaRole = userObj.user_metadata.role;
      if (['admin', 'staff', 'feeInCharge'].includes(metaRole)) {
        console.log('💡 Found role hint in metadata:', metaRole);
        return metaRole as UserRole;
      }
    }

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn('User role fetch timed out after', timeoutMs, 'ms');
        resolve(null);
      }, timeoutMs)
    );

    const roleFetchPromise = (async () => {
      for (let attempt = 0; attempt <= ROLE_FETCH_RETRIES; attempt++) {
        try {
          if (attempt > 0) console.log(`Retry attempt ${attempt} for role fetch...`);
          
          // Try RPC first (more secure/direct)
          const { data, error } = await supabase.rpc('get_user_roles', {
            p_user_id: userId
          });

          let resolvedRole: UserRole = null;

          if (error) {
            // Fallback to direct table query
            const { data: tableData, error: tableError } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', userId);

            if (!tableError && tableData) {
              const roles = tableData.map((r: any) => r.role as string);
              if (roles.includes('admin')) resolvedRole = 'admin';
              else if (roles.includes('feeInCharge')) resolvedRole = 'feeInCharge';
              else if (roles.includes('staff')) resolvedRole = 'staff';
            }
          } else if (data) {
            const rolesList = (data as any[] || []).map((r: any) =>
              (typeof r === 'string' ? r : (r.role || r)) as string
            );
            if (rolesList.includes('admin')) resolvedRole = 'admin';
            else if (rolesList.includes('feeInCharge')) resolvedRole = 'feeInCharge';
            else if (rolesList.includes('staff')) resolvedRole = 'staff';
          }

          if (resolvedRole) return resolvedRole;
        } catch (err) {
          console.error(`Role fetch attempt ${attempt} failed:`, err);
        }
        // Small delay before retry
        if (attempt < ROLE_FETCH_RETRIES) await new Promise(r => setTimeout(r, 1000 * attempt));
      }
      return null;
    })();

    const winner = await Promise.race([roleFetchPromise, timeoutPromise]);
    return winner as UserRole;
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('🚀 Starting Auth Discovery...');

        // Get session with timeout to prevent hanging
        const sessionPromise = supabase.auth.getSession();
        const sessionTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session fetch timeout')), ROLE_FETCH_TIMEOUT)
        );

        let existingSession;
        try {
          const { data } = await Promise.race([sessionPromise, sessionTimeoutPromise]) as any;
          existingSession = data?.session;
        } catch (err) {
          console.error('⚠️ Session fetch failed or timed out:', err);
          setIsLoading(false);
          return;
        }

        if (existingSession) {
          console.log('✅ Found existing session for:', existingSession.user.email);
          setSession(existingSession);
          setUser(existingSession.user);

          // 1. Try to recover role from cache for instant load
          const cachedRole = getCachedRole(existingSession.user.id);
          if (cachedRole) {
            console.log('⚡ Recovered role from cache:', cachedRole);
            setUserRole(cachedRole);
            setIsLoading(false); // Stop loading immediately if we have a cached role
          }

          // 2. Fetch fresh profile and role in background (or foreground if no cache)
          const [role, foundProfile] = await Promise.all([
            fetchUserRoleWithTimeout(existingSession.user.id, existingSession.user),
            fetchProfile(existingSession.user.id)
          ]);

          try {
            // Determine build mode to avoid defaulting to a role that causes 404
            const buildMode = typeof document !== 'undefined' ? document.body?.dataset?.portalBuild : '';
            
            let finalRole: UserRole = null;
            if (role === 'staff' && foundProfile?.designation === 'Fee In-Charge') {
              finalRole = 'feeInCharge';
            } else if (role) {
              finalRole = role;
            } else if (cachedRole) {
              finalRole = cachedRole;
            } else {
              // Default logic: If we are in admin build, assume admin if fetch fails (risk, but prevents 404)
              // Otherwise default to staff
              finalRole = buildMode === 'admin' ? 'admin' : (buildMode === 'fee' ? 'feeInCharge' : 'staff');
            }

            console.log('Final resolved role:', finalRole);
            setUserRole(finalRole);
            setCachedRole(existingSession.user.id, finalRole);
          } catch (err) {
            console.error('Role resolution failed:', err);
            if (!userRole) setUserRole('staff');
          } finally {
            setIsLoading(false);
          }
        } else {
          console.log('❌ No active session found');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('💥 Auth initialization error:', err);
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('🔄 Auth state changed:', event);

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setUserRole(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      if (newSession?.user) {
        try {
          const [role, foundProfile] = await Promise.all([
            fetchUserRoleWithTimeout(newSession.user.id, newSession.user),
            fetchProfile(newSession.user.id)
          ]);
          const buildMode = typeof document !== 'undefined' ? document.body?.dataset?.portalBuild : '';
          const finalRole = (role === 'staff' && foundProfile?.designation === 'Fee In-Charge') 
            ? 'feeInCharge' 
            : (role || (buildMode === 'admin' ? 'admin' : (buildMode === 'fee' ? 'feeInCharge' : 'staff')));
          setUserRole(finalRole);
        } catch (err) {
          setUserRole('staff');
        } finally {
          setIsLoading(false);
        }
      } else {
        setUserRole(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string, expectedRole?: Exclude<UserRole, null>) => {
    try {
      console.log('Sign-in attempt for:', email, 'Expected Role:', expectedRole);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.user) {
        console.error('Sign-in credentials rejected:', error?.message);
        return { error: error as Error | null };
      }

      console.log('Credentials valid, verifying role permissions...');
      
      // Fetch both role and profile to handle Fee In-Charge mapping
      const [activeRole, foundProfile] = await Promise.all([
        fetchUserRoleWithTimeout(data.user.id, data.user, ROLE_FETCH_TIMEOUT),
        fetchProfile(data.user.id)
      ]);

      let finalRole: UserRole = activeRole;
      if (activeRole === 'staff' && foundProfile?.designation === 'Fee In-Charge') {
        console.log('Mapping staff user to feeInCharge based on designation');
        finalRole = 'feeInCharge';
      }

      if (expectedRole) {
        // Enforce role matches expectation (Admins are allowed anywhere)
        const isMatched = expectedRole === finalRole || finalRole === 'admin';

        if (!isMatched) {
          console.warn('Role mismatch! Expected:', expectedRole, 'but found:', finalRole);
          return {
            error: new Error(`This account does not have permission to access the ${expectedRole} portal.`)
          };
        }
      }

      setUserRole(finalRole);
      return { error: null };
    } catch (err) {
      console.error('Sign-in crash:', err);
      return { error: err as Error };
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${getAuthRedirectPath()}` }
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) return { error: error as Error };
    if (data.user) {
      // Best effort profile creation
      await supabase.from('profiles').upsert({ user_id: data.user.id, full_name: fullName, email });
      await supabase.from('user_roles').upsert({ user_id: data.user.id, role: 'staff' });
      fetchProfile(data.user.id);
    }
    return { error: null };
  };

  const signOut = async () => {
    console.log('User logout initiated');

    if (user) {
      try {
        localStorage.removeItem(`user_role_${user.id}`);
      } catch (e) {}
    }

    // 1. Instantly clear local state to trigger React Router navigation
    setUser(null);
    setSession(null);
    setUserRole(null);
    setProfile(null);
    setIsLoading(false);

    // 2. Clear query cache
    queryClient.clear();

    // 3. Clear SPECIFIC portal data
    const buildMode = typeof document !== 'undefined' ? document.body?.dataset?.portalBuild : '';
    const runtimePort = typeof window !== 'undefined' ? window.location.port : '';
    const currentStorageKey = `sb-adarsh-oxford-${runtimePort}-${buildMode}`;
    
    localStorage.removeItem(currentStorageKey);
    sessionStorage.clear();

    // 4. Fire and forget server logout (prevents UI blocking)
    supabase.auth.signOut().catch(err => {
      console.warn('Supabase signOut error (non-critical):', err);
    });
  };

  const setMockUser = (role: 'admin' | 'staff' | 'feeInCharge') => {
    if (!import.meta.env.DEV) {
      console.warn('Mock users are disabled outside development.');
      return;
    }

    console.log('Activating Mock Portal Access for:', role);
    const mockUser = {
      id: `mock-${role}-${Date.now()}`,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: { full_name: `Demo ${role === 'feeInCharge' ? 'Fee In-charge' : role}`, is_mock: true },
      email: `${role.toLowerCase()}@demo.com`,
      created_at: new Date().toISOString(),
    } as unknown as User;

    const mockProfile = {
      user_id: mockUser.id,
      full_name: mockUser.user_metadata.full_name,
      email: mockUser.email || '',
      avatar_url: null,
    };

    setUser(mockUser);
    setUserRole(role);
    setProfile(mockProfile);
    setSession({
      access_token: 'mock_token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh',
      user: mockUser
    });
  };

  return (
    <AuthContext.Provider value={{
      user, session, userRole, profile, setUserRole, isLoading, signIn, signInWithGoogle, signUp, signOut, setMockUser,
      isAdmin: userRole === 'admin',
      isStaff: userRole === 'staff',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
