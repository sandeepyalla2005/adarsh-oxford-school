import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { getPortalDashboardPath } from '@/lib/portal';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// Logos imported but managed via CSS and assets now

const loginSchema = z.object({
  email: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type RoleType = 'admin' | 'staff' | 'feeInCharge';

const portalMeta = {
  admin: {
    title: 'Admin Portal',
    subtitle: 'Full control over school operations, admissions, and reports.',
    image: '/school-building.jpg',
    primaryColor: 'bg-slate-900',
    accentColor: 'text-slate-900',
    tagline: 'SYSTEM ADMINISTRATION',
  },
  staff: {
    title: 'Staff Portal',
    subtitle: 'Manage your classes, student attendance, and academic tasks.',
    image: '/school-building.jpg',
    primaryColor: 'bg-emerald-600',
    accentColor: 'text-emerald-600',
    tagline: 'FACULTY ACCESS',
  },
  fee: {
    title: 'Accounts Portal',
    subtitle: 'Manage fee collections, student dues, and financial history.',
    image: '/school-building.jpg',
    primaryColor: 'bg-[#B8860B]', // Dark Goldenrod
    accentColor: 'text-[#B8860B]',
    tagline: 'FINANCE & ACCOUNTS',
  },
} as const;

type AuthProps = {
  allowedRoles: readonly RoleType[];
  portalType: 'admin' | 'staff' | 'fee';
};

export default function PortalAuth({ allowedRoles, portalType }: AuthProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleType>(allowedRoles[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [otp, setOtp] = useState('');
  const [newPass, setNewPass] = useState('');
  
  const { signIn, signInWithGoogle, user, userRole } = useAuth();

  useEffect(() => {
    if (showForgotModal) {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername && (cleanUsername.includes('@') || cleanUsername.includes('.'))) {
        setForgotEmail(cleanUsername);
      } else if (portalType === 'admin') {
        setForgotEmail('admin@adarshoxford.com');
      } else if (portalType === 'fee') {
        setForgotEmail('schooloxford2005@gmail.com');
      }
    }
  }, [showForgotModal, username, portalType]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const meta = portalMeta[portalType];

  useEffect(() => {
    if (user && userRole) {
      const dashboardPath = getPortalDashboardPath(userRole);
      navigate(dashboardPath, { replace: true });
    }
  }, [user, userRole, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const cleanUsername = username.trim().toLowerCase();
      const result = loginSchema.safeParse({ email: cleanUsername, password });
      
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: result.error.errors[0].message,
        });
        return;
      }

      const { error } = await signIn(cleanUsername, password, selectedRole);

      if (error) {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: error.message,
        });
      } else {
        toast({
          title: "Success",
          description: "Logged in successfully",
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      const { error } = await signInWithGoogle();
      if (error) {
        toast({
          variant: "destructive",
          title: "Google Sign-in Failed",
          description: error.message,
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "An unexpected error occurred during Google Sign-in",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const normalizedForgotEmail = forgotEmail.trim().toLowerCase();
      if (portalType === 'admin') {
        const isAdminEmail = normalizedForgotEmail.startsWith('sandeep.yalla506@gmail') || normalizedForgotEmail.startsWith('admin@adarshoxford.com');
        if (!isAdminEmail) {
          throw new Error('Password recovery is only allowed for authorized admin emails.');
        }
      } else if (portalType === 'fee') {
        if (!normalizedForgotEmail.startsWith('sandeep.yalla506@gmail') && !normalizedForgotEmail.startsWith('schooloxford2005@gmail')) {
          throw new Error('Password recovery is only allowed for authorized fee in-charge emails.');
        }
      }

      const response = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedForgotEmail, role: selectedRole }),
      });
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || data.detail || 'Failed to send OTP');
      }
      
      toast({
        title: "OTP Sent",
        description: "Please check your Gmail for the 6-digit code.",
      });
      setForgotStep('reset');
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const normalizedForgotEmail = forgotEmail.trim().toLowerCase();
      if (portalType === 'admin') {
        const isAdminEmail = normalizedForgotEmail.startsWith('sandeep.yalla506@gmail') || normalizedForgotEmail.startsWith('admin@adarshoxford.com');
        if (!isAdminEmail) {
          throw new Error('Password reset is only allowed for authorized admin emails.');
        }
      } else if (portalType === 'fee') {
        if (!normalizedForgotEmail.startsWith('sandeep.yalla506@gmail') && !normalizedForgotEmail.startsWith('schooloxford2005@gmail')) {
          throw new Error('Password reset is only allowed for authorized fee in-charge emails.');
        }
      }

      const response = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: normalizedForgotEmail, 
          otp, 
          new_password: newPass,
          role: selectedRole
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || data.detail || 'Failed to reset password');
      }
      
      toast({
        title: "Password Updated",
        description: "You can now login with your new password.",
      });
      setShowForgotModal(false);
      setForgotStep('request');
      setOtp('');
      setNewPass('');
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <div className="grid h-full w-full lg:grid-cols-[1.2fr_0.8fr] grid-rows-[auto_1fr] lg:grid-rows-1">
        {/* Left Side: Image Section */}
        <aside className="relative h-[30vh] lg:h-full w-full overflow-hidden group">
          <img
            src={meta.image}
            alt={`${portalType} Portal Background`}
            className="h-full w-full object-cover transition-transform duration-[20s] ease-linear group-hover:scale-110 brightness-[0.85] contrast-[1.05] saturate-[1.1]"
          />
          <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 lg:p-16 text-white bg-gradient-to-t from-black/80 via-black/20 to-transparent">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              <p className="text-[12px] lg:text-[14px] font-bold uppercase tracking-[0.5em] text-white/80 mb-2">
                {meta.tagline}
              </p>
              <h2 className="text-3xl lg:text-6xl font-black leading-none tracking-tighter mb-4">
                {meta.title}
              </h2>
              <p className="max-w-xl text-sm lg:text-base leading-relaxed text-white/70 hidden sm:block font-medium">
                {meta.subtitle}
              </p>
            </motion.div>
          </div>
        </aside>

        {/* Right Side: Login Form Section */}
        <main className="relative flex flex-col h-full overflow-y-auto lg:overflow-hidden items-center justify-center bg-slate-50 px-4 py-6 sm:px-8 lg:px-12">
          {/* Subtle background decoration for premium feel */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-50/50 rounded-full blur-3xl -ml-32 -mb-32" />

          <section className="relative w-full max-w-[500px] lg:my-auto z-10">
            <div className="rounded-[2.5rem] border border-white/40 bg-white/80 backdrop-blur-xl lg:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04),0_20px_50px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.02]">
              <div className="mb-8 border-b border-slate-100 pb-8">
                <div className="flex flex-col items-center mb-10 pt-4">
                  {/* Motto at the top, centered */}
                  <span className="text-[10px] lg:text-[12px] font-bold uppercase tracking-[0.4em] text-blue-600/60 mb-6 text-center w-full">
                    A Way and a Vision
                  </span>

                  {/* Branding Container: Crest + Name side-by-side */}
                  <div className="flex items-center justify-center gap-6 lg:gap-10">
                    {/* Official Crest */}
                    <div className="shrink-0">
                      <img 
                        src="/school-logo-official.png" 
                        alt="Logo" 
                        className="h-16 w-16 lg:h-24 lg:w-24 object-contain drop-shadow-lg"
                      />
                    </div>

                    {/* School Name Branding (Right of Crest) */}
                    <div className="flex flex-col justify-center leading-none">
                      <h1 className="flex flex-col gap-1">
                        <span className="text-3xl lg:text-5xl font-black tracking-tighter text-slate-950">
                          Oxford
                        </span>
                        <span className="text-3xl lg:text-5xl font-medium tracking-tight text-red-600">
                          School
                        </span>
                      </h1>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">
                    Email / Username <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="Enter Email / Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-14 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-base"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      Password <span className="text-red-500">*</span>
                      <Info className="h-3 w-3 text-blue-500" />
                    </Label>
                  </div>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-base"
                    required
                  />
                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox 
                      id="show-password" 
                      checked={showPassword} 
                      onCheckedChange={(checked) => setShowPassword(!!checked)}
                      className="rounded-md border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <label 
                      htmlFor="show-password" 
                      className="text-xs font-semibold text-slate-500 cursor-pointer select-none hover:text-slate-700 transition-colors"
                    >
                      Show Password
                    </label>
                  </div>
                </div>

                {allowedRoles.length > 1 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Select Access Role</p>
                    <div className="flex flex-wrap gap-3">
                      {allowedRoles.map((role) => (
                        <Button
                          key={role}
                          type="button"
                          variant={selectedRole === role ? 'default' : 'outline'}
                          onClick={() => setSelectedRole(role)}
                          className={cn(
                            'h-11 px-8 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all duration-300',
                            selectedRole === role
                              ? cn(meta.primaryColor, 'text-white border-transparent shadow-lg shadow-black/5 ring-4 ring-black/5 scale-105')
                              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          {role}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="h-14 flex-1 bg-[#20b2aa] hover:bg-[#1a948e] hover:-translate-y-1 text-white font-black text-base lg:text-lg rounded-xl shadow-[0_10px_20px_-5px_rgba(32,178,170,0.3)] transition-all active:scale-[0.98]"
                  >
                    {isSubmitting ? 'Authenticating...' : 'LOGIN'}
                  </Button>
                  <Button 
                    type="button" 
                    onClick={() => setShowForgotModal(true)}
                    className="h-14 flex-1 bg-[#ff4d4d] hover:bg-[#e64545] hover:-translate-y-1 text-white font-black text-base lg:text-lg rounded-xl shadow-[0_10px_20px_-5px_rgba(255,77,77,0.3)] transition-all active:scale-[0.98]"
                  >
                    FORGOT PASSWORD
                  </Button>
                </div>

                <div className="flex flex-col items-center gap-4 pt-6">
                  <div className="flex items-center w-full gap-4">
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">OR</span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleGoogleSignIn}
                    className="w-full h-14 border-slate-200 rounded-xl hover:bg-slate-50 transition-all hover:shadow-md"
                  >
                    <img 
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                      alt="Google Logo" 
                      className="h-5 w-5 mr-3" 
                    />
                    <span className="text-sm font-bold text-slate-700">Sign in with Google</span>
                  </Button>
                </div>

                <div className="pt-8 text-center">
                  <p className="text-slate-600 text-sm">
                    Please use Google Chrome for better experience
                  </p>
                </div>
              </form>
            </div>
          </section>
        </main>
      </div>

      <Dialog open={showForgotModal} onOpenChange={setShowForgotModal}>
        <DialogContent className="sm:max-w-md bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Password Recovery</DialogTitle>
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
                  className="rounded-xl bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  required
                />
                {portalType === 'admin' && (
                  <p className="text-xs text-slate-500 font-medium">
                    Password recovery OTP will only be sent to authorized admin emails (admin@adarshoxford.com or sandeep.yalla506@gmail.com).
                  </p>
                )}
                {portalType === 'fee' && (
                  <p className="text-xs text-slate-500 font-medium">
                    Password recovery OTP will only be sent to authorized fee in-charge emails (sandeep.yalla506@gmail.com or schooloxford2005@gmail.com).
                  </p>
                )}
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-[#002147] rounded-xl">
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
                  className="rounded-xl"
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
                  className="rounded-xl"
                  required
                />
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl">
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
