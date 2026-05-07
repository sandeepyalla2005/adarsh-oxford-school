import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCog, Mail, Phone, Shield, ToggleLeft, ToggleRight, Trash2, Upload, X, GraduationCap, MapPin, Briefcase, User, Search } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/runtime-config';
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StaffUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  designation?: string;
  qualification?: string;
  subject?: string;
  personal_email?: string;
  address?: string;
  avatar_url?: string;
  is_active: boolean;
  role: 'admin' | 'staff' | 'feeInCharge';
  created_at: string;
}

export default function UserManagement() {
  const { isAdmin, isStaff, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  // New fields
  const [designation, setDesignation] = useState('');
  const [subject, setSubject] = useState('');
  const [qualification, setQualification] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [address, setAddress] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch staff users
  const { data: users, isLoading } = useQuery({
    queryKey: ['staff-users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const profileList = (profiles || []) as Array<{ user_id: string; designation?: string; [key: string]: any }>;
      const roleList = (roles || []) as Array<{ user_id: string; role: string }>;

      const usersWithRoles: StaffUser[] = profileList.map(profile => {
        const userRole = roleList.find(r => r.user_id === profile.user_id);
        return {
          ...profile,
          role: (profile.designation === 'Fee In-Charge' ? 'feeInCharge' : (userRole?.role || 'staff')) as 'admin' | 'staff' | 'feeInCharge',
        } as StaffUser;
      });

      return usersWithRoles;
    },
    enabled: isAdmin || isStaff,
  });

  // Create staff user
  const createStaffMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      fullName: string;
      phone: string;
      designation: string;
      subject: string;
      qualification: string;
      personalEmail: string;
      address: string;
      photoFile: File | null;
    }) => {
      // Create a temporary client that doesn't persist session to avoid signing out the admin
      const tempSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      // 1. Create user via temp client
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: data.fullName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      let avatarUrl = null;

      // 2. Upload photo if exists
      // Use the temp client if it has a session, otherwise use main client
      const clientForUpload = authData.session ? tempSupabase : supabase;

      if (data.photoFile) {
        const fileExt = data.photoFile.name.split('.').pop();
        const filePath = `staff-avatars/${authData.user.id}/${Math.random()}.${fileExt}`;

        try {
          const { error: uploadError } = await clientForUpload.storage
            .from('avatars')
            .upload(filePath, data.photoFile);

          if (!uploadError) {
            const { data: { publicUrl } } = clientForUpload.storage
              .from('avatars')
              .getPublicUrl(filePath);
            avatarUrl = publicUrl;
          } else {
            console.error("Photo upload failed", uploadError);
          }
        } catch (e) {
          console.error("Storage bucket may not exist or upload failed", e);
        }
      }

      // 3. Create profile & Role (Use the temp client if session is present)
      const targetClient = authData.session ? tempSupabase : supabase;

      const { error: profileError } = await targetClient
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          full_name: data.fullName,
          email: data.email,
          phone: data.phone || null,
          designation: data.designation || null,
          subject: data.subject || null,
          qualification: data.qualification || null,
          personal_email: data.personalEmail || null,
          address: data.address || null,
          avatar_url: avatarUrl
        } as any);

      if (profileError) throw profileError;

      // 4. Assign role
      const dbRole = data.designation === 'Fee In-Charge' ? 'staff' : 'staff'; // Both use 'staff' in DB for now
      const { error: roleError } = await targetClient
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: dbRole,
        });

      if (roleError) throw roleError;

      // 5. Auto-confirm staff email (MUST use main client with Admin session)
      const { error: confirmError } = await supabase.rpc('confirm_staff_user_email', {
        p_user_id: authData.user.id,
      });

      if (confirmError) throw confirmError;

      return authData.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
      toast({
        title: 'Staff Created',
        description: 'New staff user has been created successfully.',
      });
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("User Creation Error:", error);
      const msg = error.message || "";
      if (msg.includes('already registered') || msg.includes('already exists')) {
        toast({
          variant: 'destructive',
          title: 'Registration Error',
          description: 'This email is already registered. Please use a unique email or reactivate the existing account if it was deactivated.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: msg || 'Failed to create staff user.',
        });
      }
    },
  });

  // Toggle user active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
      toast({
        title: 'Status Updated',
        description: 'User status has been updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to update user status.',
      });
    },
  });

  // Delete staff user (complete removal including auth)
  const deleteStaffMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'staff' | 'feeInCharge' }) => {
      if (role === 'admin') {
        throw new Error('Admin users cannot be deleted.');
      }

      const { error } = await supabase.rpc('delete_staff_user', {
        target_user_id: userId
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-users'] });
      toast({
        title: 'Staff Deleted',
        description: 'Staff user has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete staff user.',
      });
    },
  });

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setNewPassword('');
    setDesignation('');
    setSubject('');
    setQualification('');
    setPersonalEmail('');
    setAddress('');
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    // Pre-validation for existing email in our list
    if (users?.some(u => u.email?.toLowerCase() === email.trim().toLowerCase())) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'A user with this email already exists in the system.',
      });
      return;
    }

    if (!fullName || !email || !password) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
      });
      return;
    }
    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Password must be at least 6 characters.',
      });
      return;
    }
    setIsSubmitting(true);
    await createStaffMutation.mutateAsync({
      email,
      password,
      fullName,
      phone,
      designation,
      subject,
      qualification,
      personalEmail,
      address,
      photoFile
    });
    setIsSubmitting(false);
  };

  const handleDeleteStaff = async (targetUser: StaffUser) => {
    if (isStaff) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'Staff users cannot delete user accounts.',
      });
      return;
    }

    if (targetUser.role === 'admin') {
      toast({
        variant: 'destructive',
        title: 'Action Blocked',
        description: 'Admin users cannot be deleted.',
      });
      return;
    }

    if (!window.confirm(`Delete staff user "${targetUser.full_name}"? This cannot be undone.`)) {
      return;
    }

    await deleteStaffMutation.mutateAsync({ userId: targetUser.user_id, role: targetUser.role });
  };



  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground mt-1">Manage staff accounts and permissions</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="btn-oxford"
                disabled={isStaff}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Staff
                {isStaff && (
                  <span className="ml-2 text-xs">(Admin only)</span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">Add New Staff</DialogTitle>
                <DialogDescription>
                  Create a new staff profile with complete details.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateStaff} className="mt-4">
                <div className="h-[60vh] pr-4 overflow-y-auto">
                  <div className="space-y-6">
                    {/* Photo Upload Section */}
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="relative group">
                        <div className="h-24 w-24 rounded-full border-4 border-slate-100 shadow-lg overflow-hidden flex items-center justify-center bg-slate-100">
                          {photoPreview ? (
                            <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                          ) : (
                            <div className="bg-slate-100 text-slate-400">
                              <UserCog className="h-10 w-10" />
                            </div>
                          )}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handlePhotoChange}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                          {photoFile ? 'Change Photo' : 'Upload Photo'}
                        </Button>
                        {photoFile && (
                          <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-600 h-8 mt-1" onClick={removePhoto}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                        <UserCog className="h-4 w-4" /> Personal & Professional Details
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Full Name *</Label>
                          <Input
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="John Smith"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="designation">Designation</Label>
                          <Select 
                            value={designation} 
                            onValueChange={setDesignation}
                          >
                            <SelectTrigger id="designation">
                              <SelectValue placeholder="Select designation" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Teacher">Teacher</SelectItem>
                              <SelectItem value="Fee In-Charge">Fee In-Charge</SelectItem>
                              <SelectItem value="Principal">Principal</SelectItem>
                              <SelectItem value="Staff">General Staff</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subject">Subject</Label>
                          <Input
                            id="subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="e.g. Mathematics"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="qualification">Qualification</Label>
                          <div className="relative">
                            <GraduationCap className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                              id="qualification"
                              value={qualification}
                              onChange={(e) => setQualification(e.target.value)}
                              placeholder="M.Sc, B.Ed"
                              className="pl-9"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone *</Label>
                          <Input
                            id="phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+91 9876543210"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">Residential Address</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                          <Input
                            id="address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Full residential address"
                            className="pl-9"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                        <Shield className="h-4 w-4" /> Account & Contact
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Official Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="staff@oxford.edu"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="personalEmail">Personal Email</Label>
                          <Input
                            id="personalEmail"
                            type="email"
                            value={personalEmail}
                            onChange={(e) => setPersonalEmail(e.target.value)}
                            placeholder="staff.personal@gmail.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Password *</Label>
                          <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 6 characters"
                            required
                            minLength={6}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 border-t mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 btn-oxford"
                    disabled={isSubmitting || isStaff}
                  >
                    {isSubmitting ? 'Creating...' : isStaff ? 'Create Staff (Admin only)' : 'Create Staff'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Staff Members
            </CardTitle>
            <CardDescription>
              All registered staff and admin users in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              (() => {
                const filteredUsers = (users || []).filter(user => 
                  user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  user.designation?.toLowerCase().includes(searchTerm.toLowerCase())
                );

                if (filteredUsers.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserCog className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No staff members found matching your search.</p>
                    </div>
                  );
                }

                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Contact Info</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(filteredUsers || []).map((user) => (
                        <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold overflow-hidden border border-slate-200">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.full_name} className="h-full w-full object-cover" />
                            ) : (
                              user.full_name?.charAt(0) || 'U'
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-700">{user.full_name}</p>
                            {user.designation || user.subject ? (
                              <p className="text-xs text-slate-500 font-medium">
                                {[user.designation, user.subject].filter(Boolean).join(' • ')}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400">Joined {new Date(user.created_at).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="h-3 w-3 text-slate-400" />
                            {user.email}
                          </div>
                          {user.phone && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone className="h-3 w-3 text-slate-400" />
                              {user.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                          {user.role === 'admin' ? 'Admin' : 'Staff'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-slate-500">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActiveMutation.mutate({ userId: user.user_id, isActive: !user.is_active })}
                            disabled={user.role === 'admin' || isStaff}
                            title={user.is_active ? "Deactivate" : "Activate"}
                          >
                            {user.is_active ? (
                              <ToggleRight className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-slate-400" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteStaff(user)}
                            disabled={user.role === 'admin' || isStaff}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete Account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        </TableCell>
                      </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
