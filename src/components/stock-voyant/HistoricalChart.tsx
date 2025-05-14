
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
import { format } from 'date-fns';

interface HistoricalChartProps {
  data: HistoricalDataPoint[];
  ticker: string;
}

export function HistoricalChart({ data, ticker }: HistoricalChartProps) {
  if (!data || data.length < 2) { 
    return (
      <Card className="w-full shadow-xl mt-8 bg-card/80 backdrop-blur-sm border-border/50 card-interactive-lift">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-foreground/90">Historical Performance: {ticker}</CardTitle>
          <CardDescription>1 Year Price History</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">Insufficient historical data available to display trend.</p>
        </CardContent>
      </Card>
    );
  }
  
  const formattedData = data.map(point => ({
    dateISO: point.date, // Keep original ISO for reliable parsing by recharts/date-fns
    dateFormatted: format(new Date(point.date + 'T00:00:00Z'), 'MMM dd, yyyy'), // For display in tooltip
    price: point.price,
  }));

  const startPrice = formattedData[0].price;
  const currentPrice = formattedData[formattedData.length - 1].price;
  
  let performanceColor = "hsl(var(--chart-1))"; // Default theme color
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
        <CardTitle className="text-2xl font-semibold text-foreground/90">Historical Performance: {ticker}</CardTitle>
        <CardDescription>1 Year Price History (Mock Data)</CardDescription>
      </CardHeader>
      <CardContent className="h-[400px] p-0 pt-4 pr-4 pb-2"> {/* Adjusted padding */}
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
                dataKey="dateISO" // Use ISO for dataKey
                tickFormatter={(isoDate) => {
                    try {
                        // Parse the ISO date string correctly for formatting
                        return format(new Date(isoDate + 'T00:00:00Z'), 'MMM yy');
                    } catch (e) {
                        return isoDate; // Fallback if parsing fails
                    }
                }}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                tickLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                interval="preserveStartEnd" // Ensures first and last ticks are shown
                minTickGap={60} // Minimum gap between ticks to prevent overlap
              />
              <YAxis 
                tickFormatter={(value) => `$${value.toFixed(0)}`}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                tickLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                domain={['auto', 'auto']} // Let Recharts determine the best domain
              />
              <ChartTooltip
                cursor={{stroke: 'hsl(var(--accent))', strokeWidth: 1.5, strokeDasharray: '3 3'}}
                content={<ChartTooltipContent 
                            className="bg-card/90 backdrop-blur-md shadow-xl border-border/70 rounded-lg"
                            indicator="line" 
                            labelFormatter={(value, payload) => { // Value here is dateISO
                                if (payload && payload.length > 0 && payload[0].payload.dateFormatted) {
                                    return payload[0].payload.dateFormatted;
                                }
                                return value;
                            }}
                            formatter={(value, name, props) => {
                              // value is price, name is "price", props.payload contains full data point
                              const price = props.payload.price;
                              // Use the dynamically determined label for the tooltip item name
                              return [`$${Number(price).toFixed(2)}`, chartConfig.price.label];
                            }}
                            itemStyle={{ color: performanceColor }} // Use dynamic color for item text
                            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: '600' }}
                            />}
              />
              <Legend 
                verticalAlign="top"
                wrapperStyle={{ 
                  color: performanceColor, 
                  paddingBottom: '20px', 
                  fontSize: '14px',
                  fontWeight: '500'
                }} 
                payload={[{ value: chartConfig.price.label, type: 'line', id: 'price', color: performanceColor }]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={performanceColor}
                strokeWidth={2.5}
                dot={false} // Hide individual dots for a cleaner line
                activeDot={{ 
                  r: 7, 
                  fill: performanceColor, 
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
