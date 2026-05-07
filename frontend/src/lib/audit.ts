// Audit logging utilities for the application

export interface AuditLogEntry {
  id?: string;
  userId: string;
  action: string;
  resource: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: string;
}

class AuditLogger {
  private static instance: AuditLogger;

  private constructor() {}

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const logEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    // In development, log to console
    console.log('[AUDIT]', logEntry);

    // TODO: In production, send to audit log service or database
    // await this.sendToAuditService(logEntry);
  }

  // Specific logging methods for different actions
  async logUserAction(userId: string, action: string, resource: string, details?: Record<string, any>): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      details,
    });
  }

  async logBroadcastActivity(action: string, userId: string, details?: Record<string, any>): Promise<void> {
    await this.log({
      userId,
      action: `broadcast_${action}`,
      resource: 'broadcast',
      details,
    });
  }

  async logFeeAction(action: string, userId: string, details?: Record<string, any>): Promise<void> {
    await this.log({
      userId,
      action: `fee_${action}`,
      resource: 'fee',
      details,
    });
  }

  async logStudentAction(action: string, userId: string, details?: Record<string, any>): Promise<void> {
    await this.log({
      userId,
      action: `student_${action}`,
      resource: 'student',
      details,
    });
  }

  async logSmsAction(action: string, userId: string, details?: Record<string, any>): Promise<void> {
    await this.log({
      userId,
      action: `sms_${action}`,
      resource: 'sms',
      details,
    });
  }

  async logSystemAction(action: string, details?: Record<string, any>): Promise<void> {
    await this.log({
      userId: 'system',
      action: `system_${action}`,
      resource: 'system',
      details,
    });
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();

// Convenience functions
export const logUserAction = (userId: string, action: string, resource: string, details?: Record<string, any>) =>
  auditLogger.logUserAction(userId, action, resource, details);

export const logBroadcastActivity = (action: string, userId: string, details?: Record<string, any>) =>
  auditLogger.logBroadcastActivity(action, userId, details);

export const logFeeAction = (action: string, userId: string, details?: Record<string, any>) =>
  auditLogger.logFeeAction(action, userId, details);

export const logStudentAction = (action: string, userId: string, details?: Record<string, any>) =>
  auditLogger.logStudentAction(action, userId, details);

export const logSmsAction = (action: string, userId: string, details?: Record<string, any>) =>
  auditLogger.logSmsAction(action, userId, details);

export const logSystemAction = (action: string, details?: Record<string, any>) =>
  auditLogger.logSystemAction(action, details);
