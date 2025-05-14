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

const chartConfig = {
  price: {
    label: "Price",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;


export function HistoricalChart({ data, ticker }: HistoricalChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Historical Performance: {ticker}</CardTitle>
          <CardDescription>1 Year Price History</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <p className="text-muted-foreground">No historical data available to display.</p>
        </CardContent>
      </Card>
    );
  }
  
  const formattedData = data.map(point => ({
    ...point,
    date: format(new Date(point.date), 'MMM dd, yyyy'), // Format date for display
  }));

  return (
    <Card className="w-full shadow-lg mt-8">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Historical Performance: {ticker}</CardTitle>
        <CardDescription>1 Year Price History</CardDescription>
      </CardHeader>
      <CardContent className="h-[400px] p-0 pt-4 pr-4">
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
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(tick) => format(new Date(tick), 'MMM yy')}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tickFormatter={(value) => `$${value.toFixed(0)}`}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                domain={['auto', 'auto']}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent 
                            indicator="line" 
                            labelFormatter={(value, payload) => {
                                if (payload && payload.length > 0 && payload[0].payload.date) {
                                  return format(new Date(payload[0].payload.date), "PP");
                                }
                                return value;
                            }}
                            formatter={(value) => `$${Number(value).toFixed(2)}`} 
                            />}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                name={`Price (${ticker})`}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}