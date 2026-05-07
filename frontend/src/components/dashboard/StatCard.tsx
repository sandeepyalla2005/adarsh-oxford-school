import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  onClick?: () => void;
  children?: ReactNode;
}

const variants = {
  default: 'bg-card border',
  primary: 'bg-primary text-primary-foreground shadow-lg shadow-primary/20',
  success: 'bg-success text-success-foreground shadow-lg shadow-success/20',
  warning: 'bg-warning text-warning-foreground shadow-lg shadow-warning/20',
  destructive: 'bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
  onClick,
  children
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={cn(
        'stat-card p-6 transition-all duration-300',
        variants[variant],
        onClick && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={cn(
            'text-sm font-semibold tracking-wide uppercase',
            variant === 'default' ? 'text-muted-foreground' : 'text-white/80'
          )}>
            {title}
          </p>
          <p className="text-4xl font-display font-bold tracking-tight">
            {value}
          </p>
          {subtitle && (
            <p className={cn(
              'text-sm',
              variant === 'default' ? 'text-muted-foreground' : 'text-white/70'
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={cn(
              'mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold leading-none',
              trend.isPositive ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              <span className="ml-1 opacity-70">vs last month</span>
            </div>
          )}
        </div>
        <div className={cn(
          'flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300',
          variant === 'default' ? 'bg-primary/10 text-primary group-hover:bg-primary/20' : 'bg-white/20'
        )}>
          {icon}
        </div>
      </div>
      {children && (
        <div className="mt-4 pt-4 border-t border-white/10">
          {children}
        </div>
      )}
    </motion.div>
  );
}
