import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Eye, Search, FileText, BookOpen, Wifi } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const CLASSES = [
    'All', 'Nursery', 'LKG', 'UKG',
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
];

interface Homework {
    id: string;
    title: string;
    subject: string;
    class_name: string;
    description: string;
    staff_name: string;
    due_date: string;
    created_at: string;
}

export default function AdminHomework() {
    const [filterClass, setFilterClass] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [homeworks, setHomeworks] = useState<Homework[]>([]);
    const [loading, setLoading] = useState(false);
    const [isLive, setIsLive] = useState(false);

    const fetchHomework = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('homework')
                .select('*')
                .order('created_at', { ascending: false });

            if (filterClass !== 'All') {
                query = query.eq('class_name', filterClass);
            }

            const { data, error } = await query;
            if (error) throw error;

            setHomeworks((data || []) as Homework[]);
        } catch (error) {
            console.error('Error fetching homework:', error);
        } finally {
            setLoading(false);
        }
    }, [filterClass]);

    // Fetch when filter changes
    useEffect(() => {
        fetchHomework();
    }, [fetchHomework]);

    // ✅ Real-time subscription — admin sees new assignments the moment staff posts them
    useEffect(() => {
        const channel = supabase
            .channel('admin-homework-live')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'homework' },
                (payload) => {
                    const newHw = payload.new as Homework;
                    // Only add to list if matches current filter
                    if (filterClass === 'All' || newHw.class_name === filterClass) {
                        setHomeworks(prev => [newHw, ...prev]);
                    }
                    toast.success(`New assignment posted by ${newHw.staff_name || 'Staff'}: "${newHw.title}" for ${newHw.class_name}`);
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'homework' },
                (payload) => {
                    setHomeworks(prev => prev.filter(h => h.id !== (payload.old as any).id));
                }
            )
            .subscribe((status) => {
                setIsLive(status === 'SUBSCRIBED');
            });

        return () => {
            supabase.removeChannel(channel);
            setIsLive(false);
        };
    }, [filterClass]);

    const filteredHomework = homeworks.filter(h =>
        h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.staff_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-3xl font-black text-[#002147] tracking-tight font-display">Homework Overview</h1>
                            {/* Live indicator */}
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                {isLive ? 'Live' : 'Connecting...'}
                            </div>
                            {/* Total count */}
                            {filteredHomework.length > 0 && (
                                <Badge className="bg-blue-100 text-blue-700 border-none font-bold">
                                    {filteredHomework.length} assignment{filteredHomework.length !== 1 ? 's' : ''}
                                </Badge>
                            )}
                        </div>
                        <p className="text-slate-500 font-medium">Real-time view of assignments posted by staff</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search title, subject, staff..."
                                className="pl-10 w-[220px] bg-white"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={filterClass} onValueChange={setFilterClass}>
                            <SelectTrigger className="w-[160px] bg-white">
                                <SelectValue placeholder="Filter Class" />
                            </SelectTrigger>
                            <SelectContent>
                                {CLASSES.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="icon"
                            className="bg-white h-10 w-10"
                            onClick={fetchHomework}
                            disabled={loading}
                            title="Refresh"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {loading ? (
                        Array(3).fill(0).map((_, i) => (
                            <div key={i} className="h-52 rounded-2xl bg-slate-100 animate-pulse" />
                        ))
                    ) : filteredHomework.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 rounded-2xl border border-dashed">
                            <BookOpen className="h-10 w-10 mb-3 opacity-40" />
                            <p className="font-semibold text-base">No assignments found</p>
                            <p className="text-sm mt-1">Staff-posted assignments will appear here in real-time</p>
                        </div>
                    ) : filteredHomework.map((hw) => (
                        <Card key={hw.id} className="group hover:shadow-lg transition-all duration-300 border-none shadow-sm ring-1 ring-slate-200 rounded-2xl overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 uppercase text-[10px] font-bold tracking-wider">
                                        {hw.class_name}
                                    </Badge>
                                    <span className="text-xs font-bold text-slate-400">
                                        {format(new Date(hw.created_at), 'MMM dd, hh:mm a')}
                                    </span>
                                </div>
                                <CardTitle className="text-lg font-bold text-slate-900 line-clamp-1 group-hover:text-blue-700 transition-colors">
                                    {hw.title}
                                </CardTitle>
                                <CardDescription className="font-medium text-emerald-600 flex items-center gap-2">
                                    <FileText className="h-3 w-3" /> {hw.subject}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px]">
                                    {hw.description || 'No description provided.'}
                                </p>

                                <div className="flex items-center justify-between text-xs pt-4 border-t border-slate-100">
                                    <div className="flex flex-col">
                                        <span className="text-slate-400 uppercase font-bold text-[10px]">Posted By</span>
                                        <span className="font-bold text-slate-700 truncate max-w-[130px]">{hw.staff_name || 'Staff'}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-slate-400 uppercase font-bold text-[10px]">Due Date</span>
                                        <span className="font-bold text-red-600">{format(new Date(hw.due_date), 'MMM dd, yyyy')}</span>
                                    </div>
                                </div>
                            </CardContent>
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                                <Button size="sm" variant="outline" className="h-8 text-xs font-bold w-full">
                                    <Eye className="mr-2 h-3 w-3" /> View Details
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
