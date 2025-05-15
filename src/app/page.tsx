
"use client";

import { useState, useEffect } from "react";
import type { StockVoyantData, ServerActionResponse, NewsArticle, Sentiment } from "@/lib/types";
import { fetchStockDataAndNews } from "@/lib/actions";
import { TickerInputForm } from "@/components/stock-voyant/TickerInputForm";
import { StockMetricsCard } from "@/components/stock-voyant/StockMetricsCard";
import { HistoricalChart } from "@/components/stock-voyant/HistoricalChart";
import { LoadingState } from "@/components/shared/LoadingState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, BarChartBig, NewspaperIcon, FileText, Link as LinkIcon, Smile, Meh, Frown, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from 'date-fns';
import { cn } from "@/lib/utils";

const NewsLinkItem: React.FC<{ article: NewsArticle }> = ({ article }) => {
  const sentimentIcon = (sentiment?: Sentiment) => {
    switch (sentiment) {
      case "Positive": return <Smile className="h-3.5 w-3.5 mr-1.5 text-[hsl(var(--chart-positive))]" />;
      case "Negative": return <Frown className="h-3.5 w-3.5 mr-1.5 text-[hsl(var(--chart-negative))]" />;
      case "Neutral": return <Meh className="h-3.5 w-3.5 mr-1.5 text-yellow-400" />; // Consider theming yellow
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

  // Fallback for potentially invalid dates
  let timeAgo = "Date N/A";
  if (article.publishedAt && isValid(new Date(article.publishedAt))) {
    try {
      timeAgo = formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true });
    } catch (e) {
      console.warn("Error formatting date for news article:", article.publishedAt, e);
    }
  }


  return (
    <li className="group transition-all duration-300 ease-out hover:shadow-lg hover:scale-[1.02]"> {/* Slightly reduced scale */}
      <a
        href={article.articleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary/90 group-hover:text-accent transition-colors flex items-start p-2.5 rounded-md hover:bg-primary/10"
      >
        <LinkIcon className="h-4 w-4 mr-2.5 mt-0.5 shrink-0 text-muted-foreground group-hover:text-accent transition-colors" />
        <div className="flex-grow">
          <span className="font-semibold leading-snug text-foreground/95 group-hover:text-accent transition-colors">{article.title}</span>
          <div className="flex items-center text-xs text-muted-foreground/80 mt-1.5">
            {sentimentIcon(article.sentiment)}
            <span className={cn("mr-2 font-medium", sentimentTextClass(article.sentiment))}>
              {article.sentiment || "N/A"}
            </span>
            <span className="mr-2">&bull;</span>
            <span className="truncate max-w-[100px] sm:max-w-[120px]">{article.source}</span> {/* Adjusted max-width */}
            <span className="mx-2">&bull;</span>
            <span className="whitespace-nowrap">{timeAgo}</span>
          </div>
        </div>
      </a>
    </li>
  );
};

const mockTickersForDisplay = [
  { ticker: "AAPL", name: "Apple Inc." },
  { ticker: "GOOGL", name: "Alphabet Inc." },
  { ticker: "MSFT", name: "Microsoft Corp." },
  { ticker: "TSLA", name: "Tesla, Inc."},
  { ticker: "AMZN", name: "Amazon.com, Inc."}
];


export default function HomePage() {
  const [stockData, setStockData] = useState<StockVoyantData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const { toast } = useToast();

  const [showMetrics, setShowMetrics] = useState(false);
  const [showFinancialSummary, setShowFinancialSummary] = useState(false);

  // Effect to manage initialLoad state if needed, e.g. on component mount
  useEffect(() => {
    // Could be used to load a default ticker or set initialLoad false after first render if desired
  }, []);

  const handleTickerSubmit = async (ticker: string) => {
    setIsLoading(true);
    setError(null);
    setStockData(null); // Clear previous data immediately
    setInitialLoad(false);
    setShowMetrics(false);
    setShowFinancialSummary(false);

    const result: ServerActionResponse = await fetchStockDataAndNews(ticker);

    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      setStockData(null); // Ensure data is null on error
      toast({
        variant: "destructive",
        title: "Error Fetching Data",
        description: result.error,
        duration: 8000, // Longer duration for error messages
      });
    } else if (result.data) {
      setStockData(result.data);
      setTimeout(() => setShowMetrics(true), 100);
      setTimeout(() => setShowFinancialSummary(true), 300);
      toast({
        variant: "default",
        className: "bg-primary/10 border-primary/30 text-foreground",
        title: "Data Loaded Successfully",
        description: `Showing insights for ${result.data.stockData?.ticker || ticker}.`,
        action: <CheckCircle className="text-primary" />, 
      });
    } else {
      // Should not happen if ServerActionResponse is always {data} or {error}
      setError("Received an empty response from the server.");
      setStockData(null);
      toast({
        variant: "destructive",
        title: "Empty Response",
        description: "No data or error was returned.",
      });
    }
  };

  const currentTicker = stockData?.stockData?.ticker;
  const companyName = stockData?.stockData?.name;

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
      
      {stockData && stockData.stockData && ( // Ensure stockData.stockData exists
        <div className="space-y-16">
          <section 
            className={`transition-all duration-700 ease-out ${showMetrics ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
            style={{ transformOrigin: 'top' }}
          >
            <h2 className="text-2xl lg:text-3xl font-bold mb-8 flex items-center text-primary text-balance"><BarChartBig className="mr-3 h-7 w-7 lg:h-8 lg:w-8"/>Key Metrics &amp; Performance for {companyName} ({currentTicker})</h2>
            <StockMetricsCard data={stockData.stockData} />
            {stockData.historicalData && stockData.historicalData.length > 0 ? (
              <HistoricalChart data={stockData.historicalData} ticker={currentTicker || "Stock"} />
            ) : (
              <Card className="w-full shadow-xl mt-8 bg-card/80 backdrop-blur-sm border-border/50 card-interactive-lift">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-foreground/90">Historical Performance: {currentTicker}</CardTitle>
                  <CardContent className="h-[100px] flex items-center justify-center">
                    <p className="text-muted-foreground">No historical data available to display a chart.</p>
                  </CardContent>
                </CardHeader>
              </Card>
            )}
          </section>

          <Separator className="my-12 bg-border/30" />
          
           <section 
            className={`transition-all duration-700 ease-out delay-200 ${showFinancialSummary ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
            style={{ transformOrigin: 'top' }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-x-10 gap-y-12 items-start">
              <div className="lg:col-span-3">
                <h2 className="text-2xl lg:text-3xl font-bold mb-8 flex items-center text-primary text-balance"><FileText className="mr-3 h-7 w-7 lg:h-8 lg:w-8"/>AI Financial Analysis</h2>
                <Card className="shadow-xl bg-card/80 backdrop-blur-sm min-h-[300px] p-1 border-border/50 card-interactive-lift">
                  <CardHeader className="pb-4 pt-6 px-6">
                    <CardTitle className="text-xl lg:text-2xl font-semibold text-foreground/90">
                      Analysis for {companyName} ({currentTicker})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    {stockData.financialSummary ? (
                      <p className="text-foreground/85 whitespace-pre-line leading-relaxed text-sm lg:text-base">{stockData.financialSummary}</p>
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

              <div className="lg:col-span-1">
                <h2 className="text-xl lg:text-2xl font-semibold mb-7 flex items-center text-primary text-balance"><NewspaperIcon className="mr-2.5 h-6 w-6 lg:h-7 lg:w-7"/>Recent News</h2>
                 <Card className="shadow-lg bg-card/70 backdrop-blur-sm p-4 max-h-[470px] lg:max-h-[calc(100%_-_2.5rem)] overflow-y-auto border-border/50 card-interactive-lift">
                  {stockData.newsArticles && stockData.newsArticles.length > 0 ? (
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
        <div className="text-center py-16 animate-in fade-in duration-1000">
          <TrendingUp className="mx-auto h-20 w-20 text-muted-foreground/50 mb-6" /> {/* Adjusted size and margin */}
          <h1 className="text-3xl lg:text-4xl font-bold text-primary mb-4 text-balance">Welcome to StockVoyant</h1> {/* Adjusted margin */}
          <p className="text-base lg:text-lg text-muted-foreground mb-8 max-w-lg mx-auto text-balance"> {/* Adjusted margin */}
            Enter a stock ticker symbol above to unveil AI-powered financial insights.
          </p>
          <div className="mt-8"> {/* Adjusted margin */}
            <h3 className="text-base font-medium text-center text-muted-foreground/80 mb-5">Or try one of these examples:</h3>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-5"> {/* Adjusted gap */}
              {mockTickersForDisplay.map(stock => (
                <button
                  key={stock.ticker}
                  onClick={() => handleTickerSubmit(stock.ticker)}
                  className="bg-card/60 p-3.5 rounded-lg shadow-lg border border-border/40 w-[120px] text-center card-interactive-lift focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background" /* Adjusted padding and width */
                  aria-label={`Fetch data for ${stock.name}`}
                >
                  <span className="text-xl font-bold text-primary block">{stock.ticker}</span> {/* Adjusted size */}
                  <p className="text-xs text-muted-foreground mt-1 truncate">{stock.name}</p> {/* Adjusted margin */}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

    