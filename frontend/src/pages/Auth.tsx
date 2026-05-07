import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { getPortalDashboardPath, getPortalFromRole } from '@/lib/portal';
import { cn } from '@/lib/utils';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type RoleType = 'admin' | 'staff' | 'feeInCharge';

const DEFAULT_VISIBLE_ROLES: RoleType[] = ['staff', 'feeInCharge', 'admin'];

type AuthProps = {
  allowedRoles?: readonly RoleType[];
};

const portalMeta = {
  admin: {
    title: 'Admin Portal',
    subtitle: 'Full control over school operations, admissions, and reports.',
    image: '/school-building.jpg',
    primaryColor: 'bg-slate-900',
    accentColor: 'text-slate-900',
    tagline: 'System Administration',
  },
  staff: {
    title: 'Staff Portal',
    subtitle: 'Manage your classes, student attendance, and academic tasks.',
    image: '/school-building.jpg',
    primaryColor: 'bg-emerald-600',
    accentColor: 'text-emerald-600',
    tagline: 'Faculty Access',
  },
  fee: {
    title: 'Accounts Portal',
    subtitle: 'Manage fee collections, student dues, and financial history.',
    image: '/school-building.jpg',
    primaryColor: 'bg-[#B8860B]', // Dark Goldenrod
    accentColor: 'text-[#B8860B]',
    tagline: 'Finance & Accounts',
  },
} as const;

