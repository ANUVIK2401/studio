
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
  return numericValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}


async function fetchAlphaVantageData(ticker: string): Promise<{ data: StockData, historical: HistoricalDataPoint[] } | null> {
  if (!alphaVantage) {
    console.warn("Alpha Vantage API key not configured. Cannot fetch real stock data.");
    return null;
  }

  try {
    const [quoteResponse, overviewResponse, dailyResponse] = await Promise.allSettled([
      alphaVantage.data.quote(ticker),
      alphaVantage.company.overview(ticker),
      alphaVantage.data.daily_adjusted(ticker, 'compact', 'json', '1min')
    ]);

    // Process Quote Data
    if (quoteResponse.status === 'rejected' || !quoteResponse.value || typeof quoteResponse.value !== 'object' || !quoteResponse.value['Global Quote'] || Object.keys(quoteResponse.value['Global Quote']).length === 0) {
      const reason = quoteResponse.status === 'rejected' ? quoteResponse.reason : 'Invalid quote data structure';
      console.error(`Alpha Vantage: No quote data for ${ticker}`, reason, quoteResponse.status === 'fulfilled' ? quoteResponse.value : '');
      throw new Error(`No current quote data found for ${ticker}. It might be an invalid symbol, delisted, or an API issue (e.g., rate limit, invalid key).`);
    }
    const q = quoteResponse.value['Global Quote'];

    // Process Overview Data
    let o: any = {};
    if (overviewResponse.status === 'fulfilled' && overviewResponse.value && typeof overviewResponse.value === 'object' && overviewResponse.value.Symbol) {
      o = overviewResponse.value;
    } else {
      const reason = overviewResponse.status === 'rejected' ? overviewResponse.reason : 'Invalid overview data structure';
      const value = overviewResponse.status === 'fulfilled' ? overviewResponse.value : null;
      console.warn(`Alpha Vantage: Company overview data for ${ticker} is incomplete or unavailable. Some metrics will be N/A. Status: ${overviewResponse.status}, Reason: ${reason}, Value: ${JSON.stringify(value)}`);
      // 'o' remains {}, this is acceptable, StockData will have N/A for these fields
    }

    // Process Daily Data
    if (dailyResponse.status === 'rejected' || !dailyResponse.value || typeof dailyResponse.value !== 'object' || !dailyResponse.value['Time Series (Daily)'] || Object.keys(dailyResponse.value['Time Series (Daily)']).length === 0) {
      const reason = dailyResponse.status === 'rejected' ? dailyResponse.reason : 'Invalid historical data structure';
      console.error(`Alpha Vantage: No historical data for ${ticker}`, reason, dailyResponse.status === 'fulfilled' ? dailyResponse.value : '');
      throw new Error(`No historical price data found for ${ticker}. Check the symbol or API limits/key.`);
    }
    const timeSeries = dailyResponse.value['Time Series (Daily)'];

    const stockData: StockData = {
      ticker: o.Symbol || ticker.toUpperCase(),
      name: o.Name || `${ticker.toUpperCase()} (Name N/A)`,
      price: safeParseFloat(q['05. price']) ?? 0,
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
        if (!isValid(parseISO(date)) || typeof values !== 'object' || values === null) return null;
        return {
          date: date,
          price: safeParseFloat(values['4. close']) ?? 0,
          open: safeParseFloat(values['1. open']) ?? 0,
          high: safeParseFloat(values['2. high']) ?? 0,
          low: safeParseFloat(values['3. low']) ?? 0,
          volume: safeParseInt(values['6. volume'] || values['5. volume']) ?? 0,
        };
      })
      .filter(Boolean) as HistoricalDataPoint[];
      
    historical.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const finalHistorical = historical.slice(-365); 
      
    if (finalHistorical.length === 0 && historical.length > 0) {
        console.warn(`Historical data for ${ticker} was present but resulted in empty after slicing for 365 days. Using all available sorted data.`);
    }
    if (finalHistorical.length === 0) {
        console.warn(`No usable historical price data processed for ${ticker} after filtering and sorting.`);
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
      sortBy: 'relevancy', // 'publishedAt' might be better for "latest"
      language: 'en',
      pageSize: 15, 
    });

    if (response.status === "ok" && response.articles) {
      return response.articles
        .filter(article => article.title && article.title !== "[Removed]" && article.url && (article.content || article.description))
        .slice(0, 6)
        .map((article, index) => ({
          id: `${ticker}-news-${article.source?.id || 'api'}-${index}-${new Date(article.publishedAt || Date.now()).getTime()}`,
          title: article.title!,
          source: article.source?.name || "Unknown Source",
          articleUrl: article.url!,
          articleContent: (article.content || article.description || "No Content Available").substring(0, 25000), // Truncate for AI
          publishedAt: article.publishedAt && isValid(new Date(article.publishedAt)) ? new Date(article.publishedAt).toISOString() : new Date().toISOString(),
          imageUrl: article.urlToImage || `https://placehold.co/300x200.png?text=${encodeURIComponent(ticker)}+News`,
          sentiment: "Unknown" as Sentiment,
        }));
    } else {
      console.error("NewsAPI error:", response.message || response.code || "Unknown error");
      return MOCK_NEWS_FALLBACK[ticker.toUpperCase()] || [];
    }
  } catch (error) {
    console.error(`Failed to fetch real news for ${ticker} (${companyName}):`, error);
    return MOCK_NEWS_FALLBACK[ticker.toUpperCase()] || [];
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
      stockDetails = { 
        data: {
            ticker: upperTicker,
            name: `${upperTicker} (Mock Data - API Error/Unavailable)`,
            price: 100 + Math.random() * 50,
            change: (Math.random() - 0.5) * 10,
            changePercent: (Math.random() - 0.5) * 2,
            marketCap: "1T", 
            volume: "10M", 
            lastUpdated: new Date().toISOString(),
            peRatio: "N/A", eps: "N/A", week52High: 180, week52Low: 90, previousClose: 99, openPrice: 101, dayHigh: 102, dayLow: 98,
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
        let closestToYearAgo = sortedHistorical.find(p => isValid(parseISO(p.date)) && parseISO(p.date) <= oneYearAgoDate);
        if (!closestToYearAgo && sortedHistorical.length > 0) closestToYearAgo = sortedHistorical[0];

        yearStartPrice = closestToYearAgo?.price;
        yearEndPrice = sortedHistorical[sortedHistorical.length - 1]?.price; 
        
        const relevantHistoricalData = sortedHistorical.filter(p => isValid(parseISO(p.date)) && differenceInDays(new Date(), parseISO(p.date)) <= 365 && p.price !== undefined && !isNaN(p.price));
        if (relevantHistoricalData.length > 0) {
            yearHigh = Math.max(...relevantHistoricalData.map(p => p.price));
            yearLow = Math.min(...relevantHistoricalData.map(p => p.price));
        } else if (sortedHistorical.length > 0) { // Fallback if no data within last 365 days but some historical data exists
            const allPrices = sortedHistorical.map(p => p.price).filter(p => p !== undefined && !isNaN(p)) as number[];
            if(allPrices.length > 0) {
                yearHigh = Math.max(...allPrices);
                yearLow = Math.min(...allPrices);
            }
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
    const articleProcessingResults = await Promise.allSettled(
        fetchedNewsArticles.slice(0, 6).map(async (article) => {
            let summarizedArticle = { ...article, summary: "AI summary currently unavailable.", sentiment: "Unknown" as Sentiment };
            try {
                const contentForSummary = article.articleContent ? article.articleContent.substring(0, 15000) : "";
                const contentForSentiment = article.articleContent ? article.articleContent.substring(0, 5000) : "";

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
    let displayErrorMessage = `An unexpected error occurred while fetching data for ${upperTicker}. Please try again.`;
    
    if (error instanceof Error) {
      if (error.message && error.message.toLowerCase().includes("cannot read properties of undefined (reading 'overview')")) {
        displayErrorMessage = `Failed to retrieve company overview from Alpha Vantage for ${upperTicker}. This often indicates an issue with the Alpha Vantage API key (e.g., invalid, expired, or daily limit exceeded for overview data) or an unsupported ticker for this specific data point. Please check your API key and try again later.`;
      } else if (error.message && (error.message.includes("higher FREQUENCY") || error.message.toLowerCase().includes("api call frequency"))) {
        displayErrorMessage = `Alpha Vantage API rate limit hit for ${upperTicker}. Please wait and try again. (The free tier is limited to 25 requests per day).`;
      } else if (error.message && error.message.includes("Invalid API call") && error.message.includes("premium endpoint")) {
        displayErrorMessage = `Alpha Vantage API error for ${upperTicker}: This might be a premium endpoint or an issue with the symbol. Please check your API plan and symbol.`;
      } else if (error.message && (error.message.includes("No current quote data found") || error.message.includes("No historical price data found"))) {
        displayErrorMessage = error.message; // Use these specific messages
      } else {
        displayErrorMessage = error.message; // Default to the error's message if more specific
      }
    } else if (typeof error === 'string') {
      displayErrorMessage = error;
    }
    
    return { error: displayErrorMessage };
  }
}
