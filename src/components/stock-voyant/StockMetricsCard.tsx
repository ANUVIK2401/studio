import type { StockData } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart3, Info, ArrowUpCircle, ArrowDownCircle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StockMetricsCardProps {
  data: StockData;
}

const MetricItem: React.FC<{ label: string, value: string | number | undefined, icon?: React.ReactNode, unit?: string, tooltip?: string, valueClassName?: string }> = 
  ({ label, value, icon, unit, tooltip, valueClassName }) => (
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col p-3 bg-secondary/50 rounded-lg shadow-sm hover:bg-secondary/70 transition-colors duration-150">
          <div className="flex items-center text-sm text-muted-foreground mb-1">
            {icon && <span className="mr-1.5 h-4 w-4">{icon}</span>}
            {label}
            {tooltip && <Info className="ml-1 h-3 w-3 text-muted-foreground/70" />}
          </div>
          <div className={`text-xl font-semibold text-foreground ${valueClassName}`}>
            {value !== undefined && value !== null ? value : "N/A"} {unit}
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

  const changeColorClass = isPositiveChange ? 'text-green-500' : isNegativeChange ? 'text-red-500' : 'text-foreground';
  const badgeVariantClass = isPositiveChange ? 'bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20' : 
                            isNegativeChange ? 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20' : 
                            'bg-gray-500/10 text-gray-400 border-gray-500/30 hover:bg-gray-500/20';


  return (
    <Card className="w-full shadow-xl bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <CardTitle className="text-3xl font-bold text-primary">{data.name} ({data.ticker})</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 mt-3 sm:mt-0">
             <span className={`text-3xl font-bold ${changeColorClass}`}>
              ${data.price.toFixed(2)}
            </span>
            <Badge 
                className={`px-2.5 py-1.5 text-sm font-medium ${badgeVariantClass}`}
            >
              {isPositiveChange ? <TrendingUp className="h-4 w-4 mr-1" /> : isNegativeChange ? <TrendingDown className="h-4 w-4 mr-1" /> : <Minus className="h-4 w-4 mr-1" />}
              {data.change.toFixed(2)} ({data.changePercent.toFixed(2)}%)
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
          <MetricItem label="Market Cap" value={data.marketCap} icon={<DollarSign />} tooltip="Total market value of a company's outstanding shares." />
          <MetricItem label="Volume" value={data.volume?.toLocaleString()} icon={<BarChart3 />} tooltip="Number of shares traded during the latest trading day." />
          <MetricItem label="P/E Ratio" value={data.peRatio} icon={<HelpCircle />} tooltip="Price-to-Earnings ratio (Current stock price / Earnings per share)." />
          <MetricItem label="EPS" value={data.eps} icon={<HelpCircle />} unit="$" tooltip="Earnings Per Share (Portion of a company's profit allocated to each outstanding share of common stock)." />
          <MetricItem label="52W High" value={data.week52High?.toFixed(2)} icon={<ArrowUpCircle />} unit="$" tooltip="Highest price at which a stock has traded during the past 52 weeks." valueClassName="text-green-500/90" />
          <MetricItem label="52W Low" value={data.week52Low?.toFixed(2)} icon={<ArrowDownCircle />} unit="$" tooltip="Lowest price at which a stock has traded during the past 52 weeks." valueClassName="text-red-500/90"/>
        </div>
      </CardContent>
    </Card>
  );
}
