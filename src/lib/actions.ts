
"use server";

import type { StockVoyantData, ServerActionResponse, NewsArticle, StockData, HistoricalDataPoint, Sentiment } from "./types";
import { summarizeNewsArticle } from "@/ai/flows/summarize-news-article";
import { generateFinancialSummary, type GenerateFinancialSummaryInput } from "@/ai/flows/generate-financial-summary-flow";
import { analyzeNewsSentiment } from "@/ai/flows/analyze-news-sentiment-flow";
import { subDays, parseISO, formatISO, differenceInDays, subYears, startOfDay, isValid } from 'date-fns';
import NewsAPI from 'newsapi';
import alpha from 'alphavantage';

const newsapi = process.env.NEWSAPI_KEY ? new NewsAPI(process.env.NEWSAPI_KEY) : null;
const alphaVantage = process.env.ALPHA_VANTAGE_API_KEY ? alpha({ key: process.env.ALPHA_VANTAGE_API_KEY }) : null;

// Helper to safely parse float, returning undefined if NaN
function safeParseFloat(value: any): number | undefined {
  if (value === null || value === undefined || typeof value === 'string' && (value.trim() === "" || value.toLowerCase() === "n/a" || value.toLowerCase() === "none")) {
    return undefined;
  }
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

// Helper to safely parse int, returning undefined if NaN
function safeParseInt(value: any): number | undefined {
  if (value === null || value === undefined || typeof value === 'string' && (value.trim() === "" || value.toLowerCase() === "n/a" || value.toLowerCase() === "none")) {
    return undefined;
  }
  const num = parseInt(value, 10);
  return isNaN(num) ? undefined : num;
}


// Helper to format large numbers (Market Cap, Volume)
function formatLargeNumber(num: number | string | undefined): string {
  if (num === undefined || num === null) return "N/A";
  const numericValue = typeof num === 'string' ? safeParseFloat(num) : num;
  if (numericValue === undefined || isNaN(numericValue)) return "N/A";

  if (Math.abs(numericValue) >= 1e12) {
    return (numericValue / 1e12).toFixed(2) + "T";
  }
  if (Math.abs(numericValue) >= 1e9) {
    return (numericValue / 1e9).toFixed(2) + "B";
  }
  if (Math.abs(numericValue) >= 1e6) {
    return (numericValue / 1e6).toFixed(2) + "M";
  }
  // Removed K for clearer large number distinction, adjust if K is desired for smaller large numbers
  return numericValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }); // Format with commas
}


