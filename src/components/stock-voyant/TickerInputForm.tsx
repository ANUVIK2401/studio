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
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col sm:flex-row items-start gap-4 p-6 bg-card rounded-lg shadow-md mb-8">
        <FormField
          control={form.control}
          name="ticker"
          render={({ field }) => (
            <FormItem className="flex-grow w-full sm:w-auto">
              <FormLabel className="text-lg font-semibold">Stock Ticker</FormLabel>
              <FormControl>
                <Input 
                  placeholder="e.g., AAPL, GOOGL" 
                  {...field} 
                  className="text-base h-12"
                  aria-label="Stock Ticker Input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto h-12 mt-2 sm:mt-[calc(1.25rem+0.5rem)]"> {/* Adjust margin to align with input after label */}
          <Search className="mr-2 h-5 w-5" />
          {isLoading ? "Fetching..." : "Get Insights"}
        </Button>
      </form>
    </Form>
  );
}