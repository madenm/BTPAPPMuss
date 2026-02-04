import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down';
  subtitle?: string;
  icon?: React.ReactNode;
  gradient?: string;
  className?: string;
}

export default function MetricCard({
  title,
  value,
  change,
  trend,
  subtitle,
  icon,
  gradient = "from-blue-500 to-purple-600",
  className
}: MetricCardProps) {
  return (
    <Card className={cn("hover-elevate overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-end gap-2">
              <h3 className="text-2xl font-bold text-foreground">{value}</h3>
              {change && (
                <div className={cn(
                  "flex items-center text-xs font-medium",
                  trend === 'up' ? "text-green-600" : "text-red-600"
                )}>
                  {trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {change}
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          
          {icon && (
            <div className={cn(
              "p-3 rounded-lg bg-gradient-to-r",
              gradient
            )}>
              <div className="text-white">
                {icon}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}