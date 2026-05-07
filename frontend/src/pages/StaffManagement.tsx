import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    UserPlus,
    Search,
    Edit2,
    Trash2,
    MoreVertical,
    Mail,
    Phone,
    GraduationCap,
    ShieldCheck,
    ShieldAlert,
    Save,
    X,
    RefreshCw,
    Eye,
    EyeOff,
    UserCheck,
    Upload,
    UserCog,
    MapPin
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/runtime-config';

const CLASSES = [
    'Nursery', 'LKG', 'UKG',
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
    'Not Assigned'
];

interface Staff {
    id: string;
    staffId: string;
    name: string;
    designation: string;
    phone: string;
    email: string;
    personalEmail?: string;
    address?: string;
    qualification?: string;
    photo?: string;
    classTeacher: string;
    status: 'active' | 'inactive';
    password?: string; // Form only
    role?: 'staff' | 'feeInCharge';
}

export default function StaffManagement() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Staff>>({
        name: '',
        designation: '',
        phone: '',
        email: '',
        personalEmail: '',
        address: '',
        qualification: '',
        photo: '',
        classTeacher: 'Not Assigned',
        status: 'active',
        staffId: '',
        password: '',
        role: 'staff'
    });

    // Fetch Staff
    const { data: staffList = [], isLoading } = useQuery({
        queryKey: ['staff-profiles'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return (data as any[]).map((profile): Staff => ({
                id: profile.user_id,
                staffId: profile.staff_id || `AO-STAFF-${profile.user_id.substring(0, 5).toUpperCase()}`,
                name: profile.full_name,
                designation: profile.designation || 'Staff',
                phone: profile.phone || '',
                email: profile.email,
                personalEmail: profile.personal_email,
                address: profile.address,
                qualification: profile.qualification,
                photo: profile.avatar_url,
                classTeacher: profile.subject || 'Not Assigned',
                status: (profile.is_active ? 'active' : 'inactive') as 'active' | 'inactive',
                role: profile.designation === 'Fee In-Charge' ? 'feeInCharge' : 'staff'
            }));
        }
    });

    const createStaffMutation = useMutation({
        mutationFn: async (data: any) => {
            const tempSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
            });

            if (!data.password?.trim()) throw new Error('A staff login password is required.');

            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: data.email,
                password: data.password,
                options: { data: { full_name: data.name } }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("User creation failed");

            let avatarUrl = null;
            const clientForUpload = authData.session ? tempSupabase : supabase;

            if (photoFile) {
                const fileExt = photoFile.name.split('.').pop();
                const filePath = `${authData.user.id}/${Math.random()}.${fileExt}`;
                const { error: uploadError } = await clientForUpload.storage.from('avatars').upload(filePath, photoFile);
                if (!uploadError) {
                    const { data: { publicUrl } } = clientForUpload.storage.from('avatars').getPublicUrl(filePath);
                    avatarUrl = publicUrl;
                }
            }

            const targetClient = authData.session ? tempSupabase : supabase;
            const dbRole = data.role === 'feeInCharge' ? 'staff' : data.role || 'staff';
            const finalDesignation = data.role === 'feeInCharge' ? 'Fee In-Charge' : data.designation;

            const { error: profileError } = await targetClient.from('profiles').insert({
                user_id: authData.user.id,
                full_name: data.name,
                email: data.email,
                phone: data.phone,
                designation: finalDesignation,
                subject: data.classTeacher === 'Not Assigned' ? null : data.classTeacher,
                qualification: data.qualification,
                personal_email: data.personalEmail,
                address: data.address,
                avatar_url: avatarUrl,
                is_active: data.status === 'active',
                staff_id: data.staffId
            } as any);

            if (profileError) throw profileError;

            await targetClient.from('user_roles').insert({
                user_id: authData.user.id,
                role: dbRole
            });

            try {
                await supabase.rpc('confirm_staff_user_email', { p_user_id: authData.user.id });
            } catch (e) {}

            return authData.user;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
            toast.success('Staff member added successfully');
            setIsAddModalOpen(false);
            resetForm();
        },
        onError: (err: any) => toast.error(err.message || "Failed to add staff member")
    });

    const updateStaffMutation = useMutation({
        mutationFn: async (data: any) => {
            const finalDesignation = data.role === 'feeInCharge' ? 'Fee In-Charge' : data.designation;
            const updates: any = {
                full_name: data.name,
                phone: data.phone,
                designation: finalDesignation,
                subject: data.classTeacher === 'Not Assigned' ? null : data.classTeacher,
                qualification: data.qualification,
                personal_email: data.personalEmail,
                address: data.address,
                is_active: data.status === 'active',
                staff_id: data.staffId
            };

            if (photoFile) {
                const fileExt = photoFile.name.split('.').pop();
                const filePath = `${data.id}/${Math.random()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, photoFile);
                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    updates.avatar_url = publicUrl;
                }
            }

            const { error } = await supabase.from('profiles').update(updates).eq('user_id', data.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
            toast.success('Staff profile updated');
            setIsAddModalOpen(false);
            resetForm();
        },
        onError: (err) => toast.error(err.message)
    });

    const resetForm = () => {
        setFormData({
            name: '', designation: '', phone: '', email: '',
            personalEmail: '', address: '', qualification: '', photo: '',
            classTeacher: 'Not Assigned', status: 'active', staffId: '', password: '', role: 'staff'
        });
        setPhotoFile(null);
        setEditingStaff(null);
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setFormData(prev => ({ ...prev, photo: reader.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const handleSaveStaff = () => {
        if (!formData.name || !formData.email || !formData.phone) {
            toast.error('Please fill in all required fields');
            return;
        }
        if (editingStaff) {
            updateStaffMutation.mutate({ ...formData, id: editingStaff.id });
        } else {
            if (!formData.password) {
                toast.error('Password is required for new staff');
                return;
            }
            createStaffMutation.mutate(formData);
        }
    };

    const handleClearAllStaff = () => {
        if (confirm("Are you sure? This will remove ALL staff profiles and access roles.")) {
            clearAllStaffMutation.mutate();
        }
    };

    const clearAllStaffMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.rpc('delete_all_staff_users');
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
            toast.success('All staff instances removed');
        },
        onError: (err: any) => toast.error('Failed to clear staff: ' + err.message)
    });

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will permanently remove the user account.")) return;
        try {
            const { error } = await supabase.rpc('delete_staff_user', { target_user_id: id });
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
            toast.success('Staff member removed');
        } catch (e: any) {
            toast.error('Failed to delete: ' + (e.message || 'Unknown error'));
        }
    };

    const toggleStatus = async (id: string) => {
        const staff = staffList.find(s => s.id === id);
        if (!staff) return;
        const newStatus = staff.status === 'active' ? false : true;
        try {
            await supabase.from('profiles').update({ is_active: newStatus }).eq('user_id', id);
            queryClient.invalidateQueries({ queryKey: ['staff-profiles'] });
            toast.success('Status updated');
        } catch (e) {
            toast.error('Failed to update status');
        }
    };

    const generateStaffId = () => {
        const id = `AO-STAFF-${Math.floor(1000 + Math.random() * 9000)}`;
        setFormData(prev => ({ ...prev, staffId: id }));
        toast.success('Staff ID Generated');
    };

    const handleEdit = (staff: Staff) => {
        setEditingStaff(staff);
        setFormData({ ...staff, password: '', role: staff.role || (staff.designation === 'Fee In-Charge' ? 'feeInCharge' : 'staff') });
        setIsAddModalOpen(true);
    };

    const filteredStaff = useMemo(() => staffList.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.staffId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.designation.toLowerCase().includes(searchTerm.toLowerCase())
    ), [staffList, searchTerm]);

    return (
        <DashboardLayout>
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-[#002147] tracking-tight font-display">Staff Management</h1>
                        <p className="text-slate-500 font-medium">Manage teacher profiles and access credentials</p>
                    </div>

                    <div className="flex gap-4">
                        <Dialog open={isAddModalOpen} onOpenChange={(open) => {
                            setIsAddModalOpen(open);
                            if (!open) resetForm();
                        }}>
                            <DialogTrigger asChild>
                                <Button className="bg-[#002147] hover:bg-[#1e3a8a] text-white rounded-2xl h-14 px-8 font-bold shadow-xl shadow-blue-900/10 active:scale-95 transition-all group">
                                    <UserPlus className="mr-3 h-5 w-5 group-hover:rotate-12 transition-transform" />
                                    Add New Staff
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0">
                                <div className="bg-[#002147] p-8 text-white relative">
                                    <DialogHeader className="space-y-2">
                                        <DialogTitle className="text-2xl font-bold">{editingStaff ? 'Edit Staff Profile' : 'Register New Staff'}</DialogTitle>
                                        <DialogDescription className="text-white/60">Fill in the professional details below to create an account.</DialogDescription>
                                    </DialogHeader>
                                </div>

                                <div className="p-10 space-y-6 bg-white overflow-y-auto max-h-[70vh]">
                                    <div className="space-y-8">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="relative group">
                                                <div className="h-24 w-24 rounded-full border-4 border-slate-100 shadow-lg overflow-hidden flex items-center justify-center bg-slate-100">
                                                    {formData.photo ? <img src={formData.photo} alt="Preview" className="h-full w-full object-cover" /> : <UserCog className="h-10 w-10 text-slate-400" />}
                                                </div>
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                                    <Upload className="h-6 w-6 text-white" />
                                                </div>
                                            </div>
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-[#002147]/40 ml-1">Staff Member Name</label>
                                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="rounded-2xl h-14" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-[#002147]/40 ml-1">Assign System Role</label>
                                                <Select value={formData.role} onValueChange={v => setFormData({ ...formData, role: v as any })}>
                                                    <SelectTrigger className="rounded-2xl h-14 bg-slate-50/50">
                                                        <SelectValue placeholder="Select role" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-2xl">
                                                        <SelectItem value="staff">Regular Staff</SelectItem>
                                                        <SelectItem value="feeInCharge">Fee In-Charge</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-[#002147]/40 ml-1">Designation</label>
                                                <Input placeholder="e.g. Mathematics Teacher" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} className="rounded-2xl h-14" disabled={formData.role === 'feeInCharge'} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-[#002147]/40 ml-1">Staff ID</label>
                                                <div className="flex gap-2">
                                                    <Input value={formData.staffId} onChange={e => setFormData({ ...formData, staffId: e.target.value })} className="rounded-2xl h-14" />
                                                    <Button variant="outline" className="h-14 rounded-2xl" onClick={generateStaffId}><RefreshCw className="h-4 w-4" /></Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-[#002147]/40 ml-1">Phone Number</label>
                                                <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="rounded-2xl h-14" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-[#002147]/40 ml-1">Official Email</label>
                                                <Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="rounded-2xl h-14" disabled={!!editingStaff} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-[#002147]/40 ml-1">Qualification</label>
                                                <Input value={formData.qualification} onChange={e => setFormData({ ...formData, qualification: e.target.value })} className="rounded-2xl h-14" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-[#002147]/40 ml-1">Class Teacher</label>
                                                <Select value={formData.classTeacher} onValueChange={v => setFormData({ ...formData, classTeacher: v })}>
                                                    <SelectTrigger className="rounded-2xl h-14"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="rounded-2xl">
                                                        {CLASSES.map(cls => <SelectItem key={cls} value={cls}>{cls}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {!editingStaff && (
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-[#002147]/40 ml-1">Password</label>
                                                <div className="relative">
                                                    <Input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="rounded-2xl h-14" />
                                                    <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <DialogFooter className="p-8 bg-slate-50 border-t">
                                    <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="rounded-2xl h-14 px-8 font-bold">Cancel</Button>
                                    <Button className="bg-[#002147] hover:bg-[#1e3a8a] text-white rounded-2xl h-14 px-10 font-bold active:scale-95" onClick={handleSaveStaff}>
                                        <Save className="mr-3 h-5 w-5" /> {editingStaff ? 'Update Profile' : 'Save Staff Account'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Button variant="outline" onClick={handleClearAllStaff} className="h-14 px-8 rounded-2xl border-red-200 text-red-600 hover:bg-red-600 hover:text-white font-bold active:scale-95">
                            <Trash2 className="mr-3 h-5 w-5" /> Remove All
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <Card className="lg:col-span-3 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b px-8 py-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                    <Input placeholder="Search teachers..." className="pl-12 rounded-2xl border-none shadow-inner bg-slate-100/50 h-14 focus:ring-2 focus:ring-[#002147]/10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50/30">
                                    <TableRow className="border-none">
                                        <TableHead className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Staff Info</TableHead>
                                        <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Role & Class</TableHead>
                                        <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</TableHead>
                                        <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</TableHead>
                                        <TableHead className="px-8 py-4 text-right"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <AnimatePresence>
                                        {filteredStaff.map((staff, idx) => (
                                            <motion.tr key={staff.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }} className="group border-b border-slate-50 hover:bg-[#002147]/[0.02] transition-colors">
                                                <TableCell className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm ring-1 ring-slate-100">
                                                            {staff.photo ? <img src={staff.photo} alt={staff.name} className="h-full w-full object-cover" /> : <UserCog className="h-6 w-6 text-slate-400" />}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-[#002147]">{staff.name}</p>
                                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{staff.staffId}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">{staff.designation}</p>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase">{staff.classTeacher}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-5 text-xs font-medium text-slate-600">{staff.phone}<br />{staff.email}</TableCell>
                                                <TableCell className="py-5 text-center"><Badge className={cn("rounded-md px-2 py-1 text-[10px] uppercase font-black", staff.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{staff.status}</Badge></TableCell>
                                                <TableCell className="px-8 py-5 text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="rounded-2xl p-2 w-48">
                                                            <DropdownMenuItem onClick={() => handleEdit(staff)} className="rounded-xl font-bold"><Edit2 className="mr-3 h-4 w-4" /> Edit Profile</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => toggleStatus(staff.id)} className="rounded-xl font-bold">{staff.status === 'active' ? <ShieldAlert className="mr-3 h-4 w-4" /> : <ShieldCheck className="mr-3 h-4 w-4" />} {staff.status === 'active' ? 'Deactivate' : 'Activate'}</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleDelete(staff.id)} className="rounded-xl font-bold text-red-500"><Trash2 className="mr-3 h-4 w-4" /> Remove</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="border-none shadow-xl rounded-[2.5rem] bg-[#002147] text-white p-8 relative">
                            <h3 className="text-xl font-bold font-display">Staff Summary</h3>
                            <div className="space-y-3 pt-4">
                                <div className="flex justify-between text-sm border-b border-white/10 pb-2"><span>Total Staff</span><span className="font-bold">{staffList.length}</span></div>
                                <div className="flex justify-between text-sm border-b border-white/10 pb-2"><span>Active</span><span className="font-bold">{staffList.filter(s => s.status === 'active').length}</span></div>
                                <div className="flex justify-between text-sm"><span>Inactive</span><span className="font-bold">{staffList.filter(s => s.status === 'inactive').length}</span></div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
