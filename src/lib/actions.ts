
"use server";

import type { StockVoyantData, ServerActionResponse, NewsArticle, StockData, HistoricalDataPoint, Sentiment } from "./types";
import { summarizeNewsArticle } from "@/ai/flows/summarize-news-article";
import { generateFinancialSummary, type GenerateFinancialSummaryInput } from "@/ai/flows/generate-financial-summary-flow";
import { analyzeNewsSentiment } from "@/ai/flows/analyze-news-sentiment-flow";
import { subDays, parseISO, formatISO, differenceInDays, subYears, startOfDay, isValid } from 'date-fns';
import NewsAPI from 'newsapi';
import alpha from 'alphavantage'; // Renamed to avoid conflict

const newsapi = process.env.NEWSAPI_KEY ? new NewsAPI(process.env.NEWSAPI_KEY) : null;
const alphaVantage = process.env.ALPHA_VANTAGE_API_KEY ? alpha({ key: process.env.ALPHA_VANTAGE_API_KEY }) : null;

// Helper to format large numbers (Market Cap, Volume)
function formatLargeNumber(num: number | string | undefined): string {
  if (num === undefined || num === null || num === "N/A" || num === "None") return "N/A";
  const numericValue = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(numericValue)) return "N/A";

  if (numericValue >= 1e12) {
    return (numericValue / 1e12).toFixed(2) + "T";
  }
  if (numericValue >= 1e9) {
    return (numericValue / 1e9).toFixed(2) + "B";
  }
  if (numericValue >= 1e6) {
    return (numericValue / 1e6).toFixed(2) + "M";
  }
  if (numericValue >= 1e3) {
    return (numericValue / 1e3).toFixed(2) + "K";
  }
  return numericValue.toString();
}