async function fetchAlphaVantageData(ticker: string): Promise<{ data: StockData, historical: HistoricalDataPoint[] } | null> {
  if (!alphaVantage) {
    console.warn("Alpha Vantage API key not configured. Cannot fetch real stock data.");
    return null;
  }

  try {
    // Fetch all data concurrently
    const [quoteResponse, overviewResponse, dailyResponse] = await Promise.allSettled([
      alphaVantage.data.quote(ticker),
      alphaVantage.company.overview(ticker),
      alphaVantage.data.daily_adjusted(ticker, 'compact', 'json', '1min')
    ]);

    // Process Quote Data
    if (quoteResponse.status === 'rejected' || !quoteResponse.value || !quoteResponse.value['Global Quote'] || Object.keys(quoteResponse.value['Global Quote']).length === 0) {
      console.error(`Alpha Vantage: No quote data for ${ticker}`, quoteResponse.status === 'rejected' ? quoteResponse.reason : quoteResponse.value);
      throw new Error(`No current quote data found for ${ticker}. It might be an invalid symbol, delisted, or an API issue.`);
    }
    const q = quoteResponse.value['Global Quote'];

    // Process Overview Data (optional, can proceed without it)
    let o: any = {};
    if (overviewResponse.status === 'fulfilled' && overviewResponse.value && overviewResponse.value.Symbol) {
      o = overviewResponse.value;
    } else {
      console.warn(`Alpha Vantage: No complete overview data for ${ticker}. Some metrics will be N/A.`, overviewResponse.status === 'rejected' ? overviewResponse.reason : overviewResponse.value);
    }

    // Process Daily Data
    if (dailyResponse.status === 'rejected' || !dailyResponse.value || !dailyResponse.value['Time Series (Daily)'] || Object.keys(dailyResponse.value['Time Series (Daily)']).length === 0) {
      console.error(`Alpha Vantage: No historical data for ${ticker}`, dailyResponse.status === 'rejected' ? dailyResponse.reason : dailyResponse.value);
      throw new Error(`No historical price data found for ${ticker}. Check the symbol or API limits.`);
    }
    const timeSeries = dailyResponse.value['Time Series (Daily)'];

    const stockData: StockData = {
      ticker: o.Symbol || ticker.toUpperCase(),
      name: o.Name || `${ticker.toUpperCase()} (Name N/A)`,
      price: safeParseFloat(q['05. price']) ?? 0, // Default to 0 if undefined, consider better handling
      change: safeParseFloat(q['09. change']) ?? 0,
      changePercent: safeParseFloat(q['10. change percent']?.replace('%', '')) ?? 0,
      marketCap: formatLargeNumber(o.MarketCapitalization),
      volume: formatLargeNumber(q['06. volume']),
      peRatio: o.PERatio === "None" || !o.PERatio || isNaN(parseFloat(o.PERatio)) ? "N/A" : safeParseFloat(o.PERatio),
      eps: o.EPS === "None" || !o.EPS || isNaN(parseFloat(o.EPS)) ? "N/A" : safeParseFloat(o.EPS),
      week52High: safeParseFloat(o['52WeekHigh']),
      week52Low: safeParseFloat(o['52WeekLow']),
      lastUpdated: q['07. latest trading day'] && isValid(new Date(q['07. latest trading day'])) ? new Date(q['07. latest trading day']).toISOString() : new Date().toISOString(),
      previousClose: safeParseFloat(q['08. previous close']),
      openPrice: safeParseFloat(q['02. open']),
      dayHigh: safeParseFloat(q['03. high']),
      dayLow: safeParseFloat(q['04. low']),
    };

    const historical: HistoricalDataPoint[] = Object.entries(timeSeries)
      .map(([date, values]: [string, any]) => {
        if (!isValid(parseISO(date))) return null; // Skip invalid dates
        return {
          date: date,
          price: safeParseFloat(values['4. close']) ?? 0, // Default to 0 if parsing fails
          open: safeParseFloat(values['1. open']) ?? 0,
          high: safeParseFloat(values['2. high']) ?? 0,
          low: safeParseFloat(values['3. low']) ?? 0,
          volume: safeParseInt(values['6. volume'] || values['5. volume']) ?? 0,
        };
      })
      .filter(Boolean) as HistoricalDataPoint[]; // Remove nulls
      
    historical.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Ensure ascending order
    const finalHistorical = historical.slice(-365); 
      
    if (finalHistorical.length === 0 && historical.length > 0) { // If slicing results in empty but original had data
        console.warn(`Historical data for ${ticker} was present but resulted in empty after slicing for 365 days. Using all available sorted data.`);
        // Potentially use 'historical' directly if this case is problematic, or adjust slicing logic
    }
    if (finalHistorical.length === 0) {
        console.warn(`No usable historical price data processed for ${ticker} after filtering and sorting.`);
        // Decide if this should be a hard error or proceed with empty historical array
        // For now, we allow proceeding, chart component will handle empty state.
    }

    return { data: stockData, historical: finalHistorical };

  } catch (error) {
    console.error(`Error fetching data from Alpha Vantage for ${ticker}:`, error);
    let errorMessage = `Failed to fetch data from Alpha Vantage for ${ticker}.`;
    if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes("Invalid API call") && error.message.includes("premium endpoint")) {
            errorMessage = `Alpha Vantage API error for ${ticker}: This might be a premium endpoint or an issue with the symbol. Please check your API plan and symbol.`;
        } else if (error.message.includes("higher FREQUENCY") || error.message.toLowerCase().includes("api call frequency")) {
            errorMessage = `Alpha Vantage API rate limit hit for ${ticker}. Please wait and try again. (Free tier is limited).`;
        }
    }
    throw new Error(errorMessage);
  }
}


