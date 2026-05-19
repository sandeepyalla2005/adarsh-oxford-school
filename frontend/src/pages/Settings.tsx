import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  School,
  Phone,
  Mail,
  Building2,
  IndianRupee,
  QrCode,
  Upload,
  Download,
  UsersRound,
  ArrowRight
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SchoolSetting {
  id: string;
  school_name: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  logo_url: string;
  bank_name: string;
  bank_account: string;
  bank_ifsc: string;
  upi_id: string;
  current_academic_year: string;
  created_at: string;
  updated_at: string;
}

export default function Settings() {
  const { user, isAdmin, isStaff, userRole } = useAuth();
  const { toast } = useToast();

  const [settings, setSettings] = useState<SchoolSetting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [promoteOtp, setPromoteOtp] = useState('');
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [formData, setFormData] = useState({
    school_name: '',
    school_address: '',
    school_phone: '',
    school_email: '',
    logo_url: '',
    bank_name: '',
    bank_account: '',
    bank_ifsc: '',
    upi_id: '',
    current_academic_year: '',
  });
  const [staffForm, setStaffForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    gender: '',
    subject: '',
    password: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const { data: settingsList, error } = await supabase
        .from('school_settings')
        .select('*')
        .limit(1);

      if (error) throw error;

      const serverData = settingsList && settingsList.length > 0 ? settingsList[0] : null;

      if (serverData) {
        const data = serverData as SchoolSetting;
        setSettings(data);
        setFormData({
          school_name: data.school_name || 'Adarsh Oxford',
          school_address: data.school_address || '',
          school_phone: data.school_phone || '',
          school_email: data.school_email || '',
          logo_url: data.logo_url || '',
          bank_name: data.bank_name || '',
          bank_account: data.bank_account || '',
          bank_ifsc: data.bank_ifsc || '',
          upi_id: data.upi_id || '',
          current_academic_year: data.current_academic_year || getCurrentAcademicYear(),
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load settings',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isStaff) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'Staff users cannot modify school settings.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('school_settings')
        .update({
          school_name: formData.school_name,
          school_address: formData.school_address,
          school_phone: formData.school_phone,
          school_email: formData.school_email,
          logo_url: formData.logo_url,
          bank_name: formData.bank_name,
          bank_account: formData.bank_account,
          bank_ifsc: formData.bank_ifsc,
          upi_id: formData.upi_id,
          current_academic_year: formData.current_academic_year,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings?.id);

      if (error) throw error;

      toast({
        title: 'Settings Updated',
        description: 'School settings have been updated successfully.',
      });

      fetchSettings();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to save settings',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromoteStudents = async (otpOverride?: string) => {
    // Guard: if a DOM event was accidentally passed (e.g. via onClick={fn}), discard it
    if (otpOverride !== undefined && typeof otpOverride !== 'string') {
      otpOverride = undefined;
    }
    if (userRole === 'staff') {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'Staff users cannot promote students.',
      });
      return;
    }

    const isFeeInCharge = userRole === 'feeInCharge';

    // If feeInCharge and we haven't obtained/passed an OTP yet, start OTP request
    if (isFeeInCharge && !otpOverride) {
      const confirmed = window.confirm(
        'Promote all active students to the next class? Admin permission (OTP) is required.'
      );
      if (!confirmed) return;

      setIsRequestingOtp(true);
      try {
        const resp = await apiFetch('/api/auth/request-wipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'promote' })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.detail || 'Failed to request OTP');
        setShowOtpDialog(true);
        toast({ title: '🔐 OTP Sent', description: data.message || 'Please get the 6-digit verification code from Admin.' });
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'OTP Request Failed', description: err.message });
      } finally {
        setIsRequestingOtp(false);
      }
      return;
    }

    // Admin confirmation
    if (!isFeeInCharge) {
      const confirmed = window.confirm(
        'Promote all active students to the next class? Inactive (dropout) students will be skipped.'
      );
      if (!confirmed) return;
    }

    setIsPromoting(true);
    try {
      const resp = await apiFetch('/api/students/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otpOverride || null })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || 'Promotion failed');

      toast({
        title: 'Promotion Complete',
        description: data.message || `Promoted ${data.promoted} students. Skipped ${data.skipped} students.`,
      });
      setShowOtpDialog(false);
      setPromoteOtp('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Promotion Failed',
        description: error.message || 'Failed to promote students',
      });
    } finally {
      setIsPromoting(false);
    }
  };

  const resetStaffForm = () => {
    setStaffForm({
      full_name: '',
      email: '',
      phone: '',
      gender: '',
      subject: '',
      password: '',
    });
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isStaff) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'Staff users cannot add new staff.',
      });
      return;
    }

    if (!staffForm.full_name || !staffForm.email || !staffForm.password) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Name, email, and password are required.',
      });
      return;
    }

    if (staffForm.password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Password must be at least 6 characters.',
      });
      return;
    }

    setIsCreatingStaff(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: staffForm.email,
        password: staffForm.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: staffForm.full_name,
            gender: staffForm.gender,
            subject: staffForm.subject,
            phone: staffForm.phone,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          full_name: staffForm.full_name,
          email: staffForm.email,
          phone: staffForm.phone || null,
          gender: staffForm.gender || null,
          subject: staffForm.subject || null,
        });

      if (profileError) throw profileError;

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'staff',
        });

      if (roleError) throw roleError;

      toast({
        title: 'Staff Created',
        description: 'New staff account created successfully.',
      });
      resetStaffForm();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to create staff user.',
      });
    } finally {
      setIsCreatingStaff(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">School Settings</h1>
            <p className="text-muted-foreground mt-1">
              Configure school-wide settings and information
            </p>
          </div>
        </div>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-primary" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="school_name">School Name *</Label>
                    <div className="relative">
                      <School className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="school_name"
                        value={formData.school_name}
                        onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                        className="pl-10"
                        placeholder="Enter school name"
                        required
                        disabled={isStaff}
                      />
                      {isStaff && (
                        <span className="absolute right-3 top-3 text-xs text-muted-foreground">(Admin only)</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="school_address">School Address</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="school_address"
                        value={formData.school_address}
                        onChange={(e) => setFormData({ ...formData, school_address: e.target.value })}
                        className="pl-10"
                        placeholder="Enter school address"
                        disabled={isStaff}
                      />
                      {isStaff && (
                        <span className="absolute right-3 top-3 text-xs text-muted-foreground">(Admin only)</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="school_phone">School Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="school_phone"
                        value={formData.school_phone}
                        onChange={(e) => setFormData({ ...formData, school_phone: e.target.value })}
                        className="pl-10"
                        placeholder="Enter school phone number"
                        disabled={isStaff}
                      />
                      {isStaff && (
                        <span className="absolute right-3 top-3 text-xs text-muted-foreground">(Admin only)</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="school_email">School Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="school_email"
                        type="email"
                        value={formData.school_email}
                        onChange={(e) => setFormData({ ...formData, school_email: e.target.value })}
                        className="pl-10"
                        placeholder="Enter school email"
                        disabled={isStaff}
                      />
                      {isStaff && (
                        <span className="absolute right-3 top-3 text-xs text-muted-foreground">(Admin only)</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="current_academic_year">Current Academic Year *</Label>
                    <Input
                      id="current_academic_year"
                      value={formData.current_academic_year}
                      onChange={(e) => setFormData({ ...formData, current_academic_year: e.target.value })}
                      placeholder="e.g., 2024-25"
                      required
                      disabled={isStaff}
                    />
                    {isStaff && (
                      <span className="text-xs text-muted-foreground">(Admin only)</span>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="logo_url">Logo URL</Label>
                    <Input
                      id="logo_url"
                      value={formData.logo_url}
                      onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                      placeholder="Enter logo URL"
                      disabled={isStaff}
                    />
                    {isStaff && (
                      <span className="text-xs text-muted-foreground">(Admin only)</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Input
                      id="bank_name"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="Enter bank name"
                      disabled={isStaff}
                    />
                    {isStaff && (
                      <span className="text-xs text-muted-foreground">(Admin only)</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank_account">Bank Account</Label>
                    <Input
                      id="bank_account"
                      value={formData.bank_account}
                      onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                      placeholder="Enter bank account number"
                      disabled={isStaff}
                    />
                    {isStaff && (
                      <span className="text-xs text-muted-foreground">(Admin only)</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bank_ifsc">IFSC Code</Label>
                    <Input
                      id="bank_ifsc"
                      value={formData.bank_ifsc}
                      onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value })}
                      placeholder="Enter IFSC code"
                      disabled={isStaff}
                    />
                    {isStaff && (
                      <span className="text-xs text-muted-foreground">(Admin only)</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="upi_id">UPI ID</Label>
                    <div className="relative">
                      <QrCode className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="upi_id"
                        value={formData.upi_id}
                        onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                        className="pl-10"
                        placeholder="Enter UPI ID"
                        disabled={isStaff}
                      />
                      {isStaff && (
                        <span className="absolute right-3 top-3 text-xs text-muted-foreground">(Admin only)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="btn-oxford"
                  disabled={isSubmitting || isStaff}
                >
                  {isSubmitting ? 'Saving...' : isStaff ? 'Save Changes (Admin only)' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" />
              Academic Year Promotion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  Promote active students to the next class
                </p>
                <p className="text-sm text-muted-foreground">
                  This will move all active students to the next class based on class order.
                  Inactive (dropout) students are skipped. Students in the highest class are not changed.
                </p>
              </div>
              <Button
                type="button"
                className="btn-oxford"
                onClick={() => handlePromoteStudents()}
                disabled={isPromoting || isStaff}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                {isPromoting ? 'Promoting...' : isStaff ? 'Promote (Admin only)' : 'Promote Students'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" />
              Add Staff Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateStaff} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="staff_full_name">Name *</Label>
                  <Input
                    id="staff_full_name"
                    value={staffForm.full_name}
                    onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
                    placeholder="Full name"
                    required
                    disabled={isStaff}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff_email">Email *</Label>
                  <Input
                    id="staff_email"
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="staff@school.edu"
                    required
                    disabled={isStaff}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff_phone">Phone</Label>
                  <Input
                    id="staff_phone"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    disabled={isStaff}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff_gender">Gender</Label>
                  <Input
                    id="staff_gender"
                    value={staffForm.gender}
                    onChange={(e) => setStaffForm({ ...staffForm, gender: e.target.value })}
                    placeholder="Male / Female / Other"
                    disabled={isStaff}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff_subject">Subject</Label>
                  <Input
                    id="staff_subject"
                    value={staffForm.subject}
                    onChange={(e) => setStaffForm({ ...staffForm, subject: e.target.value })}
                    placeholder="Mathematics"
                    disabled={isStaff}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff_password">Password *</Label>
                  <Input
                    id="staff_password"
                    type="password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    disabled={isStaff}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="btn-oxford"
                  disabled={isCreatingStaff || isStaff}
                >
                  {isCreatingStaff ? 'Creating...' : isStaff ? 'Add Staff (Admin only)' : 'Add Staff'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* OTP Dialog for Promotion */}
        <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
          <DialogContent className="max-w-xl rounded-3xl border-none shadow-2xl bg-white p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-800">
                Admin OTP Required
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                Please enter the 6-digit confirmation code sent to the administrator to authorize academic student promotion.
              </DialogDescription>
            </DialogHeader>

            <div className="my-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 p-4 space-y-3 text-xs">
              <div className="border-b border-emerald-200 pb-2 flex justify-between items-center">
                <span className="font-extrabold uppercase tracking-wider text-emerald-800">Academic Year Promotion</span>
                <Badge className="bg-emerald-600 text-white border-emerald-700 uppercase text-[9px] font-bold">BULK ACTION</Badge>
              </div>
              <p className="text-emerald-700 font-bold leading-relaxed">
                This operation will automatically advance all active students across all classes to their next respective academic standards (e.g., Nursery → LKG → UKG → Class 1).
              </p>
              <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-2">
                Skipped: All dropout (inactive) or graduated students. Ensure your term setup and final fees have been verified before completing.
              </p>
            </div>

            <div className="py-2 space-y-2">
              <Input
                type="text"
                placeholder="Enter 6-digit OTP"
                value={promoteOtp}
                onChange={(e) => setPromoteOtp(e.target.value)}
                className="text-center text-xl font-bold tracking-[0.2em] rounded-xl py-6"
                maxLength={6}
              />
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowOtpDialog(false); setPromoteOtp(''); }} className="rounded-xl flex-1 py-6">
                Cancel
              </Button>
              <Button
                onClick={() => handlePromoteStudents(promoteOtp)}
                disabled={isPromoting || promoteOtp.length !== 6}
                className="bg-[#002147] hover:bg-[#003366] text-white rounded-xl flex-1 py-6 font-bold"
              >
                {isPromoting ? 'Verifying & Promoting...' : 'Verify & Promote'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </DashboardLayout>
  );
}

