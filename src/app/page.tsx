"use client";

import { useState } from "react";
import type { StockVoyantData, ServerActionResponse } from "@/lib/types";
import { fetchStockDataAndNews } from "@/lib/actions";
import { TickerInputForm } from "@/components/stock-voyant/TickerInputForm";
import { StockMetricsCard } from "@/components/stock-voyant/StockMetricsCard";
import { HistoricalChart } from "@/components/stock-voyant/HistoricalChart";
import { NewsArticleCard } from "@/components/stock-voyant/NewsArticleCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, BarChartBig, NewspaperIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

export default function HomePage() {
  const [stockData, setStockData] = useState<StockVoyantData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const { toast } = useToast();

  const handleTickerSubmit = async (ticker: string) => {
    setIsLoading(true);
    setError(null);
    setStockData(null);
    setInitialLoad(false);

    const result: ServerActionResponse = await fetchStockDataAndNews(ticker);

    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      toast({
        variant: "destructive",
        title: "Error Fetching Data",
        description: result.error,
      });
    } else if (result.data) {
      setStockData(result.data);
      toast({
        variant: "default",
        className: "bg-green-500/10 border-green-500/30 text-foreground",
        title: "Data Loaded Successfully",
        description: `Showing insights for ${result.data.stockData.ticker}.`,
        action: <CheckCircle className="text-green-500" />,
      });
    }
  };

  return (
    <div className="space-y-8">
      <TickerInputForm onSubmit={handleTickerSubmit} isLoading={isLoading} />

      {isLoading && <LoadingState text="Fetching financial insights..." />}

      {error && !isLoading && (
        <Alert variant="destructive" className="max-w-2xl mx-auto bg-destructive/80 text-destructive-foreground">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && !stockData && !initialLoad && (
         <Alert className="max-w-2xl mx-auto bg-card/80 backdrop-blur-sm">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Data</AlertTitle>
          <AlertDescription>No data to display. Please enter a valid stock ticker and search.</AlertDescription>
        </Alert>
      )}
      
      {!isLoading && !error && stockData && (
        <div className="space-y-10">
          <div>
            <h2 className="text-2xl font-semibold mb-4 flex items-center text-foreground/90"><BarChartBig className="mr-2 h-7 w-7 text-primary"/>Key Metrics &amp; Performance</h2>
            <StockMetricsCard data={stockData.stockData} />
            <HistoricalChart data={stockData.historicalData} ticker={stockData.stockData.ticker} />
          </div>

          <Separator className="my-8 bg-border/50" />
          
          <div>
            <h2 className="text-2xl font-semibold mb-6 flex items-center text-foreground/90"><NewspaperIcon className="mr-2 h-7 w-7 text-primary"/>Related News</h2>
            {stockData.newsArticles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stockData.newsArticles.map((article) => (
                  <NewsArticleCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <Alert className="max-w-lg mx-auto bg-card/80 backdrop-blur-sm">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No News Articles</AlertTitle>
                <AlertDescription>No recent news articles found for this stock.</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      )}

      {initialLoad && !isLoading && (
        <div className="text-center py-10">
          <BarChartBig className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold text-foreground/90 mb-2">Welcome to StockVoyant</h2>
          <p className="text-muted-foreground">Enter a stock ticker symbol above to get started.</p>
          <p className="text-sm text-muted-foreground mt-2">Supported mock tickers: AAPL, GOOGL, MSFT</p>
        </div>
      )}
    </div>
  );
}