async function fetchAlphaVantageData(ticker: string): Promise<{ data: StockData, historical: HistoricalDataPoint[] } | null> {
  if (!alphaVantage) {
    console.warn("Alpha Vantage API key not configured. Cannot fetch real stock data.");
    return null; // Or fallback to mock data if preferred for dev without key
  }

  try {
    const [quoteData, overviewData, dailyData] = await Promise.all([
      alphaVantage.data.quote(ticker),
      alphaVantage.company.overview(ticker),
      alphaVantage.data.daily_adjusted(ticker, 'compact', 'json', '1min') // Compact for last 100 data points
    ]);

    // Validate required data
    if (!quoteData || !quoteData['Global Quote'] || Object.keys(quoteData['Global Quote']).length === 0) {
      console.error(`Alpha Vantage: No quote data for ${ticker}`, quoteData);
      throw new Error(`No current quote data found for ${ticker}. It might be an invalid symbol or delisted.`);
    }
    if (!overviewData || !overviewData.Symbol) {
      console.error(`Alpha Vantage: No overview data for ${ticker}`, overviewData);
      // Allow proceeding without overview, some metrics will be N/A
    }
     if (!dailyData || !dailyData['Time Series (Daily)'] || Object.keys(dailyData['Time Series (Daily)']).length === 0) {
      console.error(`Alpha Vantage: No historical data for ${ticker}`, dailyData);
      throw new Error(`No historical price data found for ${ticker}.`);
    }


    const q = quoteData['Global Quote'];
    const o = overviewData || {};


    const stockData: StockData = {
      ticker: o.Symbol || ticker.toUpperCase(),
      name: o.Name || `${ticker.toUpperCase()} (Name N/A)`,
      price: parseFloat(q['05. price']),
      change: parseFloat(q['09. change']),
      changePercent: parseFloat(q['10. change percent']?.replace('%', '')),
      marketCap: formatLargeNumber(o.MarketCapitalization),
      volume: formatLargeNumber(q['06. volume']),
      peRatio: o.PERatio === "None" || !o.PERatio ? "N/A" : parseFloat(o.PERatio),
      eps: o.EPS === "None" || !o.EPS ? "N/A" : parseFloat(o.EPS),
      week52High: o['52WeekHigh'] ? parseFloat(o['52WeekHigh']) : undefined,
      week52Low: o['52WeekLow'] ? parseFloat(o['52WeekLow']) : undefined,
      lastUpdated: q['07. latest trading day'] ? new Date(q['07. latest trading day']).toISOString() : new Date().toISOString(),
      previousClose: q['08. previous close'] ? parseFloat(q['08. previous close']) : undefined,
      openPrice: q['02. open'] ? parseFloat(q['02. open']) : undefined,
      dayHigh: q['03. high'] ? parseFloat(q['03. high']) : undefined,
      dayLow: q['04. low'] ? parseFloat(q['04. low']) : undefined,
    };

    const timeSeries = dailyData['Time Series (Daily)'];
    const historical: HistoricalDataPoint[] = Object.entries(timeSeries)
      .map(([date, values]: [string, any]) => ({
        date: date,
        price: parseFloat(values['4. close']),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        volume: parseInt(values['6. volume'] || values['5. volume']), // Adjusted has '6. volume', non-adjusted '5. volume'
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Ensure ascending order
      .slice(-365); // Get up to the last 365 days (approx 1 year)
      
    if (historical.length === 0) {
        throw new Error(`No usable historical price data processed for ${ticker}.`);
    }


    return { data: stockData, historical };

  } catch (error) {
    console.error(`Error fetching data from Alpha Vantage for ${ticker}:`, error);
    if (error instanceof Error && error.message.includes("Invalid API call") && error.message.includes("premium endpoint")) {
         throw new Error(`Alpha Vantage API error for ${ticker}: This might be a premium endpoint or an issue with the symbol. Please check your API plan and symbol.`);
    }
    if (error instanceof Error && error.message.includes("higher FREQUENCY")) {
         throw new Error(`Alpha Vantage API rate limit hit for ${ticker}. Please wait and try again. (Free tier is limited to 25 requests/day).`);
    }
    throw error; // Re-throw other errors to be caught by the main handler
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
      sortBy: 'relevancy', // 'publishedAt' or 'relevancy'
      language: 'en',
      pageSize: 15,
    });

    if (response.status === "ok") {
      return response.articles
        .filter(article => article.title && article.title !== "[Removed]") // Filter out removed articles
        .slice(0, 6)
        .map((article, index) => ({
          id: `${ticker}-news-${article.source?.id || 'api'}-${index}`,
          title: article.title || "No Title",
          source: article.source?.name || "Unknown Source",
          articleUrl: article.url || "#",
          articleContent: article.content || article.description || "No Content Available",
          publishedAt: article.publishedAt ? new Date(article.publishedAt).toISOString() : new Date().toISOString(),
          imageUrl: article.urlToImage || `https://placehold.co/300x200.png?text=${encodeURIComponent(ticker)}+News`,
          sentiment: "Unknown" as Sentiment,
        }));
    } else {
      console.error("NewsAPI error:", response);
      return MOCK_NEWS_FALLBACK[ticker.toUpperCase()] || [];
    }
  } catch (error) {
    console.error("Failed to fetch real news:", error);
    return MOCK_NEWS_FALLBACK[ticker.toUpperCase()] || [];
  }
}

// Fallback mock news data if APIs are not available
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
const SUPPORTED_TICKERS_FOR_FALLBACK = ["AAPL", "GOOGL", "MSFT"]; // Used if AlphaVantage fails completely

export async function fetchStockDataAndNews(ticker: string): Promise<ServerActionResponse> {
  const upperTicker = ticker.toUpperCase();

  try {
    let stockDetails;
    if (alphaVantage) {
        stockDetails = await fetchAlphaVantageData(upperTicker);
    }

    if (!stockDetails) {
      // Fallback to minimal mock data if AlphaVantage fails or is not configured
      // This is to allow the rest of the app (news, AI summary) to potentially still work with mock.
      console.warn(`Falling back to basic mock data for ${upperTicker} as AlphaVantage data is unavailable.`);
      if (!SUPPORTED_TICKERS_FOR_FALLBACK.includes(upperTicker)) {
        return { error: `Ticker ${upperTicker} not supported with current AlphaVantage fallback. Try AAPL, GOOGL, MSFT.` };
      }
      stockDetails = {
        data: {
            ticker: upperTicker,
            name: `${upperTicker} (Mock Data)`,
            price: 100 + Math.random() * 50,
            change: (Math.random() - 0.5) * 10,
            changePercent: (Math.random() - 0.5) * 2,
            marketCap: "1T",
            volume: "10M",
            lastUpdated: new Date().toISOString(),
        },
        historical: Array.from({ length: 30 }, (_, i) => { // Shorter mock historical
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
        let closestToYearAgo = sortedHistorical[0];
        for(const point of sortedHistorical) {
            if(parseISO(point.date) <= oneYearAgoDate) { // Find the latest point on or before 1 year ago
                closestToYearAgo = point;
            } else {
                // If current point is after 1 year ago, and previous was before/on, then previous is best.
                // If all points are after 1 year ago, the first point is taken.
                break; 
            }
        }
        yearStartPrice = closestToYearAgo?.price;
        yearEndPrice = sortedHistorical[sortedHistorical.length - 1]?.price; 
        
        const relevantHistoricalData = sortedHistorical.filter(p => isValid(parseISO(p.date)) && differenceInDays(new Date(), parseISO(p.date)) <= 365);
        if (relevantHistoricalData.length > 0) {
            yearHigh = Math.max(...relevantHistoricalData.map(p => p.price));
            yearLow = Math.min(...relevantHistoricalData.map(p => p.price));
        } else if (sortedHistorical.length > 0) { // Fallback if no data strictly within last 365 days
            yearHigh = Math.max(...sortedHistorical.map(p => p.price));
            yearLow = Math.min(...sortedHistorical.map(p => p.price));
        }
    }
    
    let financialSummaryText = "Financial summary based on recent news and performance is currently unavailable.";
    if (recentNewsForSummaryInput.length > 0 || (yearStartPrice && yearEndPrice && yearHigh && yearLow)) {
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
        } catch (genSummaryError) {
            console.error(`Failed to generate financial summary for ${upperTicker}:`, genSummaryError);
        }
    } else {
        financialSummaryText = `Insufficient data (news or historical performance) for ${upperTicker} to generate a financial summary.`;
    }

    const processedArticlesForDisplay: NewsArticle[] = [];
    const articleProcessingPromises = fetchedNewsArticles.slice(0, 6).map(async (article) => {
      let summarizedArticle = { ...article, summary: "AI summary currently unavailable.", sentiment: "Unknown" as Sentiment };
      try {
        const contentForSummary = article.articleContent.substring(0, 4000); 
        const contentForSentiment = article.articleContent.substring(0, 1000);

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

      } catch (processingError) { // Should be caught by Promise.allSettled now
        console.error(`General error processing article "${article.title}":`, processingError);
      }
      return summarizedArticle;
    });

    processedArticlesForDisplay.push(...await Promise.all(articleProcessingPromises));
    
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
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    
    // Specific check for Alpha Vantage rate limit messages if they are strings
    if (typeof error === 'string' && error.includes("Our standard API call frequency is 5 calls per minute and 100 calls per day")) {
        errorMessage = `Alpha Vantage API rate limit hit for ${upperTicker}. Please wait and try again or consider a premium plan for higher limits. (Free tier is limited).`;
    }
     if (typeof error === 'string' && error.includes("Invalid API call") && error.includes("premium endpoint")) {
         errorMessage = `Alpha Vantage API error for ${upperTicker}: This might be a premium endpoint or an issue with the symbol. Please check your API plan and symbol.`;
    }


    return { error: errorMessage };
  }
}
