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
      <Card className="w-full shadow-xl mt-8 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-foreground/90">Historical Performance: {ticker}</CardTitle>
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
    // Ensure date is treated as UTC to avoid timezone shifts
    date: format(new Date(point.date + 'T00:00:00Z'), 'MMM dd, yyyy'), 
  }));

  return (
    <Card className="w-full shadow-xl mt-8 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-foreground/90">Historical Performance: {ticker}</CardTitle>
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
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="date" 
                tickFormatter={(label) => {
                    // Attempt to parse the formatted date string back to a Date object
                    // This might be tricky if the format is ambiguous or locale-dependent
                    // A more robust way is to keep original date objects or timestamps for formatting
                    try {
                        // Assuming 'MMM dd, yyyy' format from formattedData
                        return format(new Date(label), 'MMM yy');
                    } catch (e) {
                        return label; // fallback
                    }
                }}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                tickLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
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
                            className="bg-card/90 backdrop-blur-sm shadow-xl border-border/70"
                            indicator="line" 
                            labelFormatter={(value, payload) => {
                                if (payload && payload.length > 0 && payload[0].payload.date) {
                                    // Use the pre-formatted date directly
                                    return payload[0].payload.date;
                                }
                                return value;
                            }}
                            formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name]} 
                            />}
              />
              <Legend wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }} />
              <Line
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 7, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2.5 }}
                name={`Price (${ticker})`}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
