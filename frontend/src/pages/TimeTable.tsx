import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, CalendarDays, User, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Plus, Trash2, Settings, ArrowUp, ArrowDown } from 'lucide-react';

// Default structure based on the user's provided image
const DEFAULT_TEMPLATES = [
    {
        name: 'Class I-V',
        columns: ['I', 'II', 'III', 'IV', 'V'],
        rows: [
            { id: 'zero', label: 'Zero Period', time: '09.00 AM - 09.10 AM', type: 'period' },
            { id: '1', label: '1', time: '09.10 AM - 09.50 AM', type: 'period' },
            { id: '2', label: '2', time: '09.50 AM - 10.30 AM', type: 'period' },
            { id: 'break1', label: 'Break', time: '10.30 AM - 10.40 AM', type: 'break' },
            { id: '3', label: '3', time: '10.40 AM - 11.20 AM', type: 'period' },
            { id: '4', label: '4', time: '11.20 AM - 12.00 PM', type: 'period' },
            { id: '5', label: '5', time: '12.00 PM - 12.40 PM', type: 'period' },
            { id: 'lunch', label: 'Lunch Break', time: '12.40 PM - 01.20 PM', type: 'break' },
            { id: '6', label: '6', time: '01.20 PM - 02.00 PM', type: 'period' },
            { id: '7', label: '7', time: '02.00 PM - 02.40 PM', type: 'period' },
            { id: 'break2', label: 'Break', time: '02.40 PM - 02.50 PM', type: 'break' },
            { id: '8', label: '8', time: '02.50 PM - 03.30 PM', type: 'period' }, // Adjusted based on standard 40m period
            { id: '9', label: '9', time: '03.30 PM - 04.10 PM', type: 'period' }  // Adjusted based on standard 40m period
        ],
        grid: {} as Record<string, { subject: string, staff: string }>,
        holidays: [] as string[]
    },
    {
        name: 'Class VI-X',
        columns: ['VI', 'VII', 'VIII', 'IX', 'X'],
        rows: [
            { id: 'zero', label: 'Zero Period', time: '09.00 AM - 09.10 AM', type: 'period' },
            { id: '1', label: '1', time: '09.10 AM - 09.50 AM', type: 'period' },
            { id: '2', label: '2', time: '09.50 AM - 10.30 AM', type: 'period' },
            { id: 'break1', label: 'Break', time: '10.30 AM - 10.40 AM', type: 'break' },
            { id: '3', label: '3', time: '10.40 AM - 11.20 AM', type: 'period' },
            { id: '4', label: '4', time: '11.20 AM - 12.00 PM', type: 'period' },
            { id: '5', label: '5', time: '12.00 PM - 12.40 PM', type: 'period' },
            { id: 'lunch', label: 'Lunch Break', time: '12.40 PM - 01.20 PM', type: 'break' },
            { id: '6', label: '6', time: '01.20 PM - 02.00 PM', type: 'period' },
            { id: '7', label: '7', time: '02.00 PM - 02.40 PM', type: 'period' },
            { id: 'break2', label: 'Break', time: '02.40 PM - 02.50 PM', type: 'break' },
            { id: '8', label: '8', time: '02.50 PM - 03.30 PM', type: 'period' },
            { id: '9', label: '9', time: '03.30 PM - 04.10 PM', type: 'period' }
        ],
        grid: {} as Record<string, { subject: string, staff: string }>,
        holidays: [] as string[]
    },
    {
        name: 'Nursery & KG',
        columns: ['Nursery', 'LKG', 'UKG'],
        rows: [
            { id: 'zero', label: 'Zero Period', time: '09.00 AM - 09.30 AM', type: 'period' },
            { id: '1', label: '1', time: '09.30 AM - 10.10 AM', type: 'period' },
            { id: '2', label: '2', time: '10.10 AM - 10.50 AM', type: 'period' },
            { id: 'break1', label: 'Break', time: '10.50 AM - 11.10 AM', type: 'break' },
            { id: '3', label: '3', time: '11.10 AM - 11.50 AM', type: 'period' },
            { id: '4', label: '4', time: '11.50 AM - 12.30 PM', type: 'period' },
            { id: 'lunch', label: 'Lunch Break', time: '12.30 PM - 01.10 PM', type: 'break' },
            { id: '5', label: '5', time: '01.10 PM - 01.50 PM', type: 'period' }
        ],
        grid: {} as Record<string, { subject: string, staff: string }>,
        holidays: [] as string[]
    }
];

