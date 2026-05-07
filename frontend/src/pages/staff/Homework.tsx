import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Clock, Users, MoreVertical, Paperclip, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface Assignment {
    id: string;
    class_name: string;
    subject: string;
    title: string;
    description: string;
    due_date: string;
    staff_name: string;
    created_at: string;
}

export default function Homework() {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New Assignment Form State
    const [newAssignment, setNewAssignment] = useState({
        class_name: '',
        subject: '',
        title: '',
        description: '',
        due_date: ''
    });

    useEffect(() => {
        fetchAssignments();
    }, []);

    const fetchAssignments = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('homework')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAssignments((data || []) as Assignment[]);
        } catch (error) {
            console.error('Error fetching homework:', error);
            toast.error('Failed to load assignments');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newAssignment.class_name || !newAssignment.subject || !newAssignment.title || !newAssignment.due_date) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('homework')
                .insert([{
                    ...newAssignment,
                    staff_id: user?.id,
                    staff_name: user?.email // Ideally fetch profile name
                }]);

            if (error) throw error;

            toast.success('Assignment created successfully');
            setIsOpen(false);
            setNewAssignment({ class_name: '', subject: '', title: '', description: '', due_date: '' });
            fetchAssignments(); // Refresh list
        } catch (error: any) {
            console.error('Error creating assignment:', error);
            toast.error('Failed to create assignment: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-[#002147] tracking-tight font-display">Assignments</h1>
                        <p className="text-slate-500 font-medium">Manage class homework and projects</p>
                    </div>

                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#002147] hover:bg-[#1e3a8a] text-white rounded-2xl h-12 px-6 font-bold shadow-xl shadow-blue-900/10 active:scale-95 space-x-2">
                                <Plus className="h-4 w-4" />
                                <span>Create Assignment</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden">
                            <div className="bg-[#002147] p-6 text-white">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold">New Assignment</DialogTitle>
                                    <DialogDescription className="text-blue-200">Assign work to your students</DialogDescription>
                                </DialogHeader>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-slate-500">Class</label>
                                        <Select onValueChange={(v) => setNewAssignment({ ...newAssignment, class_name: v })}>
                                            <SelectTrigger className="rounded-xl border-slate-200">
                                                <SelectValue placeholder="Select Class" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl z-[100] shadow-2xl border-slate-100">
                                                {['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'].map(c => (
                                                    <SelectItem key={c} value={c} className="rounded-lg my-1">{c}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase text-slate-500">Subject</label>
                                        <Input
                                            placeholder="e.g. Math"
                                            className="rounded-xl border-slate-200"
                                            onChange={(e) => setNewAssignment({ ...newAssignment, subject: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500">Title</label>
                                    <Input
                                        placeholder="Assignment Title"
                                        className="rounded-xl border-slate-200"
                                        onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500">Instructions</label>
                                    <Textarea
                                        placeholder="Detailed instructions for students..."
                                        className="rounded-xl border-slate-200 min-h-[100px]"
                                        onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500">Due Date</label>
                                    <Input
                                        type="date"
                                        className="rounded-xl border-slate-200"
                                        onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100">
                                <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl font-bold border-slate-200">Cancel</Button>
                                <Button onClick={handleCreate} disabled={isSubmitting} className="bg-[#002147] text-white rounded-xl font-bold hover:bg-blue-900">
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish Assignment'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {assignments.map((assignment) => (
                            <Card key={assignment.id} className="border-none shadow-lg hover:shadow-xl transition-shadow rounded-[2rem] bg-white overflow-hidden group">
                                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <Badge variant="outline" className="bg-white text-slate-500 border-slate-200 uppercase text-[10px] font-bold tracking-wider mb-2">{assignment.class_name}</Badge>
                                            <CardTitle className="text-lg font-bold text-slate-900 line-clamp-1">{assignment.title}</CardTitle>
                                            <CardDescription className="font-medium text-emerald-600 mt-1">{assignment.subject}</CardDescription>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                            <MoreVertical className="h-4 w-4 text-slate-400" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="flex items-center gap-3 text-sm text-slate-600">
                                        <Clock className="h-4 w-4 text-slate-400" />
                                        <span>Due: <span className="font-bold text-slate-800">{assignment.due_date}</span></span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-600">
                                        <Users className="h-4 w-4 text-slate-400" />
                                        <span className="truncate max-w-[200px]">By: <span className="font-bold text-slate-800">{assignment.staff_name || 'Unknown'}</span></span>
                                    </div>
                                    <p className="text-sm text-slate-500 line-clamp-2">{assignment.description}</p>
                                </CardContent>
                                <CardFooter className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                                    <Button variant="ghost" className="text-xs font-bold text-slate-500 hover:text-[#002147]">
                                        <Paperclip className="mr-2 h-3 w-3" /> View Attachments
                                    </Button>
                                    <Button size="sm" className="bg-[#002147] text-white rounded-lg px-4 text-xs font-bold hover:bg-blue-900">
                                        Review
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                        {assignments.length === 0 && (
                            <div className="col-span-full text-center py-12 text-slate-500">
                                No assignments found. Create one to get started!
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
