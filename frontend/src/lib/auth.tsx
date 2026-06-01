import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getAuthRedirectPath, getAppBuildMode } from '@/lib/portal';
import { queryClient } from '@/lib/query-client';
import { toast } from '@/hooks/use-toast';

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

const ROLE_FETCH_TIMEOUT = 10000; // 10s is enough for cold starts
const SESSION_FETCH_TIMEOUT = 8000; // 8s for session refresh – show login form fast
const ROLE_FETCH_RETRIES = 2; // Keep 2 retries for extra robustness
const ROLE_CACHE_KEY_PREFIX = 'user_role_';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Module-level cache to deduplicate concurrent backend requests
const inFlightRoleFetches = new Map<string, Promise<UserRole>>();
const inFlightProfileQueries = new Map<string, Promise<Profile | null>>();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch profile for the current user (deduplicated)
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const cachedPromise = inFlightProfileQueries.get(userId);
    if (cachedPromise) {
      return cachedPromise;
    }

    const promise = (async () => {
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
      } finally {
        inFlightProfileQueries.delete(userId);
      }
    })();

    inFlightProfileQueries.set(userId, promise);
    return promise;
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

  // Optimized fetch with safety timeout and concurrent request deduplication
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

    let roleFetchPromise = inFlightRoleFetches.get(userId);
    if (!roleFetchPromise) {
      roleFetchPromise = (async () => {
        try {
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
        } finally {
          inFlightRoleFetches.delete(userId);
        }
      })();
      inFlightRoleFetches.set(userId, roleFetchPromise);
    }

    const winner = await Promise.race([roleFetchPromise, timeoutPromise]);
    return winner as UserRole;
  };

  // Helper: nuke every Supabase token from storage so the next load is clean
  const clearStaleSupabaseTokens = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.startsWith('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      console.log('🧹 Cleared', keysToRemove.length, 'stale Supabase token(s)');
    } catch (e) {
      console.warn('Could not clear stale tokens:', e);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('🚀 Starting Auth Discovery...');

        // Get session with a FAST timeout – don't let a stale token hang the UI
        const sessionPromise = supabase.auth.getSession();
        const sessionTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session fetch timeout')), SESSION_FETCH_TIMEOUT)
        );

        let existingSession;
        try {
          const { data } = await Promise.race([sessionPromise, sessionTimeoutPromise]) as any;
          existingSession = data?.session;
        } catch (err) {
          console.error('⚠️ Session fetch failed or timed out:', err);
          // CRITICAL: purge the stale token so the NEXT page load is instant
          clearStaleSupabaseTokens();
          setIsLoading(false);
          return;
        }

        if (existingSession) {
          const userEmail = existingSession.user.email;
          const provider = existingSession.user.app_metadata?.provider;
          const isGoogle = provider === 'google' || existingSession.user.identities?.some(id => id.provider === 'google');
          const buildMode = getAppBuildMode();

          if (buildMode === 'admin' && isGoogle && userEmail && !userEmail.startsWith('sandeep.yalla506@gmail')) {
            console.warn('Unauthorized Google session active on admin portal, logging out:', userEmail);
            toast({
              variant: "destructive",
              title: "Access Denied",
              description: "Only the authorized email (sandeep.yalla506@gmail.com) can log in with Google on the Admin portal."
            });
            clearStaleSupabaseTokens();
            setIsLoading(false);
            supabase.auth.signOut();
            return;
          }

          if (buildMode === 'fee' && isGoogle && userEmail && !userEmail.startsWith('sandeep.yalla506@gmail') && !userEmail.startsWith('schooloxford2005@gmail')) {
            console.warn('Unauthorized Google session active on Accounts portal, logging out:', userEmail);
            toast({
              variant: "destructive",
              title: "Access Denied",
              description: "Only the authorized emails (sandeep.yalla506@gmail.com, schooloxford2005@gmail.com) can log in with Google on the Accounts portal."
            });
            clearStaleSupabaseTokens();
            setIsLoading(false);
            supabase.auth.signOut();
            return;
          }

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
        // Also clear tokens on unexpected crashes to prevent repeat hangs
        clearStaleSupabaseTokens();
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('🔄 Auth state changed:', event);

      if (newSession?.user) {
        const userEmail = newSession.user.email;
        const provider = newSession.user.app_metadata?.provider;
        const isGoogle = provider === 'google' || newSession.user.identities?.some(id => id.provider === 'google');
        const buildMode = getAppBuildMode();

        if (buildMode === 'admin' && isGoogle && userEmail && !userEmail.startsWith('sandeep.yalla506@gmail')) {
          console.warn('Unauthorized Google login attempt on admin portal, logging out:', userEmail);
          toast({
            variant: "destructive",
            title: "Access Denied",
            description: "Only the authorized email (sandeep.yalla506@gmail.com) can log in with Google on the Admin portal."
          });
          setUser(null);
          setSession(null);
          setUserRole(null);
          setProfile(null);
          setIsLoading(false);
          supabase.auth.signOut();
          return;
        }

        if (buildMode === 'fee' && isGoogle && userEmail && !userEmail.startsWith('sandeep.yalla506@gmail') && !userEmail.startsWith('schooloxford2005@gmail')) {
          console.warn('Unauthorized Google login attempt on Accounts portal, logging out:', userEmail);
          toast({
            variant: "destructive",
            title: "Access Denied",
            description: "Only the authorized emails (sandeep.yalla506@gmail.com, schooloxford2005@gmail.com) can log in with Google on the Accounts portal."
          });
          setUser(null);
          setSession(null);
          setUserRole(null);
          setProfile(null);
          setIsLoading(false);
          supabase.auth.signOut();
          return;
        }
      }

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
          const result = await Promise.race([
            Promise.all([
              fetchUserRoleWithTimeout(newSession.user.id, newSession.user, 5000),
              fetchProfile(newSession.user.id)
            ]),
            new Promise<[null, null]>((resolve) =>
              setTimeout(() => resolve([null, null]), 6000)
            ),
          ]);
          const [role, foundProfile] = result;
          const mode = getAppBuildMode();
          const portalDefault: UserRole = mode === 'fee' ? 'feeInCharge' : mode === 'staff' ? 'staff' : 'admin';
          const finalRole = (role === 'staff' && foundProfile?.designation === 'Fee In-Charge') 
            ? 'feeInCharge' 
            : (role || getCachedRole(newSession.user.id) || portalDefault);
          setUserRole(finalRole);
          if (finalRole) setCachedRole(newSession.user.id, finalRole);
        } catch (err) {
          console.warn('onAuthStateChange role fetch failed:', err);
          setUserRole(getCachedRole(newSession.user.id) || 'staff');
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

      // ── Wrap the Supabase auth call in a 15s timeout to prevent infinite hang ──
      const authResult = await Promise.race([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Login timed out — please check your internet connection and try again.')), 15000)
        ),
      ]);
      const { data, error } = authResult;

      if (error || !data.user) {
        const msg = error?.message || 'Unknown error';
        console.error('Sign-in credentials rejected:', msg);
        // Make "Failed to fetch" more user-friendly
        const friendlyMsg = msg.includes('Failed to fetch') || msg.includes('NetworkError')
          ? 'Network error — please check your internet connection and try again.'
          : msg;
        return { error: new Error(friendlyMsg) };
      }

      console.log('Credentials valid, resolving role (6s hard limit)...');

      // ── Hard 6-second safety net for the ENTIRE role+profile lookup ──
      let finalRole: UserRole = null;
      try {
        const result = await Promise.race([
          Promise.all([
            fetchUserRoleWithTimeout(data.user.id, data.user, 5000),
            fetchProfile(data.user.id),
          ]),
          new Promise<[null, null]>((resolve) =>
            setTimeout(() => {
              console.warn('⏱️ Role+profile lookup timed out at 6s');
              resolve([null, null]);
            }, 6000)
          ),
        ]);

        const [activeRole, foundProfile] = result;

        if (activeRole === 'staff' && foundProfile?.designation === 'Fee In-Charge') {
          console.log('Mapping staff → feeInCharge via designation');
          finalRole = 'feeInCharge';
        } else if (activeRole) {
          finalRole = activeRole;
        }
      } catch (roleFetchErr) {
        console.warn('Role fetch crashed, will use portal default:', roleFetchErr);
      }

      // ── If role fetch failed / timed out, trust the portal's expected role ──
      if (!finalRole) {
        console.log('Role unknown – defaulting to portal expected role:', expectedRole || 'admin');
        finalRole = expectedRole || 'admin';
      }

      // ── Role gate: non-admin users can't access portals they don't belong to ──
      if (expectedRole && finalRole !== 'admin') {
        const isMatched = expectedRole === finalRole;
        if (!isMatched) {
          console.warn('Role mismatch! Expected:', expectedRole, 'but found:', finalRole);
          return {
            error: new Error(`This account does not have permission to access the ${expectedRole} portal.`)
          };
        }
      }

      console.log('✅ Login complete. Role:', finalRole);
      setUserRole(finalRole);
      if (finalRole) setCachedRole(data.user.id, finalRole);
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
        localStorage.removeItem('admin_last_activity');
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
    const mode = getAppBuildMode();
    const runtimePort = typeof window !== 'undefined' ? window.location.port : '';
    const currentStorageKey = `sb-adarsh-oxford-${mode}-${runtimePort}`;
    
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

  // Auto logout on inactivity (1 hour) specifically for admin
  useEffect(() => {
    if (!user || userRole !== 'admin') return;

    const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour in ms
    const STORAGE_KEY = 'admin_last_activity';

    // Initialize/sync last activity time
    const initActivity = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      }
    };
    initActivity();

    const handleActivity = () => {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    };

    // Events that indicate user activity
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    const checkInterval = setInterval(() => {
      const storedTime = localStorage.getItem(STORAGE_KEY);
      const lastActivity = storedTime ? parseInt(storedTime, 10) : Date.now();
      const elapsed = Date.now() - lastActivity;

      if (elapsed >= INACTIVITY_TIMEOUT) {
        console.log('🚪 Admin session expired due to inactivity of more than 1 hour. Logging out...');
        // Clear activity key so we don't loop
        localStorage.removeItem(STORAGE_KEY);
        signOut();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(checkInterval);
    };
  }, [user, userRole, signOut]);

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
