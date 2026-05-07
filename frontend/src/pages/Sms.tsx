import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Users,
  Send,
  Filter,
  Phone,
  Sparkles,
  Tag,
  Eye,
  ChevronRight
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { MSG91_SENDER_ID } from '@/lib/runtime-config';
import {
  calculateSmsCount,
  sendBulkSms,
  personaliseMessage,
  SMS_VARIABLES,
  type SmsRecipient
} from '@/lib/sms';

type ClassRow = { id: string; name: string; sort_order: number };
type StudentRow = {
  id: string;
  full_name: string;
  admission_number: string;
  class_id: string;
  classes?: { name?: string };
  father_phone?: string | null;
  mother_phone?: string | null;
  is_active?: boolean | null;

  // Fee fields for calculation
  term1_fee?: number;
  term2_fee?: number;
  term3_fee?: number;
  books_fee?: number;
  transport_fee?: number;
  old_dues?: number;
  has_books?: boolean;
  has_transport?: boolean;

  // Calculated
  totalPending?: number;
};

export default function Sms() {
  const { toast } = useToast();
  const { user, isStaff } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('whatsapp');

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [target, setTarget] = useState<'father' | 'mother' | 'both'>('father');
  const [message, setMessage] = useState('');
  const [senderId, setSenderId] = useState(MSG91_SENDER_ID || 'OXFORD');
  const [templateId, setTemplateId] = useState('');
  const [messageType, setMessageType] = useState<'promotional' | 'transactional'>('transactional');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [currentDispatchIndex, setCurrentDispatchIndex] = useState(-1);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const { data: classData } = await supabase
          .from('classes')
          .select('id, name, sort_order')
          .order('sort_order');
        setClasses((classData as ClassRow[]) || []);

        // Fetch students with all fee fields
        const { data: studentData } = await supabase
          .from('students')
          .select(`
            id, full_name, admission_number, class_id, father_phone, mother_phone, is_active, 
            term1_fee, term2_fee, term3_fee, books_fee, transport_fee, old_dues, has_books, has_transport,
            classes(name)
          `)
          .order('full_name');

        // Fetch payments to calculate actual pending
        const academicYear = getCurrentAcademicYear(); // Fallback or fetch from settings
        const [coursePaymentsRes, booksPaymentsRes] = await Promise.all([
          supabase.from('course_payments').select('student_id, amount_paid').eq('academic_year', academicYear),
          supabase.from('books_payments').select('student_id, amount_paid').eq('academic_year', academicYear),
        ]);

        const cPayments = coursePaymentsRes.data || [];
        const bPayments = booksPaymentsRes.data || [];

        const cMap = new Map<string, number>();
        (cPayments as any[]).forEach((p) => cMap.set(p.student_id as string, (cMap.get(p.student_id as string) || 0) + Number(p.amount_paid)));

        const bMap = new Map<string, number>();
        (bPayments as any[]).forEach((p) => bMap.set(p.student_id as string, (bMap.get(p.student_id as string) || 0) + Number(p.amount_paid)));

        const enriched = (studentData || []).map((s: any) => {
          const courseTotal = (Number(s.term1_fee) || 0) + (Number(s.term2_fee) || 0) + (Number(s.term3_fee) || 0) + (Number(s.old_dues) || 0);
          const coursePaid = cMap.get(s.id) || 0;
          const coursePending = Math.max(0, courseTotal - coursePaid);

          const booksTotal = s.has_books ? (Number(s.books_fee) || 0) : 0;
          const booksPaid = bMap.get(s.id) || 0;
          const booksPending = Math.max(0, booksTotal - booksPaid);

          // Simplified transport calculation for SMS (current month logic omitted for brevity if needed)
          const transportPending = 0;

          return {
            ...s,
            totalPending: coursePending + booksPending + transportPending
          };
        });

        setStudents(enriched);
      } catch (err) {
        console.error('Error loading SMS data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (s.is_active === false) return false;
      if (selectedClassId !== 'all' && s.class_id !== selectedClassId) return false;
      if (!query) return true;
      return (
        s.full_name?.toLowerCase().includes(query) ||
        s.admission_number?.toLowerCase().includes(query) ||
        s.father_phone?.includes(query) ||
        s.mother_phone?.includes(query)
      );
    });
  }, [students, selectedClassId, searchQuery]);

  const recipients = useMemo(() => {
    const list: SmsRecipient[] = [];
    const fmt = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

    for (const s of filteredStudents) {
      const className = s.classes?.name || classes.find((c) => c.id === s.class_id)?.name || '-';
      const pendingStr = fmt(s.totalPending || 0);

      if (target === 'father' || target === 'both') {
        if (s.father_phone) {
          list.push({
            studentId: s.id,
            name: s.full_name,
            class: className,
            admissionNumber: s.admission_number,
            targetPhone: s.father_phone,
            fatherPhone: s.father_phone,
            motherPhone: s.mother_phone || undefined,
            pendingFees: pendingStr
          });
        }
      }
      if (target === 'mother' || target === 'both') {
        if (s.mother_phone) {
          list.push({
            studentId: s.id,
            name: s.full_name,
            class: className,
            admissionNumber: s.admission_number,
            targetPhone: s.mother_phone,
            fatherPhone: s.father_phone || undefined,
            motherPhone: s.mother_phone,
            pendingFees: pendingStr
          });
        }
      }
    }
    return list;
  }, [filteredStudents, target, classes]);

  const missingPhones = useMemo(() => {
    return filteredStudents.filter((s) => {
      if (target === 'father') return !s.father_phone;
      if (target === 'mother') return !s.mother_phone;
      return !s.father_phone && !s.mother_phone;
    }).length;
  }, [filteredStudents, target]);

  // Live preview — shows how the message looks for a specific student
  const previewRecipient = recipients[previewIndex] || null;
  const previewMessage = previewRecipient
    ? personaliseMessage(message, previewRecipient)
    : message || 'Your personalised message will appear here.';

  // Insert a variable at cursor position in the textarea
  const insertVariable = (varKey: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setMessage((m) => m + varKey);
      return;
    }
    const start = ta.selectionStart ?? message.length;
    const end = ta.selectionEnd ?? message.length;
    const newMsg = message.slice(0, start) + varKey + message.slice(end);
    setMessage(newMsg);
    // Restore cursor after inserted variable
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + varKey.length, start + varKey.length);
    }, 0);
  };

  const handleSend = async () => {
    if (isStaff) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'Staff users cannot send SMS.' });
      return;
    }
    if (!user) {
      toast({ variant: 'destructive', title: 'Not Signed In', description: 'Please sign in to send SMS.' });
      return;
    }
    if (!message.trim()) return;
    if (recipients.length === 0) {
      toast({ variant: 'destructive', title: 'No Recipients', description: 'No recipients match your filters.' });
      return;
    }

    const confirmed = window.confirm(
      `Send personalised ${channel.toUpperCase()} to ${recipients.length} recipient(s)?\n\nExample preview:\n"${personaliseMessage(message, recipients[0])}"`
    );
    if (!confirmed) return;

    if (channel === 'whatsapp') {
      setCurrentDispatchIndex(0);
      return;
    }

    setIsSending(true);
    try {
      const result = await sendBulkSms(
        recipients,
        { body: message.trim(), senderId, templateId, type: messageType },
        user.id
      );
      toast({ title: '✅ SMS Sent', description: `Delivered ${result.delivered} / ${result.total} messages` });
      setMessage('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Send Failed', description: error.message || 'Failed to send SMS' });
    } finally {
      setIsSending(false);
    }
  };

  const openWhatsApp = (recipient: SmsRecipient) => {
    const text = personaliseMessage(message, recipient);
    const phone = recipient.targetPhone.replace(/\D/g, '');
    const url = `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleNextDispatch = () => {
    if (currentDispatchIndex < recipients.length - 1) {
      openWhatsApp(recipients[currentDispatchIndex]);
      setCurrentDispatchIndex(prev => prev + 1);
    } else {
      openWhatsApp(recipients[currentDispatchIndex]);
      setCurrentDispatchIndex(-1);
      toast({ title: '✅ Dispatch Complete', description: 'All WhatsApp messages have been initiated.' });
    }
  };

  const totalCredits = calculateSmsCount(message) * recipients.length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${channel === 'whatsapp' ? 'bg-[#25D366]/10' : 'bg-primary/10'}`}>
              {channel === 'whatsapp' ? <MessageSquare className="h-6 w-6 text-[#25D366]" /> : <Send className="h-6 w-6 text-primary" />}
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight text-oxford-blue flex items-center gap-2">
                {channel === 'whatsapp' ? 'Free WhatsApp Hub' : 'SMS Command Center'}
                <Badge className="bg-green-500 hover:bg-green-600 text-white border-none">FREE</Badge>
                <Sparkles className="h-5 w-5 text-secondary" />
              </h1>
              <p className="text-muted-foreground">
                {channel === 'whatsapp'
                  ? 'Send unlimited personalised messages to parents for free via WhatsApp.'
                  : 'Send system-automated SMS via MSG91 (requires credits & DLT approval).'}
              </p>
            </div>
          </div>
          <div className="flex bg-muted p-1 rounded-xl border">
            <button
              onClick={() => setChannel('sms')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${channel === 'sms' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Send className="h-4 w-4" />
              SMS (DLT)
            </button>
            <button
              onClick={() => setChannel('whatsapp')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${channel === 'whatsapp' ? 'bg-white shadow-sm text-[#25D366]' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <MessageSquare className="h-4 w-4" />
              WhatsApp (Free)
            </button>
          </div>
        </div>

        {currentDispatchIndex >= 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md"
            >
              <Card className="shadow-2xl border-t-4 border-t-[#25D366]">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-[#25D366] flex items-center justify-center gap-2">
                    <MessageSquare className="h-6 w-6" />
                    WhatsApp Dispatcher
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-4 text-center">
                  <div className="space-y-2">
                    <div className="text-lg font-semibold">{recipients[currentDispatchIndex]?.name}</div>
                    <div className="text-sm text-muted-foreground">{recipients[currentDispatchIndex]?.targetPhone}</div>
                    <div className="text-xs font-medium text-primary mt-2 flex items-center justify-center gap-2">
                      <span className="px-3 py-1 bg-primary/10 rounded-full">
                        Step {currentDispatchIndex + 1} of {recipients.length}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-lg text-left text-sm whitespace-pre-wrap border italic max-h-32 overflow-auto">
                    "{personaliseMessage(message, recipients[currentDispatchIndex])}"
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button variant="outline" onClick={() => setCurrentDispatchIndex(-1)}>Cancel Dispatch</Button>
                    <Button className="bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={handleNextDispatch}>
                      Send & Next <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>

                  <p className="text-[10px] text-muted-foreground leading-tight px-4">
                    Browser will open a new WhatsApp tab for each student. Click "Send & Next" to continue.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="card-elevated">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recipients</p>
                <p className="text-2xl font-display font-semibold">{recipients.length}</p>
                <p className="text-xs text-muted-foreground">
                  {filteredStudents.length} students · {missingPhones} missing phones
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
                <Phone className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{channel === 'whatsapp' ? 'Message Type' : 'Per Student'}</p>
                <p className="text-2xl font-display font-semibold">{channel === 'whatsapp' ? 'Unlimited' : calculateSmsCount(message)}</p>
                <p className="text-xs text-muted-foreground">
                  {channel === 'whatsapp' ? 'Free WhatsApp delivery' : 'SMS credit(s) per student'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <Send className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{channel === 'whatsapp' ? 'Usage Cost' : 'Total Credits'}</p>
                <p className="text-2xl font-display font-semibold text-green-600">{channel === 'whatsapp' ? '₹ 0' : totalCredits}</p>
                <p className="text-xs text-muted-foreground">{channel === 'whatsapp' ? '100% Free messaging' : 'Estimated usage'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── LEFT: Filters + Recipient List ── */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                Recipient Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target</Label>
                  <Select value={target} onValueChange={(v) => setTarget(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="mother">Mother</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  placeholder="Search by name, admission, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Active students only</Badge>
                <Badge variant="secondary">{classes.length} classes</Badge>
                <Badge variant="secondary">{filteredStudents.length} matching</Badge>
              </div>
              <div className="max-h-56 space-y-1 overflow-auto rounded-lg border p-3 bg-muted/20">
                {isLoading ? (
                  <div className="text-sm text-muted-foreground">Loading students...</div>
                ) : recipients.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No recipients found.</div>
                ) : (
                  recipients.slice(0, 40).map((r, idx) => (
                    <div
                      key={`${r.studentId}-${idx}`}
                      className={`flex items-center justify-between text-sm px-1 py-0.5 rounded cursor-pointer transition-colors ${idx === previewIndex ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40'}`}
                      onClick={() => setPreviewIndex(idx)}
                      title="Click to preview this student's message"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {idx === previewIndex && <Eye className="h-3 w-3 shrink-0 text-primary" />}
                        <span className="font-medium truncate">{r.name}</span>
                        <span className="text-muted-foreground shrink-0">· {r.class}</span>
                      </div>
                      <div className="text-muted-foreground shrink-0 text-xs">{r.targetPhone}</div>
                    </div>
                  ))
                )}
                {recipients.length > 40 && (
                  <div className="text-xs text-muted-foreground pt-1">Showing 40 of {recipients.length}</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── RIGHT: Compose ── */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Compose Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {channel === 'sms' && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Sender ID</Label>
                      <Input value={senderId} onChange={(e) => setSenderId(e.target.value)} placeholder="e.g. OXFORD" />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={messageType} onValueChange={(v) => setMessageType(v as any)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="transactional">Transactional</SelectItem>
                          <SelectItem value="promotional">Promotional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Template ID <span className="text-xs text-muted-foreground">(DLT – required for India)</span></Label>
                    <Input
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      placeholder="Paste your approved DLT Template ID from MSG91"
                    />
                  </div>
                </>
              )}

              {channel === 'whatsapp' && (
                <div className="p-4 bg-[#25D366]/5 border border-[#25D366]/20 rounded-xl flex gap-3 text-sm text-[#075E54]">
                  <MessageSquare className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">WhatsApp Mode Active (No DLT Needed)</p>
                    <p className="opacity-80">This will open WhatsApp Web or Desktop app for each student. Best for small groups or critical notices without carrier restrictions.</p>
                  </div>
                </div>
              )}

              {/* ── Variable Chips ── */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Insert Variable <span className="text-xs font-normal text-muted-foreground">(click to add to message)</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {SMS_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors"
                    >
                      <ChevronRight className="h-3 w-3" />
                      {v.label}
                      <span className="text-[10px] text-muted-foreground font-mono">{v.key}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Message Textarea ── */}
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Type your message...\n\nExample:\nDear Parent of {{name}} ({{class}}),\nYour child's fee is due. Admission No: {{admission}}.\n- Adarsh Oxford`}
                  className="min-h-[130px] font-mono text-sm"
                  maxLength={500}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{message.length} / 500 chars</span>
                  {channel === 'sms' && <span>{calculateSmsCount(message)} SMS credit(s) per student</span>}
                  {channel === 'whatsapp' && <span className="text-green-600 font-medium">Free WhatsApp message</span>}
                </div>
              </div>

              {/* ── Live Preview ── */}
              <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Eye className="h-4 w-4 text-primary" />
                    Live Preview
                  </div>
                  {previewRecipient && (
                    <span className="text-xs text-muted-foreground">
                      Showing for: <span className="font-medium text-foreground">{previewRecipient.name}</span> · {previewRecipient.class}
                    </span>
                  )}
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed rounded bg-white border p-3 min-h-[60px]">
                  {previewMessage}
                </div>
                {previewRecipient && (
                  <p className="text-xs text-muted-foreground">
                    📱 Will be sent to: <span className="font-medium">{previewRecipient.targetPhone}</span>
                    &nbsp;·&nbsp;
                    Click any name in the list to preview a different student.
                  </p>
                )}
              </div>

              {/* ── Send Button ── */}
              <Button
                className={`w-full ${channel === 'whatsapp' ? 'bg-[#25D366] hover:bg-[#128C7E] text-white' : 'btn-oxford'}`}
                onClick={handleSend}
                disabled={isSending || !message.trim() || recipients.length === 0}
              >
                {channel === 'whatsapp' ? <MessageSquare className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                {isSending
                  ? 'Sending...'
                  : channel === 'whatsapp'
                    ? `Open WhatsApp Dispatcher for ${recipients.length} students`
                    : `Send Personalised SMS to ${recipients.length} recipient(s)`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