async function fetchRealNews(companyName: string, ticker: string): Promise<NewsArticle[]> {
  if (!newsapi) {
    console.warn("NewsAPI key not configured. Serving mock news for development.");
    return MOCK_NEWS_FALLBACK[ticker.toUpperCase()] || [];
  }

  try {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const response = await newsapi.v2.everything({
      q: `"${companyName}" OR ${ticker} stock`,
      from: formatISO(thirtyDaysAgo, { representation: 'date' }),
      sortBy: 'relevancy',
      language: 'en',
      pageSize: 15, // Fetch more initially, then slice
    });

    if (response.status === "ok" && response.articles) {
      return response.articles
        .filter(article => article.title && article.title !== "[Removed]" && article.url && article.content) // Ensure basic fields exist
        .slice(0, 6) // Limit to 6 articles for display/processing
        .map((article, index) => ({
          id: `${ticker}-news-${article.source?.id || 'api'}-${index}-${new Date(article.publishedAt || Date.now()).getTime()}`, // More unique ID
          title: article.title!, // We filtered for this
          source: article.source?.name || "Unknown Source",
          articleUrl: article.url!, // We filtered for this
          articleContent: article.content! || article.description || "No Content Available", // Prioritize content
          publishedAt: article.publishedAt && isValid(new Date(article.publishedAt)) ? new Date(article.publishedAt).toISOString() : new Date().toISOString(),
          imageUrl: article.urlToImage || `https://placehold.co/300x200.png?text=${encodeURIComponent(ticker)}+News`,
          sentiment: "Unknown" as Sentiment,
        }));
    } else {
      console.error("NewsAPI error:", response);
      return MOCK_NEWS_FALLBACK[ticker.toUpperCase()] || [];
    }
  } catch (error) {
    console.error(`Failed to fetch real news for ${ticker} (${companyName}):`, error);
    return MOCK_NEWS_FALLBACK[ticker.toUpperCase()] || []; // Fallback on any error
  }
}

const MOCK_NEWS_FALLBACK: Record<string, NewsArticle[]> = {
  "AAPL": [
    { id: "aapl-mock-1", title: "Mock Apple News: Vision Pro Updates", source: "MockSource", articleUrl: "#", articleContent: "Mock content about Apple Vision Pro.", publishedAt: subDays(new Date(), 2).toISOString(), imageUrl: "https://placehold.co/600x400.png", sentiment: "Neutral" },
    { id: "aapl-mock-2", title: "Mock: iPhone 17 Speculations", source: "MockSource", articleUrl: "#", articleContent: "Mock content about iPhone 17.", publishedAt: subDays(new Date(), 5).toISOString(), imageUrl: "https://placehold.co/600x400.png", sentiment: "Positive" },
  ],
  "GOOGL": [
    { id: "googl-mock-1", title: "Mock Google AI Advancements", source: "MockSource", articleUrl: "#", articleContent: "Mock content about Google AI.", publishedAt: subDays(new Date(), 3).toISOString(), imageUrl: "https://placehold.co/600x400.png", sentiment: "Positive" },
  ],
  "MSFT": [
    { id: "msft-mock-1", title: "Mock Microsoft Cloud Growth", source: "MockSource", articleUrl: "#", articleContent: "Mock content about Microsoft Cloud.", publishedAt: subDays(new Date(), 4).toISOString(), imageUrl: "https://placehold.co/600x400.png", sentiment: "Positive" },
  ]
};
const SUPPORTED_TICKERS_FOR_FALLBACK = ["AAPL", "GOOGL", "MSFT"];

