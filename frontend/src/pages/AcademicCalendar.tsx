import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    GraduationCap,
    ChevronLeft,
    Upload,
    FileText,
    FileSpreadsheet,
    Image as ImageIcon,
    Download,
    Replace,
    Trash2,
    CheckCircle2,
    FileUp,
    CloudUpload,
    CalendarDays,
    X,
    FileUp as FileUpIcon,
    Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { getCurrentAcademicYear } from '@/lib/academic-year';

export default function AcademicCalendar() {
    const [classes, setClasses] = useState<string[]>([]);
    useEffect(() => {
        async function fetchClasses() {
            const { data } = await supabase.from('classes').select('name').order('sort_order');
            if (data) setClasses(data.map(c => c.name));
        }
        fetchClasses();
    }, []);

    const { userRole, isAdmin: isSystemAdmin } = useAuth();
    const canManage = isSystemAdmin || userRole === 'feeInCharge';
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<{ file: File; name: string; type: string; size: string } | null>(null);
    const [uploadClass, setUploadClass] = useState<string>('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [existingCalendars, setExistingCalendars] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        fetchCalendars();
    }, []);

    async function fetchCalendars() {
        try {
            const { data, error } = await supabase.from('academic_calendars').select('*');
            if (error) throw error;
            setExistingCalendars(data || []);
        } catch (error) {
            console.error('Error fetching calendars:', error);
        } finally {
            setIsFetching(false);
        }
    }

    const handlePublish = async () => {
        if (!uploadClass || !uploadedFile) {
            toast.error('Please select a class and upload a file');
            return;
        }

        setIsUploading(true);
        try {
            const safeFileName = uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const filePath = `${uploadClass}/${Date.now()}-${safeFileName}`;
            const { error: uploadError } = await supabase.storage
                .from('academic-calendars')
                .upload(filePath, uploadedFile.file, {
                    upsert: true,
                    contentType: uploadedFile.file.type || 'application/octet-stream',
                });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage.from('academic-calendars').getPublicUrl(filePath);
            const academicYear = getCurrentAcademicYear();

            const { error } = await supabase.from('academic_calendars').upsert({
                class_name: uploadClass,
                file_name: uploadedFile.name,
                file_url: publicUrlData.publicUrl,
                file_size: uploadedFile.size,
                file_type: uploadedFile.type,
                academic_year: academicYear
            }, { onConflict: 'class_name,academic_year' });

            if (error) throw error;

            toast.success(`Academic Calendar for ${uploadClass} published!`);
            setUploadedFile(null);
            setUploadClass('');
            setIsAdminMode(false);
            fetchCalendars();
        } catch (error: any) {
            toast.error('Failed to publish: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadedFile({
                file,
                name: file.name,
                type: file.type,
                size: (file.size / 1024).toFixed(1) + ' KB'
            });
        }
    };

    const removeFile = () => {
        setUploadedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <DashboardLayout>
            <div className="space-y-8">
                <AnimatePresence mode="wait">
                    {!selectedClass && !isAdminMode ? (
                        <motion.div
                            key="grid"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8"
                        >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h1 className="text-3xl font-bold tracking-tight text-[#002147] font-display">Academic Calendar</h1>
                                    <p className="text-slate-500 mt-1">Select a class to view its official academic year schedule</p>
                                </div>
                                {canManage && (
                                    <Button
                                        onClick={() => setIsAdminMode(true)}
                                        className="bg-[#002147] hover:bg-[#002147]/90 text-white shadow-[0_10px_20px_-5px_rgba(0,33,71,0.3)] rounded-xl h-12 px-6"
                                    >
                                        <FileUp className="mr-2 h-5 w-5" />
                                        Management Portal
                                    </Button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                {classes.map((className, index) => {
                                    const hasCalendar = existingCalendars.some(c => c.class_name === className);
                                    return (
                                        <motion.div
                                            key={className}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            onClick={() => setSelectedClass(className)}
                                            className="group relative cursor-pointer overflow-hidden rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-900/10 hover:ring-blue-50"
                                        >
                                            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-150" />

                                            <div className="relative flex flex-col items-center gap-5">
                                                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-[#002147] text-white shadow-lg shadow-blue-900/20 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                                                    <CalendarDays className="h-7 w-7" />
                                                    <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>

                                                <div className="text-center space-y-1.5 z-10">
                                                    <h3 className="font-display text-lg font-bold text-slate-800 tracking-tight transition-colors group-hover:text-[#002147]">
                                                        {className}
                                                    </h3>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">
                                                        {hasCalendar ? 'View Calendar' : 'Not Published'}
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    ) : isAdminMode ? (
                        <motion.div
                            key="admin"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="max-w-4xl mx-auto space-y-6"
                        >
                            <div className="flex items-center gap-4">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setIsAdminMode(false)}
                                    className="rounded-full h-12 w-12 border-slate-200"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <div>
                                    <h1 className="text-2xl font-bold text-[#002147] font-display">Calendar Management</h1>
                                    <p className="text-sm text-slate-500">Upload and update official academic calendars</p>
                                </div>
                            </div>

                            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                                <CardHeader className="bg-[#002147] text-white p-8">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white/10 rounded-lg">
                                                <CloudUpload className="h-6 w-6 text-white" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-xl">Upload New Calendar</CardTitle>
                                                <CardDescription className="text-white/60">Select target class for the calendar file</CardDescription>
                                            </div>
                                        </div>
                                        <Badge className="bg-white/10 text-white border-white/20 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider">Administration</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-10 space-y-10">
                                    <div className="max-w-md">
                                        <div className="space-y-3">
                                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 ml-1">Target Class</label>
                                            <Select value={uploadClass} onValueChange={setUploadClass}>
                                                <SelectTrigger className="rounded-2xl border-slate-200 h-14 bg-slate-50/50">
                                                    <SelectValue placeholder="Select Class" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                                                    {classes.map((cls) => (
                                                        <SelectItem key={cls} value={cls}>
                                                            {cls}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {!uploadedFile ? (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className={cn(
                                                "relative group cursor-pointer border-2 border-dashed border-slate-200 rounded-[2.5rem] p-16 transition-all",
                                                "hover:border-[#002147]/30 hover:bg-[#002147]/5 flex flex-col items-center justify-center gap-6",
                                                isUploading && "pointer-events-none opacity-60"
                                            )}
                                        >
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg"
                                            />
                                            <div className="h-20 w-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-[#002147] group-hover:shadow-xl transition-all duration-500">
                                                {isUploading ? (
                                                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#002147] border-t-transparent" />
                                                ) : (
                                                    <Upload className="h-10 w-10" />
                                                )}
                                            </div>
                                            <div className="text-center space-y-2">
                                                <p className="text-xl font-bold text-[#002147]">Drag & Drop Academic Calendar</p>
                                                <p className="text-sm text-slate-500 max-w-xs">Supports: PDF, Excel, JPG, PNG (Max 15MB)</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                                            <div className="flex items-center justify-between p-8 rounded-[2rem] bg-emerald-50 border border-emerald-100 shadow-inner">
                                                <div className="flex items-center gap-6">
                                                    <div className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center text-emerald-600 shadow-md">
                                                        {uploadedFile.name.toLowerCase().endsWith('pdf') ? <FileText className="h-8 w-8" /> :
                                                            uploadedFile.name.toLowerCase().endsWith('xlsx') ? <FileSpreadsheet className="h-8 w-8" /> :
                                                                <ImageIcon className="h-8 w-8" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-bold text-slate-900">{uploadedFile.name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge className="bg-emerald-600 text-white rounded-md text-[10px] tracking-widest">{uploadedFile.size}</Badge>
                                                            <span className="text-xs text-emerald-600 font-medium italic">Ready for Publishing</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-[#002147] rounded-full h-12 w-12 hover:bg-white transition-colors">
                                                        <Replace className="h-5 w-5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={removeFile} className="text-slate-400 hover:text-red-500 rounded-full h-12 w-12 hover:bg-red-50 transition-colors">
                                                        <X className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="rounded-[2rem] border border-slate-100 bg-slate-50 p-8 shadow-inner">
                                                <div className="flex items-center justify-between mb-6">
                                                    <p className="text-[11px] font-bold uppercase text-slate-400 tracking-[0.2em]">Calendar Source Mock</p>
                                                    <Badge variant="outline" className="text-[10px] border-slate-200">Standard View</Badge>
                                                </div>
                                                <div className="h-56 rounded-3xl bg-white border border-slate-200/50 flex items-center justify-center overflow-hidden">
                                                    <div className="text-center space-y-3 opacity-30">
                                                        <Calendar className="h-12 w-12 mx-auto text-[#002147]" />
                                                        <p className="text-[11px] font-black text-[#002147] uppercase tracking-[0.1em]">Academic Year {getCurrentAcademicYear()}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-4 justify-end pt-4">
                                                <Button variant="ghost" onClick={removeFile} className="rounded-2xl h-14 px-8 font-bold text-slate-500 hover:bg-slate-100 transition-colors">Discard</Button>
                                                <Button
                                                    onClick={handlePublish}
                                                    disabled={isUploading || !uploadClass}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-14 px-10 font-bold shadow-xl shadow-emerald-500/20 transition-all"
                                                >
                                                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                    Publish Official Calendar
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="detail"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-6">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setSelectedClass(null)}
                                        className="rounded-full h-14 w-14 border-slate-200 shadow-sm hover:shadow-md transition-all"
                                    >
                                        <ChevronLeft className="h-6 w-6" />
                                    </Button>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h1 className="text-4xl font-black text-[#002147] font-display">{selectedClass}</h1>
                                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold">Academic Session {getCurrentAcademicYear()}</Badge>
                                        </div>
                                        <p className="text-slate-500 font-medium">Official School Calendar & Important Dates</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button variant="outline" className="rounded-2xl border-slate-200 h-14 px-8 font-bold hover:bg-slate-50 transition-colors">
                                        <Download className="mr-3 h-5 w-5" />
                                        Download PDF
                                    </Button>
                                    <Button className="bg-[#002147] hover:bg-[#002147]/90 text-white rounded-2xl h-14 px-8 font-bold shadow-lg shadow-[#002147]/20 transition-all">
                                        View Important Dates
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-8">
                                <Card className="border-none shadow-2xl overflow-hidden rounded-[3rem] bg-white group">
                                    <div className="bg-[#002147] p-10 text-white relative">
                                        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-white/5 to-transparent" />
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-6">
                                                <div className="h-20 w-20 rounded-[1.5rem] bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-inner">
                                                    <Calendar className="h-10 w-10 text-white" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/50">Official Schedule</p>
                                                    <h2 className="text-2xl font-bold tracking-tight">Academic_Calendar_{selectedClass}.pdf</h2>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 text-[12px] font-bold text-white/40 italic">
                                                Maintained by Academic Cell
                                            </div>
                                        </div>
                                    </div>
                                    <CardContent className="p-0 bg-slate-50/50 flex items-center justify-center min-h-[650px] relative">
                                        <div className="absolute inset-x-12 inset-y-12 bg-white rounded-[2rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-slate-100 flex flex-col p-1">
                                            <div className="h-12 border-b border-slate-50 flex items-center justify-between px-8 bg-slate-50/30 rounded-t-[2rem]">
                                                <div className="flex gap-2">
                                                    <div className="h-2 w-2 rounded-full bg-red-400" />
                                                    <div className="h-2 w-2 rounded-full bg-amber-400" />
                                                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                                                </div>
                                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">School_Calendar_Vault_v1.2</p>
                                            </div>
                                            <div className="flex-1 overflow-hidden rounded-b-[2rem]">
                                                {(() => {
                                                    const currentCalendar = existingCalendars.find(c => c.class_name === selectedClass);
                                                    if (currentCalendar?.file_url) {
                                                        const isImage = currentCalendar.file_type?.includes('image');
                                                        return isImage ? (
                                                            <img src={currentCalendar.file_url} alt="Academic Calendar" className="w-full h-full object-contain p-4" />
                                                        ) : (
                                                            <iframe
                                                                src={`${currentCalendar.file_url}#toolbar=0`}
                                                                className="w-full h-full min-h-[600px] border-none"
                                                                title="Academic Calendar"
                                                            />
                                                        );
                                                    }
                                                    return (
                                                        <div className="flex flex-col items-center justify-center h-full space-y-8 py-12">
                                                            <div className="h-32 w-32 rounded-[2.5rem] bg-slate-50 flex items-center justify-center text-[#002147]/20 group-hover:scale-110 transition-transform duration-700">
                                                                <CalendarDays className="h-16 w-16" />
                                                            </div>
                                                            <div className="text-center space-y-3 max-w-sm">
                                                                <h3 className="text-2xl font-black text-[#002147] tracking-tight">No Calendar Published</h3>
                                                                <p className="text-sm text-slate-400 leading-relaxed font-medium px-4">The academic calendar for {selectedClass} has not been uploaded yet. Please check back later.</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
}
