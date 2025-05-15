
import type { StockData } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart3, Info, ArrowUpCircle, ArrowDownCircle, HelpCircle, CalendarClock, OpeningBell, Landmark, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StockMetricsCardProps {
  data: StockData;
}

const MetricItem: React.FC<{ label: string, value: string | number | undefined, icon?: React.ReactNode, unit?: string, tooltip?: string, valueClassName?: string }> = 
  ({ label, value, icon, tooltip, unit, valueClassName }) => (
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col p-4 bg-secondary/60 rounded-lg shadow-md hover:bg-secondary/80 transition-all duration-300 ease-out hover:shadow-xl hover:scale-[1.03] hover:-translate-y-1 cursor-default">
          <div className="flex items-center text-xs text-muted-foreground mb-1.5">
            {icon && <span className="mr-1.5 h-3.5 w-3.5">{icon}</span>}
            {label}
            {tooltip && <Info className="ml-1 h-3 w-3 text-muted-foreground/70" />}
          </div>
          <div className={`text-xl font-semibold text-foreground ${valueClassName}`}>
            {value !== undefined && value !== null && value !== "N/A" && String(value).trim() !== "" ? value : <span className="text-lg font-normal text-muted-foreground/80">N/A</span>}
            {value !== undefined && value !== null && value !== "N/A" && String(value).trim() !== "" && unit ? <span className="text-base ml-0.5">{unit}</span> : ""}
          </div>
        </div>
      </TooltipTrigger>
      {tooltip && <TooltipContent side="top"><p className="text-xs">{tooltip}</p></TooltipContent>}
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

  const lastUpdatedDate = new Date(data.lastUpdated);
  const formattedLastUpdated = !isNaN(lastUpdatedDate.getTime()) 
    ? lastUpdatedDate.toLocaleString() 
    : data.lastUpdated; // Show raw string if date is invalid


  return (
    <Card className="w-full shadow-xl bg-card/80 backdrop-blur-sm border-border/50 card-interactive-lift">
      <CardHeader className="pb-5 pt-5 px-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
          <div>
            <CardTitle className="text-2xl lg:text-3xl font-bold text-primary text-balance">
              {data.name || "Unknown Company"} <span className="text-xl lg:text-2xl text-muted-foreground/80 font-medium">({data.ticker})</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1 flex items-center">
              <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> Last updated: {formattedLastUpdated}
            </CardDescription>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1.5">
             <span className={`text-3xl lg:text-4xl font-bold ${changeColorClass}`}>
              ${data.price?.toFixed(2) ?? 'N/A'}
            </span>
            <Badge 
                className={`px-3 py-1.5 text-sm font-medium ${badgeVariantClass} self-start sm:self-auto`}
            >
              {isPositiveChange ? <TrendingUp className="h-4 w-4 mr-1" /> : isNegativeChange ? <TrendingDown className="h-4 w-4 mr-1" /> : <Minus className="h-4 w-4 mr-1" />}
              {data.change?.toFixed(2) ?? 'N/A'} ({data.changePercent?.toFixed(2) ?? 'N/A'}%)
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <MetricItem label="Market Cap" value={data.marketCap} icon={<Landmark />} tooltip="Total market value of a company's outstanding shares." />
          <MetricItem label="Volume" value={data.volume} icon={<BarChart3 />} tooltip="Number of shares traded during the latest trading day." />
          <MetricItem label="P/E Ratio" value={data.peRatio} icon={<HelpCircle />} tooltip="Price-to-Earnings ratio (Current stock price / Earnings per share)." />
          <MetricItem label="EPS" value={data.eps} icon={<HelpCircle />} unit="$" tooltip="Earnings Per Share (Portion of a company's profit allocated to each outstanding share of common stock)." />
          
          <MetricItem label="Day's Open" value={data.openPrice?.toFixed(2)} icon={<OpeningBell />} unit="$" tooltip="The price at which the stock first traded upon the opening of an exchange on a trading day."/>
          <MetricItem label="Day's High" value={data.dayHigh?.toFixed(2)} icon={<ArrowUpCircle />} unit="$" tooltip="Highest price at which the stock traded during the day." valueClassName="text-[hsl(var(--chart-positive))]/90" />
          <MetricItem label="Day's Low" value={data.dayLow?.toFixed(2)} icon={<ArrowDownCircle />} unit="$" tooltip="Lowest price at which the stock traded during the day." valueClassName="text-[hsl(var(--chart-negative))]/90"/>
          <MetricItem label="Prev. Close" value={data.previousClose?.toFixed(2)} icon={<ArrowRightLeft />} unit="$" tooltip="The stock's closing price on the preceding trading day."/>
          
          <MetricItem label="52W High" value={data.week52High?.toFixed(2)} icon={<TrendingUp />} unit="$" tooltip="Highest price at which a stock has traded during the past 52 weeks." valueClassName="text-[hsl(var(--chart-positive))]/90" />
          <MetricItem label="52W Low" value={data.week52Low?.toFixed(2)} icon={<TrendingDown />} unit="$" tooltip="Lowest price at which a stock has traded during the past 52 weeks." valueClassName="text-[hsl(var(--chart-negative))]/90"/>
        </div>
      </CardContent>
    </Card>
  );
}
