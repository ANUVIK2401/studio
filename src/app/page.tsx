
"use client";

import { useState } from "react";
import type { StockVoyantData, ServerActionResponse, NewsArticle, Sentiment } from "@/lib/types";
import { fetchStockDataAndNews } from "@/lib/actions";
import { TickerInputForm } from "@/components/stock-voyant/TickerInputForm";
import { StockMetricsCard } from "@/components/stock-voyant/StockMetricsCard";
import { HistoricalChart } from "@/components/stock-voyant/HistoricalChart";
import { LoadingState } from "@/components/shared/LoadingState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, BarChartBig, NewspaperIcon, FileText, Link as LinkIcon, Smile, Meh, Frown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from 'date-fns';
import { cn } from "@/lib/utils";

// Simple component for news links with sentiment
const NewsLinkItem: React.FC<{ article: NewsArticle }> = ({ article }) => {
  const sentimentIcon = (sentiment?: Sentiment) => {
    switch (sentiment) {
      case "Positive": return <Smile className="h-3.5 w-3.5 mr-1.5 text-[hsl(var(--chart-positive))]" />;
      case "Negative": return <Frown className="h-3.5 w-3.5 mr-1.5 text-[hsl(var(--chart-negative))]" />;
      case "Neutral": return <Meh className="h-3.5 w-3.5 mr-1.5 text-yellow-400" />; // Keep yellow for neutral for distinction
      default: return <Meh className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />;
    }
  };
  
  const sentimentTextClass = (sentiment?: Sentiment) => {
    switch (sentiment) {
      case "Positive": return "text-[hsl(var(--chart-positive))]";
      case "Negative": return "text-[hsl(var(--chart-negative))]";
      case "Neutral": return "text-yellow-400";
      default: return "text-muted-foreground";
    }
  };

  return (
    <li className="group transition-all duration-300 ease-out hover:shadow-lg hover:scale-[1.03]">
      <a
        href={article.articleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary/90 group-hover:text-accent transition-colors flex items-start p-2.5 rounded-md hover:bg-primary/10"
      >
        <LinkIcon className="h-4 w-4 mr-2.5 mt-0.5 shrink-0 text-muted-foreground group-hover:text-accent transition-colors" />
        <div className="flex-grow">
          <span className="font-semibold leading-snug">{article.title}</span>
          <div className="flex items-center text-xs text-muted-foreground/80 mt-1.5">
            {sentimentIcon(article.sentiment)}
            <span className={cn("mr-2 font-medium", sentimentTextClass(article.sentiment))}>
              {article.sentiment || "N/A"}
            </span>
            <span className="mr-2">&bull;</span>
            <span className="truncate max-w-[100px] sm:max-w-[150px]">{article.source}</span>
            <span className="mx-2">&bull;</span>
            <span>{formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}</span>
          </div>
        </div>
      </a>
    </li>
  );
};


export default function HomePage() {
  const [stockData, setStockData] = useState<StockVoyantData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const { toast } = useToast();

  // For animation states
  const [showMetrics, setShowMetrics] = useState(false);
  const [showFinancialSummary, setShowFinancialSummary] = useState(false);


  const handleTickerSubmit = async (ticker: string) => {
    setIsLoading(true);
    setError(null);
    setStockData(null);
    setInitialLoad(false);
    setShowMetrics(false);
    setShowFinancialSummary(false);


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
      // Trigger animations with a slight delay for effect
      setTimeout(() => setShowMetrics(true), 100);
      setTimeout(() => setShowFinancialSummary(true), 300);
      toast({
        variant: "default",
        className: "bg-primary/10 border-primary/30 text-foreground",
        title: "Data Loaded Successfully",
        description: `Showing insights for ${result.data.stockData.ticker}.`,
        action: <CheckCircle className="text-primary" />, 
      });
    }
  };

  return (
    <div className="space-y-14">
      <TickerInputForm onSubmit={handleTickerSubmit} isLoading={isLoading} />

      {isLoading && <LoadingState text="Conjuring financial spells & analyzing market whispers..." />}

      {error && !isLoading && (
        <Alert variant="destructive" className="max-w-2xl mx-auto bg-destructive/80 text-destructive-foreground animate-in fade-in duration-500">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-semibold">Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && !stockData && !initialLoad && (
         <Alert className="max-w-2xl mx-auto bg-card/80 backdrop-blur-sm animate-in fade-in duration-500 border-border/50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="font-semibold">No Data</AlertTitle>
          <AlertDescription>No data to display. Please enter a valid stock ticker and search.</AlertDescription>
        </Alert>
      )}
      
      {stockData && (
        <div className="space-y-16">
          {/* Metrics and Chart Section */}
          <section 
            className={`transition-all duration-700 ease-out ${showMetrics ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
            style={{ transformOrigin: 'top' }}
          >
            <h2 className="text-2xl lg:text-3xl font-bold mb-8 flex items-center text-primary text-balance"><BarChartBig className="mr-3 h-7 w-7 lg:h-8 lg:w-8"/>Key Metrics &amp; Performance</h2>
            <StockMetricsCard data={stockData.stockData} />
            <HistoricalChart data={stockData.historicalData} ticker={stockData.stockData.ticker} />
          </section>

          <Separator className="my-12 bg-border/30" />
          
          {/* Financial Summary and News Links Section */}
           <section 
            className={`transition-all duration-700 ease-out delay-200 ${showFinancialSummary ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
            style={{ transformOrigin: 'top' }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-x-10 gap-y-12 items-start">
              {/* Left Column: Financial Summary */}
              <div className="lg:col-span-3">
                <h2 className="text-2xl lg:text-3xl font-bold mb-8 flex items-center text-primary text-balance"><FileText className="mr-3 h-7 w-7 lg:h-8 lg:w-8"/>AI Financial Analysis</h2>
                <Card className="shadow-xl bg-card/80 backdrop-blur-sm min-h-[300px] p-1 border-border/50 card-interactive-lift">
                  <CardHeader className="pb-4 pt-6 px-6">
                    <CardTitle className="text-xl lg:text-2xl font-semibold text-foreground/90">
                      Analysis for {stockData.stockData.name} ({stockData.stockData.ticker})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    {stockData.financialSummary ? (
                      <p className="text-foreground/85 whitespace-pre-line leading-relaxed text-base lg:text-lg">{stockData.financialSummary}</p>
                    ) : (
                       <Alert className="bg-card/80 backdrop-blur-sm border-border/50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="font-semibold">Analysis Not Available</AlertTitle>
                        <AlertDescription>The AI financial analysis could not be generated at this time.</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: News Links */}
              <div className="lg:col-span-1">
                <h2 className="text-xl lg:text-2xl font-semibold mb-7 flex items-center text-primary text-balance"><NewspaperIcon className="mr-2.5 h-6 w-6 lg:h-7 lg:w-7"/>Recent News</h2>
                 <Card className="shadow-lg bg-card/70 backdrop-blur-sm p-4 max-h-[470px] lg:max-h-[calc(100%_-_2.5rem)] overflow-y-auto border-border/50 card-interactive-lift">
                  {stockData.newsArticles.length > 0 ? (
                    <ul className="space-y-2">
                      {stockData.newsArticles.map((article) => (
                        <NewsLinkItem key={article.id} article={article} />
                      ))}
                    </ul>
                  ) : (
                    <Alert className="bg-card/80 backdrop-blur-sm text-sm border-border/50">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="font-semibold">No News</AlertTitle>
                      <AlertDescription>No recent news articles found for this stock.</AlertDescription>
                    </Alert>
                  )}
                </Card>
              </div>
            </div>
          </section>
        </div>
      )}

      {initialLoad && !isLoading && (
        <div className="text-center py-20 animate-in fade-in duration-1000">
          <BarChartBig className="mx-auto h-28 w-28 text-muted-foreground/60 mb-10" />
          <h1 className="text-4xl lg:text-5xl font-bold text-primary mb-6 text-balance">Welcome to StockVoyant</h1>
          <p className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-xl mx-auto text-balance">
            Enter a stock ticker symbol above to unveil AI-powered financial insights.
          </p>
          <p className="text-md text-muted-foreground/80">
            Supported mock tickers: <code className="font-mono bg-muted/60 px-2.5 py-1.5 rounded-md text-primary/90">AAPL</code>, <code className="font-mono bg-muted/60 px-2.5 py-1.5 rounded-md text-primary/90">GOOGL</code>, <code className="font-mono bg-muted/60 px-2.5 py-1.5 rounded-md text-primary/90">MSFT</code>
          </p>
        </div>
      )}
    </div>
  );
}
