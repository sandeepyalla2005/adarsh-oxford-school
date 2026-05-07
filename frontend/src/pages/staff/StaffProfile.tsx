
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { User, Lock, Mail, Phone, MapPin, CheckCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function StaffProfile() {
    const { user, profile } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        designation: '',
        email: '',
        personalEmail: '',
        phone: '',
        address: '',
        qualification: '',
        subject: '',
    });

    useEffect(() => {
        if (profile || user) {
            setFormData({
                fullName: profile?.full_name || user?.user_metadata?.full_name || '',
                designation: profile?.designation || 'Senior Teacher',
                email: user?.email || '',
                personalEmail: profile?.personal_email || '',
                phone: profile?.phone || '',
                address: profile?.address || '',
                qualification: profile?.qualification || '',
                subject: profile?.subject || '',
            });
        }
    }, [profile, user]);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        try {
            setUploading(true);
            const fileExt = file.name.split('.').pop();
            const filePath = `staff-avatars/${user.id}/${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('user_id', user.id);

            if (updateError) throw updateError;

            toast.success('Profile picture updated!');
            window.location.reload(); // Refresh to show new photo
        } catch (error) {
            console.error('Error uploading photo:', error);
            toast.error('Failed to upload photo');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.fullName,
                    designation: formData.designation,
                    personal_email: formData.personalEmail,
                    phone: formData.phone,
                    address: formData.address,
                    qualification: formData.qualification,
                    subject: formData.subject
                })
                .eq('user_id', user.id);

            if (error) throw error;
            setIsEditing(false);
            toast.success('Profile updated successfully');
        } catch (err) {
            toast.error('Failed to update profile');
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-[#002147] tracking-tight font-display">My Profile</h1>
                        <p className="text-slate-500 font-medium">Manage your personal information and account settings</p>
                    </div>
                    <Button
                        onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                        className="bg-[#002147] hover:bg-[#1e3a8a] text-white rounded-2xl h-12 px-8 font-bold shadow-xl shadow-blue-900/10 transition-all active:scale-95"
                    >
                        {isEditing ? <CheckCircle className="mr-2 h-4 w-4" /> : <User className="mr-2 h-4 w-4" />}
                        {isEditing ? 'Save Changes' : 'Edit Profile'}
                    </Button>
                </div>

                <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                    <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden h-fit">
                        <div className="h-32 bg-gradient-to-br from-[#002147] to-blue-600 relative">
                            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                                <div className="relative group">
                                    <div className="h-24 w-24 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center text-slate-400 shadow-xl overflow-hidden">
                                        {profile?.avatar_url ? (
                                            <img
                                                src={profile.avatar_url}
                                                alt="Profile"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="bg-white h-full w-full flex items-center justify-center">
                                                <User className="h-12 w-12 text-[#002147] opacity-20" />
                                            </div>
                                        )}
                                        {uploading && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                <div className="h-5 w-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                                            </div>
                                        )}
                                    </div>
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <Input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handlePhotoUpload}
                                            disabled={uploading}
                                        />
                                        <span className="text-white text-[10px] font-bold">CHANGE</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <CardContent className="pt-16 pb-8 text-center space-y-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">{formData.fullName}</h2>
                                <p className="text-sm text-slate-500 font-medium">{formData.designation} • {formData.subject}</p>
                            </div>

                            <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-3 text-sm text-slate-600 justify-center">
                                    <Mail className="h-4 w-4 text-slate-400" />
                                    {formData.email}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-slate-600 justify-center">
                                    <Phone className="h-4 w-4 text-slate-400" />
                                    {formData.phone}
                                </div>
                            </div>

                            <div className="pt-4">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                                    <Shield className="h-3 w-3" />
                                    Verified Staff
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-8">
                            <CardHeader className="px-0 pt-0">
                                <CardTitle className="text-xl font-bold text-[#002147]">Personal Details</CardTitle>
                            </CardHeader>
                            <CardContent className="px-0 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>Full Name</Label>
                                        <Input
                                            disabled={!isEditing}
                                            value={formData.fullName}
                                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                            className="rounded-xl border-slate-200 focus:ring-[#002147]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Designation</Label>
                                        <Input
                                            disabled={!isEditing}
                                            value={formData.designation}
                                            onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                            className="rounded-xl border-slate-200 focus:ring-[#002147]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Qualification</Label>
                                        <Input
                                            disabled={!isEditing}
                                            value={formData.qualification}
                                            onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                                            className="rounded-xl border-slate-200 focus:ring-[#002147]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Official Email</Label>
                                        <Input
                                            disabled
                                            value={formData.email}
                                            className="rounded-xl border-slate-200 bg-slate-50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Personal Email</Label>
                                        <Input
                                            disabled={!isEditing}
                                            value={formData.personalEmail}
                                            onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                                            className="rounded-xl border-slate-200 focus:ring-[#002147]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone Number</Label>
                                        <Input
                                            disabled={!isEditing}
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="rounded-xl border-slate-200 focus:ring-[#002147]"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label>Residential Address</Label>
                                        <Input
                                            disabled={!isEditing}
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            className="rounded-xl border-slate-200 focus:ring-[#002147]"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white p-8">
                            <CardHeader className="px-0 pt-0">
                                <div className="flex items-center gap-2">
                                    <Lock className="h-5 w-5 text-[#002147]" />
                                    <CardTitle className="text-xl font-bold text-[#002147]">Security Settings</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="px-0 space-y-4">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label>New Password</Label>
                                        <Input type="password" placeholder="Enter new password" className="rounded-xl border-slate-200" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Confirm Password</Label>
                                        <Input type="password" placeholder="Confirm new password" className="rounded-xl border-slate-200" />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button variant="outline" className="rounded-xl font-bold text-slate-600 hover:text-[#002147]">Update Password</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
