import type { StockData } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart3, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StockMetricsCardProps {
  data: StockData;
}

const MetricItem: React.FC<{ label: string, value: string | number | undefined, icon?: React.ReactNode, unit?: string, tooltip?: string }> = ({ label, value, icon, unit, tooltip }) => (
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col p-3 bg-secondary/50 rounded-md shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center text-sm text-muted-foreground mb-1">
            {icon && <span className="mr-1.5">{icon}</span>}
            {label}
            {tooltip && <Info className="ml-1 h-3 w-3 text-muted-foreground/70" />}
          </div>
          <div className="text-xl font-semibold text-foreground">
            {value ?? "N/A"} {unit}
          </div>
        </div>
      </TooltipTrigger>
      {tooltip && <TooltipContent><p>{tooltip}</p></TooltipContent>}
    </Tooltip>
  </TooltipProvider>
);


export function StockMetricsCard({ data }: StockMetricsCardProps) {
  const isPositiveChange = data.change > 0;
  const isNegativeChange = data.change < 0;

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <CardTitle className="text-3xl font-bold text-primary">{data.name} ({data.ticker})</CardTitle>
            <CardDescription className="text-sm">Last updated: {new Date(data.lastUpdated).toLocaleString()}</CardDescription>
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
             <span className={`text-3xl font-bold ${isPositiveChange ? 'text-green-600' : isNegativeChange ? 'text-red-600' : 'text-foreground'}`}>
              ${data.price.toFixed(2)}
            </span>
            <Badge variant={isPositiveChange ? 'default' : isNegativeChange ? 'destructive' : 'secondary'} 
                   className={`px-2 py-1 text-sm ${isPositiveChange ? 'bg-green-100 text-green-700 border-green-300' : isNegativeChange ? 'bg-red-100 text-red-700 border-red-300' : 'bg-gray-100 text-gray-700 border-gray-300'}`}>
              {isPositiveChange ? <TrendingUp className="h-4 w-4 mr-1" /> : isNegativeChange ? <TrendingDown className="h-4 w-4 mr-1" /> : <Minus className="h-4 w-4 mr-1" />}
              {data.change.toFixed(2)} ({data.changePercent.toFixed(2)}%)
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricItem label="Market Cap" value={data.marketCap} icon={<DollarSign className="h-4 w-4" />} tooltip="Total market value of a company's outstanding shares." />
          <MetricItem label="Volume" value={data.volume} icon={<BarChart3 className="h-4 w-4" />} tooltip="Number of shares traded during a given period." />
          <MetricItem label="P/E Ratio" value={data.peRatio} tooltip="Price-to-Earnings ratio." />
          <MetricItem label="EPS" value={data.eps} tooltip="Earnings Per Share." />
        </div>
      </CardContent>
    </Card>
  );
}