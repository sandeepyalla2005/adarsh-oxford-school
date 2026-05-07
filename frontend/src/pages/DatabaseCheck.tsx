import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function DatabaseCheck() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [roles, setRoles] = useState<any[]>([]);

    useEffect(() => {
        async function checkData() {
            if (!user) return;

            try {
                // 1. Check Profile
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();
                setProfile(profileData);

                // 2. Check Roles
                const { data: roleData } = await supabase
                    .from('user_roles')
                    .select('*')
                    .eq('user_id', user.id);
                setRoles(roleData || []);
            } catch (error) {
                console.error("Error checking DB:", error);
            } finally {
                setLoading(false);
            }
        }

        checkData();
    }, [user]);

    if (!user) return <div className="p-8 text-center">Please log in first.</div>;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
            <Card className="w-full max-w-lg shadow-xl">
                <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
                    <CardTitle className="flex items-center gap-2">
                        Database Connection Status
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg text-slate-800 border-b pb-2">User: {user.email}</h3>

                        {/* Profile Status */}
                        <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                            <div className="flex flex-col">
                                <span className="font-medium text-slate-700">Supabase Profile</span>
                                <span className="text-xs text-slate-500">Table: public.profiles</span>
                            </div>
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                            ) : profile ? (
                                <div className="flex items-center text-green-600 font-bold gap-2 bg-green-50 px-3 py-1 rounded-full">
                                    <CheckCircle2 className="h-5 w-5" />
                                    <span>Connected</span>
                                </div>
                            ) : (
                                <div className="flex items-center text-red-600 font-bold gap-2 bg-red-50 px-3 py-1 rounded-full">
                                    <XCircle className="h-5 w-5" />
                                    <span>Missing</span>
                                </div>
                            )}
                        </div>

                        {/* Role Status */}
                        <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                            <div className="flex flex-col">
                                <span className="font-medium text-slate-700">Admin Role</span>
                                <span className="text-xs text-slate-500">Table: public.user_roles</span>
                            </div>
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                            ) : roles.some(r => r.role === 'admin') ? (
                                <div className="flex items-center text-green-600 font-bold gap-2 bg-green-50 px-3 py-1 rounded-full">
                                    <CheckCircle2 className="h-5 w-5" />
                                    <span>Verified</span>
                                </div>
                            ) : (
                                <div className="flex items-center text-red-600 font-bold gap-2 bg-red-50 px-3 py-1 rounded-full">
                                    <XCircle className="h-5 w-5" />
                                    <span>Not Found</span>
                                </div>
                            )}
                        </div>

                    </div>

                    {!loading && (
                        <div className={`p-4 rounded-lg text-center font-medium ${profile && roles.some(r => r.role === 'admin')
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                            {profile && roles.some(r => r.role === 'admin')
                                ? "✅ SUCCESS: Your admin account is fully synced with Supabase!"
                                : "❌ ERROR: Data is missing from Supabase. Please wait a moment or reload."}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