export async function fetchStockDataAndNews(ticker: string): Promise<ServerActionResponse> {
  const upperTicker = ticker.toUpperCase();

  try {
    let stockDetails;
    if (alphaVantage) {
        stockDetails = await fetchAlphaVantageData(upperTicker);
    } else {
      console.warn("Alpha Vantage API not configured. Trying fallback mock data.");
    }

    if (!stockDetails) {
      console.warn(`Falling back to basic mock data for ${upperTicker} as AlphaVantage data is unavailable or API is not configured.`);
      if (!SUPPORTED_TICKERS_FOR_FALLBACK.includes(upperTicker)) {
        return { error: `Ticker ${upperTicker} not supported with current AlphaVantage fallback. Try AAPL, GOOGL, or MSFT if main API fails.` };
      }
      stockDetails = { // Minimal mock structure
        data: {
            ticker: upperTicker,
            name: `${upperTicker} (Mock Data - API Error)`,
            price: 100 + Math.random() * 50,
            change: (Math.random() - 0.5) * 10,
            changePercent: (Math.random() - 0.5) * 2,
            marketCap: "1T", // Mock formatted
            volume: "10M", // Mock formatted
            lastUpdated: new Date().toISOString(),
            peRatio: "N/A", eps: "N/A" // Add all fields from StockData type
        },
        historical: Array.from({ length: 30 }, (_, i) => {
            const date = subDays(new Date(), 30 - 1 - i);
            const price = 100 + Math.sin(i / 5) * 10 + Math.random() * 5;
            return {
                date: date.toISOString().split('T')[0],
                price: parseFloat(price.toFixed(2)),
                open: parseFloat((price - Math.random()).toFixed(2)),
                high: parseFloat((price + Math.random()*2).toFixed(2)),
                low: parseFloat((price - Math.random()*2).toFixed(2)),
                volume: Math.floor(1000000 + Math.random() * 500000),
            };
        })
      };
    }

    const fetchedNewsArticles = await fetchRealNews(stockDetails.data.name, upperTicker);

    const recentNewsForSummaryInput = fetchedNewsArticles
      .filter(article => {
          if (!article.publishedAt) return false;
          const articleDate = parseISO(article.publishedAt);
          return isValid(articleDate) && differenceInDays(new Date(), articleDate) <= 30;
      })
      .map(article => ({
        title: article.title,
        articleContent: article.articleContent,
        publishedAt: article.publishedAt,
        source: article.source,
    }));

    let yearStartPrice, yearEndPrice, yearHigh, yearLow;
    if (stockDetails.historical && stockDetails.historical.length > 0) {
        const sortedHistorical = [...stockDetails.historical].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const oneYearAgoDate = startOfDay(subYears(new Date(), 1));
        let closestToYearAgo = sortedHistorical.find(p => parseISO(p.date) <= oneYearAgoDate);
        if (!closestToYearAgo && sortedHistorical.length > 0) closestToYearAgo = sortedHistorical[0]; // Fallback to earliest if all data is within 1 year

        yearStartPrice = closestToYearAgo?.price;
        yearEndPrice = sortedHistorical[sortedHistorical.length - 1]?.price; 
        
        const relevantHistoricalData = sortedHistorical.filter(p => isValid(parseISO(p.date)) && differenceInDays(new Date(), parseISO(p.date)) <= 365);
        if (relevantHistoricalData.length > 0) {
            yearHigh = Math.max(...relevantHistoricalData.map(p => p.price).filter(p => p !== undefined && !isNaN(p) ) as number[]);
            yearLow = Math.min(...relevantHistoricalData.map(p => p.price).filter(p => p !== undefined && !isNaN(p) ) as number[]);
        } else if (sortedHistorical.length > 0) {
            yearHigh = Math.max(...sortedHistorical.map(p => p.price).filter(p => p !== undefined && !isNaN(p)) as number[]);
            yearLow = Math.min(...sortedHistorical.map(p => p.price).filter(p => p !== undefined && !isNaN(p)) as number[]);
        }
    }
    
    let financialSummaryText = "Financial summary based on recent news and performance is currently unavailable.";
    if (recentNewsForSummaryInput.length > 0 || (yearStartPrice !== undefined && yearEndPrice !== undefined && yearHigh !== undefined && yearLow !== undefined )) {
        try {
            const summaryResult = await generateFinancialSummary({
                stockTicker: upperTicker,
                companyName: stockDetails.data.name,
                newsArticles: recentNewsForSummaryInput,
                yearStartPrice,
                yearEndPrice,
                yearHigh,
                yearLow,
            });
            financialSummaryText = summaryResult.summary;
        } catch (genSummaryError: any) {
            console.error(`Failed to generate financial summary for ${upperTicker}:`, genSummaryError);
            financialSummaryText = `AI financial summary could not be generated: ${genSummaryError.message || "Underlying AI model error."}`;
        }
    } else {
        financialSummaryText = `Insufficient data (news or historical performance) for ${upperTicker} to generate a financial summary.`;
    }

    const processedArticlesForDisplay: NewsArticle[] = [];
    // Use Promise.allSettled to ensure all articles are processed even if some fail
    const articleProcessingResults = await Promise.allSettled(
        fetchedNewsArticles.slice(0, 6).map(async (article) => {
            let summarizedArticle = { ...article, summary: "AI summary currently unavailable.", sentiment: "Unknown" as Sentiment };
            try {
                const contentForSummary = article.articleContent ? article.articleContent.substring(0, 15000) : ""; // Increased limit, ensure content exists
                const contentForSentiment = article.articleContent ? article.articleContent.substring(0, 5000) : ""; // Ensure content exists

                const [summaryResult, sentimentResult] = await Promise.allSettled([
                    summarizeNewsArticle({
                        articleTitle: article.title,
                        articleUrl: article.articleUrl,
                        articleContent: contentForSummary, 
                        stockTicker: upperTicker,
                    }),
                    analyzeNewsSentiment({ articleContent: contentForSentiment }) 
                ]);

                if (summaryResult.status === 'fulfilled' && summaryResult.value) {
                    summarizedArticle.summary = summaryResult.value.summary;
                } else if (summaryResult.status === 'rejected') {
                    console.error(`Error summarizing article "${article.title}":`, summaryResult.reason);
                }

                if (sentimentResult.status === 'fulfilled' && sentimentResult.value) {
                    summarizedArticle.sentiment = sentimentResult.value.sentiment;
                } else if (sentimentResult.status === 'rejected') {
                    console.error(`Error analyzing sentiment for article "${article.title}":`, sentimentResult.reason);
                }
            } catch (processingError) {
                console.error(`General error processing article "${article.title}":`, processingError);
            }
            return summarizedArticle;
        })
    );

    processedArticlesForDisplay.push(
      ...articleProcessingResults
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<NewsArticle>).value)
    );
    
    const responseData: StockVoyantData = {
      stockData: stockDetails.data,
      historicalData: stockDetails.historical,
      newsArticles: processedArticlesForDisplay, 
      financialSummary: financialSummaryText,
    };

    return { data: responseData };

  } catch (error: any) {
    console.error(`Critical error in fetchStockDataAndNews for ${upperTicker}:`, error);
    let errorMessage = `An unexpected error occurred while fetching data for ${upperTicker}. Please try again.`;
    if (error instanceof Error) {
        errorMessage = error.message; // Use the error message directly as it might be specific from AlphaVantage
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    
    // Redundant Alpha Vantage specific checks (already inside fetchAlphaVantageData), but as a final catch-all
    if (typeof errorMessage === 'string') {
        if (errorMessage.includes("Our standard API call frequency is 5 calls per minute and 100 calls per day") || errorMessage.includes("higher FREQUENCY")) {
            errorMessage = `Alpha Vantage API rate limit hit for ${upperTicker}. Please wait and try again or consider a premium plan for higher limits. (Free tier is limited).`;
        } else if (errorMessage.includes("Invalid API call") && errorMessage.includes("premium endpoint")) {
            errorMessage = `Alpha Vantage API error for ${upperTicker}: This might be a premium endpoint or an issue with the symbol. Please check your API plan and symbol.`;
        } else if (errorMessage.includes("No current quote data found") || errorMessage.includes("No historical price data found")) {
            // Keep these more specific messages.
        }
    }

    return { error: errorMessage };
  }
}

    