import { supabase } from "@/integrations/supabase/client";
import { logSmsAction } from "./audit";
import { MSG91_ENTITY_ID, MSG91_SENDER_ID, MSG91_TEMPLATE_ID } from "./runtime-config";

export interface SmsRecipient {
  studentId: string;
  name: string;
  class: string;
  admissionNumber?: string;
  fatherPhone?: string;
  motherPhone?: string;
  pendingFees?: string; // Format like "₹ 1,500"
  // The actual number selected to receive the SMS
  targetPhone: string;
}

export interface SmsMessage {
  title?: string;
  body: string;
  senderId: string;
  templateId?: string; // MSG91 DLT Template ID (required for India)
  type: 'promotional' | 'transactional';
}

export interface SmsTemplate {
  id?: string;
  name: string;
  body: string;
}

// Available variables for message personalization
export const SMS_VARIABLES = [
  { key: '{{name}}', label: 'Student Name', example: 'Rahul Sharma' },
  { key: '{{class}}', label: 'Class', example: 'Class 5' },
  { key: '{{admission}}', label: 'Admission No.', example: 'ADM-2024-001' },
  { key: '{{fees}}', label: 'Pending Fees', example: '₹ 2,500' },
  { key: '{{phone}}', label: 'Contact Number', example: '9876543210' },
];

// ─── MSG91 CONFIG (used as fallbacks in the Edge Function) ────────
// ─────────────────────────────────────────────────────────────────

/**
 * Replace {{variable}} placeholders with actual student data
 */
export function personaliseMessage(template: string, recipient: SmsRecipient): string {
  return template
    .replace(/\{\{name\}\}/gi, recipient.name || '')
    .replace(/\{\{class\}\}/gi, recipient.class || '')
    .replace(/\{\{admission\}\}/gi, recipient.admissionNumber || '')
    .replace(/\{\{fees\}\}/gi, recipient.pendingFees || '₹ 0')
    .replace(/\{\{phone\}\}/gi, recipient.targetPhone || '');
}

/**
 * Send personalised bulk SMS via Supabase Edge Function → MSG91 API v5.
 * The Edge Function runs server-side, avoiding browser CORS restrictions.
 */
export const sendBulkSms = async (
  recipients: SmsRecipient[],
  message: SmsMessage,
  userId: string
) => {
  await logSmsAction('bulk_send_start', userId, {
    recipientCount: recipients.length,
    messageType: message.type,
    senderId: message.senderId,
    title: message.title
  });

  try {
    console.log(`[SMS] Routing ${recipients.length} SMS(es) through Edge Function → MSG91...`);

    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: {
        recipients,
        message: message.body,
        senderId: message.senderId || MSG91_SENDER_ID,
        templateId: message.templateId || MSG91_TEMPLATE_ID,
        messageType: message.type,
        entityId: MSG91_ENTITY_ID,
      },
    });

    if (error) {
      console.error('[SMS] Edge Function Error:', error);
      // Sometimes Supabase returns "Edge Function returned a non-200 status code" as a string
      throw new Error(error.message || 'Edge Function failed to respond');
    }

    if (!data || data.success === false) {
      throw new Error(data?.error || 'Message delivery failed at MSG91');
    }

    console.log('[SMS] Success:', data);

    await logSmsAction('bulk_send_complete', userId, {
      successCount: recipients.length,
      failedCount: 0,
      msg91Response: data.msg91,
    });

    return {
      success: true,
      total: data.total || recipients.length,
      delivered: data.total || recipients.length,
      failed: 0,
      msg91: data.msg91
    };

  } catch (error: any) {
    console.error('[SMS] Error sending bulk SMS:', error);
    await logSmsAction('bulk_send_error', userId, {
      error: error.message || 'Unknown error'
    });
    throw error;
  }
};

export const saveSmsTemplate = async (template: SmsTemplate, userId: string) => {
  await logSmsAction('create_template', userId, { templateName: template.name });
  return true;
};

// Helper to calculate SMS count based on character limit (GSM 7-bit standard)
export const calculateSmsCount = (text: string): number => {
  const limit = 160;
  return Math.ceil(text.length / limit) || 1;
};
