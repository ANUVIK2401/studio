
"use client";

import type { HistoricalDataPoint } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { format, parseISO, isValid } from 'date-fns';

interface HistoricalChartProps {
  data: HistoricalDataPoint[];
  ticker: string;
}

export function HistoricalChart({ data, ticker }: HistoricalChartProps) {
  if (!data || data.length < 2) { 
    return (
      <Card className="w-full shadow-xl mt-8 bg-card/80 backdrop-blur-sm border-border/50 card-interactive-lift">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground/90">Historical Performance: {ticker}</CardTitle>
          <CardDescription>Recent Price History</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">Insufficient historical data to display trend for {ticker}.</p>
        </CardContent>
      </Card>
    );
  }
  
  const formattedData = data
    .filter(point => point.date && point.price !== undefined && point.price !== null && !isNaN(point.price) && isValid(parseISO(point.date)))
    .map(point => ({
        ...point,
        dateISO: point.date, // Keep original ISO for XAxis key and reliable parsing
        dateFormatted: format(parseISO(point.date), 'MMM dd, yyyy'), // For tooltip display
    })) as (HistoricalDataPoint & { dateISO: string; dateFormatted: string; })[];


  if (formattedData.length < 2) {
     return (
      <Card className="w-full shadow-xl mt-8 bg-card/80 backdrop-blur-sm border-border/50 card-interactive-lift">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground/90">Historical Performance: {ticker}</CardTitle>
          <CardDescription>Recent Price History</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">Not enough valid historical data points for {ticker} to display trend after processing.</p>
        </CardContent>
      </Card>
    );
  }

  const startPrice = formattedData[0].price;
  const currentPrice = formattedData[formattedData.length - 1].price;
  
  let performanceColor = "hsl(var(--chart-1))"; 
  let performanceLabel = `Price (${ticker}) - Flat YTD`;

  if (currentPrice > startPrice) {
    performanceColor = "hsl(var(--chart-positive))";
    performanceLabel = `Price (${ticker}) - Up YTD`;
  } else if (currentPrice < startPrice) {
    performanceColor = "hsl(var(--chart-negative))";
    performanceLabel = `Price (${ticker}) - Down YTD`;
  }

  const chartConfig: ChartConfig = {
    price: {
      label: performanceLabel,
      color: performanceColor,
    },
  };

  return (
    <Card className="w-full shadow-xl mt-8 bg-card/80 backdrop-blur-sm border-border/50 card-interactive-lift">
      <CardHeader className="px-5 pt-5 pb-3">
        <CardTitle className="text-xl font-semibold text-foreground/90">Historical Performance: {ticker}</CardTitle>
        <CardDescription>Recent Price History</CardDescription>
      </CardHeader>
      <CardContent className="h-[400px] p-0 pt-4 pr-4 pb-2">
        <ChartContainer config={chartConfig} className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={formattedData}
              margin={{
                top: 5,
                right: 20, 
                left: 10, 
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="dateISO" // Use original ISO date string for reliable keying
                tickFormatter={(isoDate) => {
                    try {
                        const dateObj = parseISO(isoDate);
                        return isValid(dateObj) ? format(dateObj, 'MMM yy') : isoDate;
                    } catch (e) {
                        return isoDate; // Fallback for safety
                    }
                }}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                tickLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                interval="preserveStartEnd" 
                minTickGap={60} 
              />
              <YAxis 
                tickFormatter={(value) => `$${value.toFixed(0)}`}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                tickLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                domain={['auto', 'auto']} 
              />
              <ChartTooltip
                cursor={{stroke: 'hsl(var(--accent))', strokeWidth: 1.5, strokeDasharray: '3 3'}}
                content={<ChartTooltipContent 
                            className="bg-card/90 backdrop-blur-md shadow-xl border-border/70 rounded-lg"
                            indicator="line" 
                            labelFormatter={(value, payload) => { 
                                // Use pre-formatted date from payload if available
                                if (payload && payload.length > 0 && payload[0].payload.dateFormatted) {
                                    return payload[0].payload.dateFormatted;
                                }
                                // Fallback for safety, though dateFormatted should always be there
                                try {
                                  const dateObj = parseISO(value);
                                  return isValid(dateObj) ? format(dateObj, 'MMM dd, yyyy') : value;
                                } catch {
                                  return value;
                                }
                            }}
                            formatter={(value, name, props) => {
                              const pointData = props.payload as any;
                              const price = pointData.price;
                              const open = pointData.open;
                              const high = pointData.high;
                              const low = pointData.low;
                              const volume = pointData.volume;
                              
                              return (
                                <div className="flex flex-col gap-0.5">
                                  <span style={{ color: chartConfig.price.color, fontWeight: 'bold' }}>
                                    {chartConfig.price.label}: ${Number(price).toFixed(2)}
                                  </span>
                                  {open !== undefined && <span>Open: ${Number(open).toFixed(2)}</span>}
                                  {high !== undefined && <span>High: ${Number(high).toFixed(2)}</span>}
                                  {low !== undefined && <span>Low: ${Number(low).toFixed(2)}</span>}
                                  {volume !== undefined && <span>Volume: {Number(volume).toLocaleString()}</span>}
                                </div>
                              );
                            }}
                            itemStyle={{ color: chartConfig.price.color }} 
                            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: '600' }}
                            />}
              />
              <Legend 
                verticalAlign="top"
                wrapperStyle={{ 
                  color: chartConfig.price.color, 
                  paddingBottom: '20px', 
                  fontSize: '14px',
                  fontWeight: '500'
                }} 
                payload={[{ value: chartConfig.price.label, type: 'line', id: 'price', color: chartConfig.price.color }]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={chartConfig.price.color}
                strokeWidth={2.5}
                dot={false} 
                activeDot={{ 
                  r: 7, 
                  fill: chartConfig.price.color, 
                  stroke: 'hsl(var(--background))',
                  strokeWidth: 2.5,
                  cursor: 'pointer'
                }}
                name={chartConfig.price.label} 
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

    