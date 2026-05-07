import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FeeCategoryCardProps {
  title: string;
  amount: number;
  pending?: number;
  icon: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function FeeCategoryCard({ 
  title, 
  amount, 
  pending, 
  icon, 
  onClick,
  className 
}: FeeCategoryCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={cn(
        "rounded-xl border bg-card p-6 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-display font-semibold text-primary">
            {formatCurrency(amount)}
          </p>
          {pending !== undefined && pending > 0 && (
            <p className="text-sm text-destructive mt-1">
              Pending: {formatCurrency(pending)}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}