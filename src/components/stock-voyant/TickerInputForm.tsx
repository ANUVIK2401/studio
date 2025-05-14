
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const formSchema = z.object({
  ticker: z.string()
    .min(1, { message: "Ticker symbol is required." })
    .max(7, { message: "Ticker symbol must be 1-7 characters." })
    .regex(/^[A-Z0-9.-]+$/, { message: "Invalid ticker format. Use uppercase letters, numbers, dots, or hyphens." })
    .transform(value => value.toUpperCase()),
});

type TickerFormValues = z.infer<typeof formSchema>;

interface TickerInputFormProps {
  onSubmit: (ticker: string) => void;
  isLoading: boolean;
}

export function TickerInputForm({ onSubmit, isLoading }: TickerInputFormProps) {
  const form = useForm<TickerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ticker: "",
    },
  });

  const handleSubmit = (values: TickerFormValues) => {
    onSubmit(values.ticker);
  };

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(handleSubmit)} 
        className="flex flex-col sm:flex-row items-start gap-4 p-6 bg-card/80 backdrop-blur-sm rounded-lg shadow-xl mb-8 max-w-2xl mx-auto"
      >
        <FormField
          control={form.control}
          name="ticker"
          render={({ field }) => (
            <FormItem className="flex-grow w-full sm:w-auto">
              <FormLabel className="text-base font-semibold text-foreground/90">Stock Ticker</FormLabel> {/* Reduced size */}
              <FormControl>
                <Input 
                  placeholder="e.g., AAPL, GOOGL, MSFT" 
                  {...field} 
                  className="text-sm h-11 bg-background/70 focus:bg-background" /* Reduced text size, adjusted height */
                  aria-label="Stock Ticker Input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto h-11 mt-2 sm:mt-[calc(1rem+0.75rem)] text-sm"> {/* Adjusted margin & size */}
          <Search className="mr-2 h-4 w-4" /> {/* Reduced icon size */}
          {isLoading ? "Fetching..." : "Get Insights"}
        </Button>
      </form>
    </Form>
  );
}
