import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Bell, Send, Clock, Users, Globe, Trash2, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addHours, formatDistanceToNow, isAfter } from 'date-fns';

interface Notice {
    id: number;
    title: string;
    content: string;
    date: string;
    author: string;
    pinned: boolean;
    expires_at?: string;
}

export default function Notices() {
    const { userRole, user } = useAuth();
    const canPost = userRole === 'admin' || userRole === 'feeInCharge';
    const isAdmin = userRole === 'admin';

    const [notices, setNotices] = useState<Notice[]>([
        { id: 1, title: 'Exam Schedule Update', content: 'Final exams for Class 10 will begin from March 1st. Please inform students.', date: '2024-02-12', author: 'Principal', pinned: true },
        { id: 2, title: 'Annual Sports Day', content: 'Sports Day is scheduled for February 20th. Submit participant lists by Friday.', date: '2024-02-10', author: 'Sports Dept', pinned: false },
        { id: 3, title: 'Staff Meeting', content: 'Mandatory staff meeting today at 3 PM in the conference room.', date: '2024-02-13', author: 'Admin', pinned: true },
    ]);

    const [isOpen, setIsOpen] = useState(false);
    const [newNotice, setNewNotice] = useState({ title: '', content: '', pinned: false, duration: '24' });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchNotices();

        // Subscribe to real-time updates
        const channel = supabase
            .channel('notices-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notices' },
                (payload) => {
                    console.log('New notice received:', payload);
                    setNotices(current => [payload.new as Notice, ...current]);
                    toast.info(`Announcement: ${payload.new.title}`, {
                        description: 'A new notice has been posted.',
                        duration: 8000,
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'notices' },
                (payload) => {
                    setNotices(current => current.filter(n => n.id !== payload.old.id));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchNotices = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('notices')
                .select('*')
                .order('pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setNotices(data as any[]);
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Failed to sync notices');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newNotice.title || !newNotice.content) {
            toast.error('Please fill in all fields');
            return;
        }

        setIsLoading(true);
        try {
            let expiresAt = null;
            if (newNotice.duration !== 'never') {
                expiresAt = addHours(new Date(), parseInt(newNotice.duration)).toISOString();
            }

            const { error } = await supabase
                .from('notices')
                .insert([{
                    title: newNotice.title,
                    content: newNotice.content,
                    pinned: newNotice.pinned,
                    author: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Administrator',
                    date: new Date().toISOString().split('T')[0],
                    expires_at: expiresAt
                }]);

            if (error) throw error;

            toast.success('Announcement published successfully');
            setIsOpen(false);
            setNewNotice({ title: '', content: '', pinned: false, duration: '24' });
        } catch (error: any) {
            console.error('Create error:', error);
            toast.error(error.message || 'Failed to publish notice');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!canPost) return;

        try {
            const { error } = await supabase.from('notices').delete().eq('id', id);
            if (error) throw error;

            // Immediately remove from UI
            setNotices(current => current.filter(n => n.id !== id));
            toast.success('Notice removed');
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete notice');
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-[#002147] tracking-tight font-display">Notice Board</h1>
                        <p className="text-slate-500 font-medium">
                            {canPost ? 'Manage announcements and circulars' : 'Stay updated with latest announcements'}
                        </p>
                    </div>

                    {canPost && (
                        <Dialog open={isOpen} onOpenChange={setIsOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-[#002147] hover:bg-[#1e3a8a] text-white rounded-2xl h-12 px-8 font-bold shadow-xl shadow-blue-900/10 active:scale-95 space-x-2">
                                    <Send className="h-4 w-4" />
                                    <span>Post Announcement</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden">
                                <div className="bg-[#002147] p-6 text-white bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900">
                                    <DialogHeader>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-white/10 rounded-lg"><Bell className="h-5 w-5 text-yellow-400" /></div>
                                            <DialogTitle className="text-xl font-bold">New Notice</DialogTitle>
                                        </div>
                                    </DialogHeader>
                                </div>
                                <div className="p-6 space-y-4 bg-white">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Subject Line</label>
                                        <Input
                                            placeholder="E.g. Holiday Announcement"
                                            className="rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-100"
                                            value={newNotice.title}
                                            onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Detailed Message</label>
                                        <Textarea
                                            placeholder="Type your announcement here..."
                                            className="rounded-xl border-slate-200 min-h-[120px] focus:ring-2 focus:ring-blue-100"
                                            value={newNotice.content}
                                            onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Globe className="h-4 w-4" /></div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">Pin to Top?</p>
                                                <p className="text-xs text-slate-400">Keep this notice visible first.</p>
                                            </div>
                                        </div>
                                        <Switch checked={newNotice.pinned} onCheckedChange={(c) => setNewNotice({ ...newNotice, pinned: c })} />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                                            <Timer className="h-3 w-3" /> Auto-expire after
                                        </label>
                                        <Select
                                            value={newNotice.duration}
                                            onValueChange={(val) => setNewNotice({ ...newNotice, duration: val })}
                                        >
                                            <SelectTrigger className="rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-100">
                                                <SelectValue placeholder="Select duration" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">1 Hour</SelectItem>
                                                <SelectItem value="12">12 Hours</SelectItem>
                                                <SelectItem value="24">1 Day</SelectItem>
                                                <SelectItem value="72">3 Days</SelectItem>
                                                <SelectItem value="168">1 Week</SelectItem>
                                                <SelectItem value="never">Permanent</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100">
                                    <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl font-bold text-slate-500 hover:bg-white border hover:border-slate-200">Discard</Button>
                                    <Button onClick={handleCreate} disabled={isLoading} className="bg-[#002147] text-white rounded-xl font-bold hover:bg-blue-900 px-8 shadow-lg shadow-blue-900/10">
                                        {isLoading ? 'Publishing...' : 'Publish Notice'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>

                <div className="grid gap-6">
                    {notices.filter(notice => !notice.expires_at || isAfter(new Date(notice.expires_at), new Date())).map((notice) => (
                        <Card key={notice.id} className={`border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-[1.5rem] bg-white overflow-hidden group ${notice.pinned ? 'ring-2 ring-emerald-500/10' : ''}`}>
                            <CardContent className="p-8 flex items-start gap-6">
                                <div className={`p-4 rounded-2xl flex-shrink-0 ${notice.pinned ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                    {notice.pinned ? <Bell className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#002147] transition-colors">{notice.title}</h3>
                                        {notice.pinned && <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold uppercase tracking-wider text-[10px]">Pinned</Badge>}
                                    </div>
                                    <p className="text-slate-600 leading-relaxed font-medium text-sm">{notice.content}</p>
                                    <div className="flex items-center gap-4 pt-4 mt-2 border-t border-slate-50 justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                <Clock className="h-3 w-3" /> {notice.date}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                <Users className="h-3 w-3" /> By {notice.author}
                                            </div>
                                            {notice.expires_at && (
                                                <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-full">
                                                    <Timer className="h-3 w-3" /> Expires in {formatDistanceToNow(new Date(notice.expires_at))}
                                                </div>
                                            )}
                                        </div>
                                        {canPost && (
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(notice.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0 rounded-full">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