export default function TimeTable() {
    const { userRole, isAdmin: isSystemAdmin } = useAuth();
    const canEdit = isSystemAdmin || userRole === 'feeInCharge';

    const [timetables, setTimetables] = useState<any[]>(DEFAULT_TEMPLATES);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('Class VI-X');
    const [selectedDay, setSelectedDay] = useState('Monday');
    const [staffList, setStaffList] = useState<string[]>([]);
    const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
    const [editingRows, setEditingRows] = useState<any[]>([]);
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    useEffect(() => {
        fetchTimetables();
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('is_active', true)
                .order('full_name');

            if (error) {
                console.error('Error fetching staff:', error);
                return;
            }

            if (data) {
                setStaffList(data.map(p => (p.full_name as string)).filter(Boolean));
            }
        } catch (error) {
            console.error('Error in fetchStaff:', error);
        }
    };

    const fetchTimetables = async () => {
        try {
            const { data, error } = await supabase.from('timetables').select('*').order('id');
            if (error) {
                // If table doesn't exist yet, we stick to default templates (fallback)
                console.error('Error fetching timetables:', error);
                setIsLoading(false);
                return;
            }

            if (data && data.length > 0) {
                // Map DB data back to state
                const loaded = (data as any[]).map(d => ({
                    id: d.id,
                    name: d.name,
                    ...d.data // columns, rows, grid, holidays
                }));
                // Ensure holidays is array if missing
                loaded.forEach(l => {
                    if (!l.holidays) l.holidays = [];
                });
                
                // Merge with defaults to ensure new templates (like Nursery) appear
                const merged = [...DEFAULT_TEMPLATES].map(dt => {
                    const dbEntry = loaded.find(l => l.name === dt.name);
                    return dbEntry || dt;
                });
                
                setTimetables(merged);
            } else {
                // No data in DB, stay with defaults
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!canEdit) return;
        setIsSaving(true);
        try {
            // ── 1. Persist timetable JSONB blob ─────────────────────────────
            const { data: existing } = await supabase.from('timetables').select('id, name');

            for (const t of timetables) {
                const payload = {
                    name: t.name,
                    data: { columns: t.columns, rows: t.rows, grid: t.grid, holidays: t.holidays || [] },
                    updated_at: new Date().toISOString()
                };
                const match = existing?.find(e => e.name === t.name);
                if (match) {
                    await supabase.from('timetables').update({ data: payload.data }).eq('id', match.id);
                } else {
                    await supabase.from('timetables').insert([{ name: t.name, data: payload.data }]);
                }
            }

            // ── 2. Rebuild staff_schedule from timetable grid ────────────────
            // Collect all valid assignments across all timetables, all days
            const scheduleRows: Array<{
                staff_name: string;
                day: string;
                period_id: string;
                period_label: string;
                period_time: string;
                class_name: string;
                subject: string;
                timetable_group: string;
            }> = [];

            // Track duplicates: staffName → set of "day|periodId"
            const seenKeys: Record<string, Set<string>> = {};
            const duplicateWarnings: string[] = [];

            for (const t of timetables) {
                for (const day of DAYS) {
                    // Skip if holiday for this timetable group
                    if (t.holidays?.includes(day)) continue;

                    for (const row of t.rows) {
                        if (row.type === 'break') continue; // skip break rows

                        for (const col of t.columns) {
                            const cellKey = `${day}-${row.id}-${col}`;
                            const cell = t.grid?.[cellKey];
                            if (!cell?.staff || !cell?.subject) continue; // skip empty cells

                            const staffName = cell.staff.trim();
                            const subject = cell.subject.trim();
                            const dupKey = `${day}|${row.id}`;

                            // Duplicate check
                            if (!seenKeys[staffName]) seenKeys[staffName] = new Set();
                            if (seenKeys[staffName].has(dupKey)) {
                                duplicateWarnings.push(
                                    `⚠️ ${staffName} is assigned to multiple classes on ${day} Period ${row.label}`
                                );
                            } else {
                                seenKeys[staffName].add(dupKey);
                            }

                            scheduleRows.push({
                                staff_name: staffName,
                                day,
                                period_id: row.id,
                                period_label: row.label,
                                period_time: row.time,
                                class_name: col,
                                subject,
                                timetable_group: t.name,
                            });
                        }
                    }
                }
            }

            // Show duplicate warnings (non-blocking)
            if (duplicateWarnings.length > 0) {
                toast.warning(`Double-booking detected:\n${duplicateWarnings.slice(0, 3).join('\n')}`);
            }

            // Delete all existing staff schedule entries and re-insert
            const { error: deleteError } = await supabase
                .from('staff_schedule')
                .delete()
                .gte('id', 1); // bigint identity starts at 1

            if (deleteError) {
                console.error('staff_schedule delete error:', deleteError);
                toast.error(`Could not clear staff schedule: ${deleteError.message}. Check RLS policies.`);
                return;
            }

            if (scheduleRows.length > 0) {
                const { error: insertError } = await supabase
                    .from('staff_schedule')
                    .insert(scheduleRows);
                if (insertError) {
                    console.error('staff_schedule insert error:', insertError);
                    toast.error(`Could not save staff schedule: ${insertError.message}`);
                    return;
                }
            }

            toast.success(`Timetable saved & ${scheduleRows.length} staff schedule entries synced!`);
            fetchTimetables();
        } catch (error: any) {
            toast.error('Failed to save timetable: ' + (error.message || ''));
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const updateCell = (timetableIndex: number, cellKey: string, field: 'subject' | 'staff', value: string) => {
        const newTimetables = [...timetables];
        const grid = { ...newTimetables[timetableIndex].grid };

        if (!grid[cellKey]) {
            grid[cellKey] = { subject: '', staff: '' };
        }

        grid[cellKey] = {
            ...grid[cellKey],
            [field]: value
        };

        newTimetables[timetableIndex].grid = grid;
        setTimetables(newTimetables);
    };

    const toggleHoliday = (timetableIndex: number) => {
        if (!canEdit) return;
        const newTimetables = [...timetables];
        const holidays = newTimetables[timetableIndex].holidays || [];

        if (holidays.includes(selectedDay)) {
            newTimetables[timetableIndex].holidays = holidays.filter((d: string) => d !== selectedDay);
        } else {
            newTimetables[timetableIndex].holidays = [...holidays, selectedDay];
        }
        setTimetables(newTimetables);
    };

    const openConfigDialog = () => {
        const currentTimetable = timetables.find(t => t.name === activeTab);
        if (currentTimetable) {
            setEditingRows(JSON.parse(JSON.stringify(currentTimetable.rows)));
            setIsConfigDialogOpen(true);
        }
    };

    const handleAddRow = (type: 'period' | 'break') => {
        const newRow = {
            id: Date.now().toString(),
            label: type === 'period' ? (editingRows.filter(r => r.type === 'period').length + 1).toString() : 'Break',
            time: '09:00 AM - 09:40 AM',
            type
        };
        setEditingRows([...editingRows, newRow]);
    };

    const handleRemoveRow = (id: string) => {
        setEditingRows(editingRows.filter(r => r.id !== id));
    };

    const updateEditingRow = (index: number, field: string, value: string) => {
        const newRows = [...editingRows];
        newRows[index] = { ...newRows[index], [field]: value };
        setEditingRows(newRows);
    };

    const moveRow = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === editingRows.length - 1) return;
        const newRows = [...editingRows];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newRows[index], newRows[swapIndex]] = [newRows[swapIndex], newRows[index]];
        setEditingRows(newRows);
    };

    const applyConfiguration = () => {
        // Basic validation: ensure times are set
        if (editingRows.some(r => !r.time.includes('-') || r.time.length < 10)) {
            toast.error("Please ensure all periods have a valid time range (e.g., 09:00 AM - 09:40 AM)");
            return;
        }

        const newTimetables = timetables.map(t => {
            if (t.name === activeTab) {
                return { ...t, rows: editingRows };
            }
            return t;
        });
        setTimetables(newTimetables);
        setIsConfigDialogOpen(false);
        toast.success("Timetable structure updated for " + activeTab + ". Don't forget to Save Changes.");
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex h-96 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6 pb-20">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-[#002147] font-display">Weekly Master Timetable</h1>
                        <p className="text-slate-500 font-medium">Manage weekly class schedules by day</p>
                    </div>
                    {canEdit && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={openConfigDialog}
                                className="border-[#002147] text-[#002147] hover:bg-slate-50 rounded-xl px-6"
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                Configure Periods
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-[#002147] hover:bg-[#002147]/90 text-white rounded-xl px-6 shadow-lg shadow-blue-900/20"
                            >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Changes
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-6">
                    {/* Day Selector */}
                    <div className="flex justify-center">
                        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm inline-flex overflow-x-auto max-w-full">
                            {DAYS.map((day) => (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDay(day)}
                                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${selectedDay === day
                                        ? 'bg-[#002147] text-white shadow-md'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm mb-6 h-auto inline-flex">
                            {timetables.map((t) => (
                                <TabsTrigger
                                    key={t.name}
                                    value={t.name}
                                    className="rounded-lg px-6 py-2.5 font-bold data-[state=active]:bg-[#002147] data-[state=active]:text-white transition-all"
                                >
                                    {t.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {timetables.map((timetable, tIndex) => (
                            <TabsContent key={timetable.name} value={timetable.name}>
                                <Card className="border-none shadow-xl rounded-[1.5rem] overflow-hidden bg-white">
                                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                        <div className="flex items-center gap-2">
                                            <CalendarDays className="h-4 w-4 text-slate-500" />
                                            <span className="text-sm font-bold text-slate-700">{selectedDay} Schedule</span>
                                        </div>

                                        {canEdit && (
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Mark as Holiday</span>
                                                <Switch
                                                    checked={timetable.holidays?.includes(selectedDay)}
                                                    onCheckedChange={() => toggleHoliday(tIndex)}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {timetable.holidays?.includes(selectedDay) ? (
                                        <div className="h-96 flex flex-col items-center justify-center text-center p-8 bg-slate-50/30">
                                            <div className="h-20 w-20 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                                                <CalendarDays className="h-10 w-10 text-amber-500" />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-800">Weekly Holiday</h3>
                                            <p className="text-slate-500 max-w-sm mt-2">
                                                {selectedDay} has been marked as a weekly holiday for this class group. No classes are scheduled.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse min-w-[1000px]">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100">
                                                        <th className="p-4 text-left min-w-[180px] sticky left-0 bg-slate-50 z-10 border-r border-slate-100">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                                                                    {selectedDay} Schedule
                                                                </span>
                                                                <span className="text-sm font-bold text-slate-700">Period</span>
                                                            </div>
                                                        </th>
                                                        {timetable.columns.map((col: string) => (
                                                            <th key={col} className="p-4 text-center min-w-[200px] border-r border-slate-100 last:border-r-0">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <div className="h-8 w-8 rounded-lg bg-[#002147] text-white flex items-center justify-center font-bold text-sm shadow-md">
                                                                        {col}
                                                                    </div>
                                                                    <span className="text-sm font-bold text-slate-700">Class {col}</span>
                                                                </div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {timetable.rows.map((row: any) => (
                                                        <tr key={row.id} className="border-b border-slate-100 group hover:bg-slate-50/50 transition-colors">
                                                            {/* Row Header */}
                                                            <td className="p-4 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 border-r border-slate-100">
                                                                <div className="flex flex-col">
                                                                    <span className={`text-sm font-bold ${row.type === 'break' ? 'text-amber-600' : 'text-[#002147]'}`}>
                                                                        {row.label}
                                                                    </span>
                                                                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1 mt-1">
                                                                        <CalendarDays className="h-3 w-3" />
                                                                        {row.time}
                                                                    </span>
                                                                </div>
                                                            </td>

                                                            {/* Data Cells */}
                                                            {row.type === 'break' ? (
                                                                <td colSpan={timetable.columns.length} className="p-2 bg-amber-50/30 text-center border-b border-amber-100/50">
                                                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-400/70">
                                                                        {row.label === 'Lunch Break' ? 'Lunch Break' : 'Short Break'}
                                                                    </span>
                                                                </td>
                                                            ) : (
                                                                timetable.columns.map((col: string) => {
                                                                    const cellKey = `${selectedDay}-${row.id}-${col}`;
                                                                    const cellData = timetable.grid?.[cellKey] || { subject: '', staff: '' };

                                                                    return (
                                                                        <td key={cellKey} className="p-3 border-r border-slate-100 last:border-r-0">
                                                                            <div className="space-y-2">
                                                                                <div className="relative">
                                                                                    <BookOpen className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 z-10" />
                                                                                    <Input
                                                                                        placeholder="Subject"
                                                                                        className="h-8 pl-8 text-xs font-bold border-slate-200 bg-white focus:ring-1 focus:ring-blue-100 placeholder:font-normal"
                                                                                        value={cellData.subject}
                                                                                        onChange={(e) => updateCell(tIndex, cellKey, 'subject', e.target.value)}
                                                                                        disabled={!canEdit}
                                                                                    />
                                                                                </div>
                                                                                <div className="relative">
                                                                                    <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 z-10" />
                                                                                    <Select
                                                                                        value={cellData.staff}
                                                                                        onValueChange={(val) => updateCell(tIndex, cellKey, 'staff', val)}
                                                                                        disabled={!canEdit}
                                                                                    >
                                                                                        <SelectTrigger className="h-8 pl-8 text-xs font-medium border-slate-200 bg-slate-50/50 focus:ring-1 focus:ring-blue-100">
                                                                                            <SelectValue placeholder="Select Staff" />
                                                                                        </SelectTrigger>
                                                                                        <SelectContent>
                                                                                            {staffList.length > 0 ? (
                                                                                                staffList.map((staffName) => (
                                                                                                    <SelectItem key={staffName} value={staffName} className="text-xs">
                                                                                                        {staffName}
                                                                                                    </SelectItem>
                                                                                                ))
                                                                                            ) : (
                                                                                                <SelectItem value="none" disabled>
                                                                                                    No staff found
                                                                                                </SelectItem>
                                                                                            )}
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    );
                                                                })
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Card>
                            </TabsContent>
                        ))}
                    </Tabs>
                </div>

                <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
                    <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto rounded-[1.5rem]">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-[#002147]">Configure {activeTab} Structure</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                                <span className="text-sm font-bold text-slate-600">Period / Break List</span>
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => handleAddRow('period')} className="bg-blue-600 hover:bg-blue-700">
                                        <Plus className="h-4 w-4 mr-1" /> Add Period
                                    </Button>
                                    <Button size="sm" onClick={() => handleAddRow('break')} className="bg-amber-600 hover:bg-amber-700">
                                        <Plus className="h-4 w-4 mr-1" /> Add Break
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {editingRows.map((row, index) => (
                                    <div key={row.id} className="flex gap-3 items-center p-3 bg-white border border-slate-100 rounded-xl hover:shadow-md transition-all group">
                                        <div className="flex flex-col gap-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveRow(index, 'up')} disabled={index === 0}>
                                                <ArrowUp className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveRow(index, 'down')} disabled={index === editingRows.length - 1}>
                                                <ArrowDown className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        
                                        <div className="grid grid-cols-12 gap-3 flex-1 items-center">
                                            <div className="col-span-1 flex items-center justify-center">
                                                <Badge variant={row.type === 'break' ? 'secondary' : 'default'} className="uppercase text-[10px]">
                                                    {row.type === 'period' ? 'P' : 'B'}
                                                </Badge>
                                            </div>
                                            <div className="col-span-4">
                                                <Input 
                                                    value={row.label} 
                                                    onChange={(e) => updateEditingRow(index, 'label', e.target.value)}
                                                    placeholder="e.g. 1 or Lunch Break"
                                                    className="h-9 font-bold text-sm"
                                                />
                                            </div>
                                            <div className="col-span-5">
                                                <Input 
                                                    value={row.time} 
                                                    onChange={(e) => updateEditingRow(index, 'time', e.target.value)}
                                                    placeholder="09:00 AM - 09:40 AM"
                                                    className="h-9 text-xs font-medium"
                                                />
                                            </div>
                                            <div className="col-span-2 flex justify-end">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleRemoveRow(row.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button onClick={applyConfiguration} className="bg-[#002147] hover:bg-[#002147]/90 text-white">
                                Apply Changes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