export default function Auth({ allowedRoles }: AuthProps = {}) {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, user, userRole, isLoading } = useAuth();
  const { toast } = useToast();
  const buildPortal = (document.body?.dataset?.portalBuild as 'admin' | 'staff' | 'fee' | undefined) ?? undefined;

  const visibleRoles = allowedRoles ? [...allowedRoles] : DEFAULT_VISIBLE_ROLES;
  const displayPortal = useMemo(() => {
    if (allowedRoles?.length === 1) {
      return getPortalFromRole(allowedRoles[0]);
    }
    if (buildPortal === 'admin' || buildPortal === 'fee') return buildPortal;
    return 'staff';
  }, [allowedRoles, buildPortal]);

  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleType>(
    (allowedRoles?.[0] as RoleType | undefined) ?? (buildPortal === 'fee' ? 'feeInCharge' : buildPortal === 'admin' ? 'admin' : 'staff')
  );

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [otp, setOtp] = useState('');
  const [newPass, setNewPass] = useState('');

  useEffect(() => {
    const isAdmin = userRole === 'admin';
    const isAllowed = !allowedRoles || allowedRoles.includes(userRole as RoleType) || isAdmin;

    if (user && userRole && !isLoading && isAllowed) {
      navigate(getPortalDashboardPath(userRole));
    }
  }, [allowedRoles, isLoading, navigate, user, userRole]);

  useEffect(() => {
    if (!visibleRoles.includes(selectedRole)) {
      setSelectedRole(visibleRoles[0] ?? 'staff');
    }
  }, [selectedRole, visibleRoles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!visibleRoles.includes(selectedRole)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Role',
        description: 'This portal does not allow the selected role.',
      });
      return;
    }

    try {
      if (isLogin) {
        loginSchema.parse({ email, password });
      } else {
        if (password.length < 6) {
          toast({
            variant: 'destructive',
            title: 'Invalid Password',
            description: 'Password must be at least 6 characters',
          });
          return;
        }
        if (!fullName) {
          toast({
            variant: 'destructive',
            title: 'Name Required',
            description: 'Please enter your full name',
          });
          return;
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: error.errors[0].message,
        });
        return;
      }
    }

    setIsSubmitting(true);

    if (isLogin) {
      const { error } = await signIn(email, password, selectedRole);
      if (error) {
        setError(error.message || 'Invalid email or password');
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: error.message || 'Invalid email or password',
        });
      } else {
        setSuccess('Successfully logged in.');
        toast({
          title: 'Welcome back!',
          description: 'Successfully logged in.',
        });
        navigate(getPortalDashboardPath(selectedRole));
      }
    } else {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        setError(error.message);
        toast({
          variant: 'destructive',
          title: 'Sign Up Failed',
          description: error.message,
        });
      } else {
        setSuccess('Account created.');
        toast({
          title: 'Account Created',
          description: 'Please check your email for verification link.',
        });
        setIsLogin(true);
      }
    }

    setIsSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRole !== 'staff') {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Self-service reset is only available for Staff. Admins must contact primary administration.',
      });
      setShowForgotModal(false);
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const resp = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      if (!resp.ok) throw new Error('Failed to send OTP');
      setForgotStep('verify');
      setSuccess('OTP sent.');
      toast({ title: 'OTP Sent', description: 'Check your Gmail for the 6-digit code.' });
    } catch (err: any) {
      setError(err.message);
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const resp = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp, new_password: newPass }),
      });
      if (!resp.ok) throw new Error('Reset failed. Check OTP.');
      setShowForgotModal(false);
      setForgotStep('request');
      setIsLogin(true);
      setSuccess('Password updated. Please login now.');
      toast({ title: 'Success', description: 'Password updated. Please login now.' });
    } catch (err: any) {
      setError(err.message);
      toast({ variant: 'destructive', title: 'Reset Failed', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
        <aside className="relative hidden overflow-hidden lg:block">
          <img
            src={portalMeta[displayPortal].image}
            alt={`${displayPortal} Portal Background`}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-12 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.5em] text-white/60">
              {portalMeta[displayPortal].tagline}
            </p>
            <h2 className="mt-3 max-w-2xl text-4xl font-bold leading-tight">
              {portalMeta[displayPortal].title}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">
              {portalMeta[displayPortal].subtitle}
            </p>
          </div>
        </aside>

        <main className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
          <section className="w-full max-w-[540px] rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-8">
            <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <img src="/school-logo.png" alt="School Logo" className="h-11 w-11 object-contain" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400">Adarsh Oxford</p>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">OXFORD</h1>
                  <p className={cn("text-[11px] font-semibold uppercase tracking-[0.28em]", portalMeta[displayPortal].accentColor)}>
                    English Medium School
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {(buildPortal === undefined || buildPortal as string === 'combined') && visibleRoles.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Role</p>
                  <div className="flex flex-wrap gap-3">
                     {visibleRoles.map((role) => (
                       <button
                         key={role}
                         type="button"
                         onClick={() => setSelectedRole(role)}
                         className={cn(
                           'rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
                           selectedRole === role
                             ? cn(portalMeta[displayPortal].primaryColor, 'text-white border-transparent shadow-md transform scale-105')
                             : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                         )}
                       >
                         {role === 'feeInCharge' ? 'Fee In-Charge' : role.charAt(0).toUpperCase() + role.slice(1)}
                       </button>
                     ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Username
                </Label>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 focus-within:border-slate-400">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Mobile No. / Email / Staff Code"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-0 bg-transparent p-0 text-sm shadow-none placeholder:text-slate-400 focus-visible:ring-0"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Password
                </Label>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 focus-within:border-slate-400">
                  <Lock className="h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-0 bg-transparent p-0 text-sm shadow-none placeholder:text-slate-400 focus-visible:ring-0"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="rounded-lg px-2 py-1 text-slate-400 transition-colors hover:text-slate-900"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="submit"
                  className={cn(
                    "h-12 flex-1 rounded-2xl text-white transition-all duration-200 shadow-lg",
                    portalMeta[displayPortal].primaryColor,
                    "hover:opacity-90 active:scale-[0.98]"
                  )}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Verifying...' : 'Sign In'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  variant="destructive"
                  className="h-12 flex-1 rounded-2xl"
                >
                  Forgot Password
                </Button>
              </div>

              <Button
                type="button"
                onClick={async () => {
                  setError('');
                  setSuccess('');
                  setIsSubmitting(true);
                  const { error: googleError } = await signInWithGoogle();
                  setIsSubmitting(false);
                  if (googleError) {
                    toast({
                      variant: 'destructive',
                      title: 'Google Sign-in Failed',
                      description: googleError.message || 'Unable to continue with Google.',
                    });
                  }
                }}
                variant="outline"
                className="h-12 w-full rounded-2xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                disabled={isSubmitting}
              >
                <span className="mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-blue-600">
                  G
                </span>
                Sign in with Google
              </Button>
            </form>
          </section>
        </main>
      </div>

      <Dialog open={showForgotModal} onOpenChange={setShowForgotModal}>
        <DialogContent className="sm:max-w-md bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002147]">Password Recovery</DialogTitle>
            <DialogDescription>
              {forgotStep === 'request'
                ? 'Enter your registered Gmail to receive an OTP.'
                : 'Enter the OTP sent to your Gmail and your new password.'}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === 'request' ? (
            <form onSubmit={handleForgotPassword} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Gmail Address</Label>
                <Input
                  type="email"
                  placeholder="name@gmail.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="rounded-sm"
                  required
                />
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-[#002147] rounded-sm">
                {isSubmitting ? 'Sending...' : 'Send OTP'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>6-Digit OTP</Label>
                <Input
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="rounded-sm"
                  maxLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className="rounded-sm"
                  required
                />
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-sm">
                {isSubmitting ? 'Resetting...' : 'Update Password'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setForgotStep('request')} className="w-full text-xs">
                Back to Email
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
