
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
import { format, parse } from 'date-fns';

interface HistoricalChartProps {
  data: HistoricalDataPoint[];
  ticker: string;
}

const chartConfig = {
  price: {
    label: "Price",
    color: "hsl(var(--chart-1))", // Ensure this uses the primary color from globals.css
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
  
  // Data comes in as YYYY-MM-DD. For tooltip, we format it nicely.
  // For XAxis, we'll format it to 'MMM yy'.
  const formattedData = data.map(point => ({
    dateISO: point.date, // Keep original ISO date for reliable parsing
    dateFormatted: format(new Date(point.date + 'T00:00:00Z'), 'MMM dd, yyyy'), // For Tooltip
    price: point.price,
  }));

  return (
    <Card className="w-full shadow-xl mt-8 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-foreground/90">Historical Performance: {ticker}</CardTitle>
        <CardDescription>1 Year Price History (Mock Data)</CardDescription>
      </CardHeader>
      <CardContent className="h-[400px] p-0 pt-4 pr-4"> {/* Adjusted padding */}
        <ChartContainer config={chartConfig} className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={formattedData}
              margin={{
                top: 5,
                right: 20, // Give space for Y-axis labels if on right, or just padding
                left: 10,  // Give space for Y-axis labels
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="dateISO" // Use ISO date for dataKey for robust parsing
                tickFormatter={(isoDate) => {
                    try {
                        // Parse the ISO date string and format it
                        return format(new Date(isoDate + 'T00:00:00Z'), 'MMM yy');
                    } catch (e) {
                        return isoDate; // fallback if formatting fails
                    }
                }}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                tickLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                interval="preserveStartEnd" // Show first and last tick
                // Consider adding minTickGap or interval for denser data to avoid overlap
                minTickGap={60} 
              />
              <YAxis 
                tickFormatter={(value) => `$${value.toFixed(0)}`}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                tickLine={{ stroke: 'hsl(var(--border))', opacity: 0.7 }}
                domain={['auto', 'auto']} // Auto domain based on data
              />
              <ChartTooltip
                cursor={{stroke: 'hsl(var(--accent))', strokeWidth: 1.5, strokeDasharray: '3 3'}}
                content={<ChartTooltipContent 
                            className="bg-card/90 backdrop-blur-md shadow-xl border-border/70 rounded-lg"
                            indicator="line" 
                            labelFormatter={(value, payload) => {
                                // payload[0].payload contains the data point for the hovered item
                                if (payload && payload.length > 0 && payload[0].payload.dateFormatted) {
                                    return payload[0].payload.dateFormatted; // Use pre-formatted date for tooltip
                                }
                                return value; // Fallback
                            }}
                            formatter={(value, name, props) => {
                              // props.payload.price is the actual price for this point
                              const price = props.payload.price;
                              return [`$${Number(price).toFixed(2)}`, name];
                            }}
                            itemStyle={{ color: 'hsl(var(--chart-1))' }}
                            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                            />}
              />
              <Legend 
                wrapperStyle={{ 
                  color: 'hsl(var(--muted-foreground))', 
                  paddingTop: '10px', 
                  fontSize: '12px'
                }} 
                payload={[{ value: `Price (${ticker})`, type: 'line', id: 'price', color: 'hsl(var(--chart-1))' }]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--chart-1))" // Use variable from chartConfig or globals
                strokeWidth={2.5}
                dot={false} // No dots on the line itself for cleaner look
                activeDot={{ 
                  r: 7, 
                  fill: 'hsl(var(--primary))', 
                  stroke: 'hsl(var(--background))', // Contrast border for the dot
                  strokeWidth: 2.5,
                  cursor: 'pointer'
                }}
                name={`Price (${ticker})`} // Used by Legend and default Tooltip
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
