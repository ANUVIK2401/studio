
import type { StockData } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart3, Info, ArrowUpCircle, ArrowDownCircle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StockMetricsCardProps {
  data: StockData;
}

const MetricItem: React.FC<{ label: string, value: string | number | undefined, icon?: React.ReactNode, unit?: string, tooltip?: string, valueClassName?: string }> = 
  ({ label, value, icon, tooltip, unit, valueClassName }) => ( // Added unit here
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col p-4 bg-secondary/60 rounded-lg shadow-md hover:bg-secondary/80 transition-all duration-300 ease-out hover:shadow-xl hover:scale-[1.03] hover:-translate-y-1 cursor-default">
          <div className="flex items-center text-xs text-muted-foreground mb-1.5"> {/* Reduced mb */}
            {icon && <span className="mr-1.5 h-3.5 w-3.5">{icon}</span>} {/* Reduced mr */}
            {label}
            {tooltip && <Info className="ml-1 h-3 w-3 text-muted-foreground/70" />} {/* Reduced size & ml */}
          </div>
          <div className={`text-xl font-semibold text-foreground ${valueClassName}`}> {/* Reduced value font size */}
            {value !== undefined && value !== null && value !== "N/A" ? value : <span className="text-lg font-normal text-muted-foreground/80">N/A</span>}
            {value !== undefined && value !== null && value !== "N/A" && unit ? <span className="text-base ml-0.5">{unit}</span> : ""} {/* Reduced unit font size */}
          </div>
        </div>
      </TooltipTrigger>
      {tooltip && <TooltipContent side="top"><p className="text-xs">{tooltip}</p></TooltipContent>} {/* Reduced tooltip font size */}
    </Tooltip>
  </TooltipProvider>
);


export function StockMetricsCard({ data }: StockMetricsCardProps) {
  const isPositiveChange = data.change > 0;
  const isNegativeChange = data.change < 0;

  const changeColorClass = isPositiveChange ? 'text-[hsl(var(--chart-positive))]' : isNegativeChange ? 'text-[hsl(var(--chart-negative))]' : 'text-foreground';
  const badgeVariantClass = isPositiveChange ? 'bg-green-500/10 text-[hsl(var(--chart-positive))] border-green-500/30 hover:bg-green-500/20' : 
                            isNegativeChange ? 'bg-red-500/10 text-[hsl(var(--chart-negative))] border-red-500/30 hover:bg-red-500/20' : 
                            'bg-gray-500/10 text-gray-400 border-gray-500/30 hover:bg-gray-500/20';


  return (
    <Card className="w-full shadow-xl bg-card/80 backdrop-blur-sm border-border/50 card-interactive-lift">
      <CardHeader className="pb-5 pt-5 px-5"> {/* Adjusted padding */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4"> {/* Reduced gap */}
          <div>
            <CardTitle className="text-2xl lg:text-3xl font-bold text-primary text-balance"> {/* Reduced size */}
              {data.name} <span className="text-xl lg:text-2xl text-muted-foreground/80 font-medium">({data.ticker})</span> {/* Reduced size */}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1"> {/* Reduced size & mt */}
              Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1.5"> {/* Reduced gap */}
             <span className={`text-3xl lg:text-4xl font-bold ${changeColorClass}`}> {/* Reduced size */}
              ${data.price.toFixed(2)}
            </span>
            <Badge 
                className={`px-3 py-1.5 text-sm font-medium ${badgeVariantClass} self-start sm:self-auto`} /* Reduced padding & font */
            >
              {isPositiveChange ? <TrendingUp className="h-4 w-4 mr-1" /> : isNegativeChange ? <TrendingDown className="h-4 w-4 mr-1" /> : <Minus className="h-4 w-4 mr-1" />} {/* Reduced size & mr */}
              {data.change.toFixed(2)} ({data.changePercent.toFixed(2)}%)
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"> {/* Reduced gap */}
          <MetricItem label="Market Cap" value={data.marketCap} icon={<DollarSign />} tooltip="Total market value of a company's outstanding shares." />
          <MetricItem label="Volume" value={data.volume?.toLocaleString()} icon={<BarChart3 />} tooltip="Number of shares traded during the latest trading day." />
          <MetricItem label="P/E Ratio" value={data.peRatio ?? "N/A"} icon={<HelpCircle />} tooltip="Price-to-Earnings ratio (Current stock price / Earnings per share)." />
          <MetricItem label="EPS" value={data.eps ?? "N/A"} icon={<HelpCircle />} unit="$" tooltip="Earnings Per Share (Portion of a company's profit allocated to each outstanding share of common stock)." />
          <MetricItem label="52W High" value={data.week52High?.toFixed(2)} icon={<ArrowUpCircle />} unit="$" tooltip="Highest price at which a stock has traded during the past 52 weeks." valueClassName="text-[hsl(var(--chart-positive))]/90" />
          <MetricItem label="52W Low" value={data.week52Low?.toFixed(2)} icon={<ArrowDownCircle />} unit="$" tooltip="Lowest price at which a stock has traded during the past 52 weeks." valueClassName="text-[hsl(var(--chart-negative))]/90"/>
        </div>
      </CardContent>
    </Card>
  );
}
