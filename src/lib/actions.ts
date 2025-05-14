"use server";

import type { StockVoyantData, ServerActionResponse, NewsArticle, StockData, HistoricalDataPoint, Sentiment } from "./types";
import { summarizeNewsArticle } from "@/ai/flows/summarize-news-article";
import { generateFinancialSummary, type GenerateFinancialSummaryInput } from "@/ai/flows/generate-financial-summary-flow";
import { analyzeNewsSentiment } from "@/ai/flows/analyze-news-sentiment-flow";
import { subDays, parseISO, formatISO } from 'date-fns';
import NewsAPI from 'newsapi';

// Ensure NEWSAPI_KEY is loaded from .env
const newsapi = process.env.NEWSAPI_KEY ? new NewsAPI(process.env.NEWSAPI_KEY) : null;

// MOCK STOCK DATA (Real-time aspect is complex for frontend prototype)
const MOCK_STOCKS: Record<string, { data: StockData, historical: HistoricalDataPoint[] }> = {
  "AAPL": {
    data: {
      ticker: "AAPL",
      name: "Apple Inc.",
      price: 170.34,
      change: 1.23,
      changePercent: 0.72,
      marketCap: "2.62T",
      volume: "50.2M",
      peRatio: 26.5,
      eps: 6.43,
      week52High: 199.62,
      week52Low: 164.08,
      lastUpdated: new Date().toISOString(),
    },
    historical: Array.from({ length: 365 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (365 - i));
      return {
        date: date.toISOString().split('T')[0],
        price: 150 + Math.sin(i / 50) * 10 + Math.random() * 5,
      };
    }),
  },
  "GOOGL": {
    data: {
      ticker: "GOOGL",
      name: "Alphabet Inc.",
      price: 135.67,
      change: -0.50,
      changePercent: -0.37,
      marketCap: "1.70T",
      volume: "25.1M",
      peRatio: 20.8,
      eps: 6.52,
      week52High: 180.55,
      week52Low: 120.83,
      lastUpdated: new Date().toISOString(),
    },
    historical: Array.from({ length: 365 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (365 - i));
      return {
        date: date.toISOString().split('T')[0],
        price: 120 + Math.sin(i / 40) * 15 + Math.random() * 8,
      };
    }),
  },
   "MSFT": {
    data: {
      ticker: "MSFT",
      name: "Microsoft Corp.",
      price: 420.72,
      change: 2.55,
      changePercent: 0.61,
      marketCap: "3.12T",
      volume: "18.9M",
      peRatio: 37.1,
      eps: 11.34,
      week52High: 450.94,
      week52Low: 309.45,
      lastUpdated: new Date().toISOString(),
    },
    historical: Array.from({ length: 365 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (365 - i));
      return {
        date: date.toISOString().split('T')[0],
        price: 380 + Math.sin(i / 60) * 20 + Math.random() * 10,
      };
    }),
  }
};

async function mockFetchStockData(ticker: string): Promise<{ data: StockData, historical: HistoricalDataPoint[] } | null> {
  await new Promise(resolve => setTimeout(resolve, 300)); // Shorter delay for stock data
  if (MOCK_STOCKS[ticker]) {
    const stock = MOCK_STOCKS[ticker];
    // Simulate minor price fluctuation
    const priceFluctuation = (Math.random() - 0.5) * (stock.data.price * 0.005); // Max 0.5% change
    const newPrice = parseFloat((stock.data.price + priceFluctuation).toFixed(2));
    const prevClose = stock.data.price; // Use previous mock price as a pseudo previous close
    const newAbsChange = parseFloat((newPrice - prevClose).toFixed(2));
    const newChangePercent = parseFloat(((newAbsChange / prevClose) * 100).toFixed(2));
    
    return {
      data: {
        ...stock.data,
        price: newPrice,
        change: newAbsChange,
        changePercent: newChangePercent,
        lastUpdated: new Date().toISOString(),
      },
      historical: stock.historical,
    };
  }
  return null;
}

async function fetchRealNews(companyName: string, ticker: string): Promise<NewsArticle[]> {
  if (!newsapi) {
    console.warn("NewsAPI key not configured. Serving mock news for development.");
    // Fallback to mock news if API key is missing
    return (MOCK_NEWS[ticker] || []).map((item, index) => ({
        ...item,
        id: `${ticker}-news-${index + 1}`,
        imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(ticker)}+News+${index+1}`,
        sentiment: "Unknown" as Sentiment,
    })).slice(0,6);
  }

  try {
    // Fetch news for the company name, more reliable than just ticker for general news
    // NewsAPI 'q' parameter can be company name or ticker. Using company name might yield broader results.
    // Sorting by relevancy or publishedAt might be good. NewsAPI defaults to publishedAt for 'everything'.
    const thirtyDaysAgo = subDays(new Date(), 30);
    const response = await newsapi.v2.everything({
      q: `"${companyName}" OR ${ticker}`, // Search for company name or ticker
      from: formatISO(thirtyDaysAgo, { representation: 'date' }), // Search from 30 days ago
      sortBy: 'relevancy', // Sort by relevancy, then publishedAt if relevancy is same
      language: 'en',
      pageSize: 15, // Fetch a bit more to allow filtering for quality/relevance if needed
    });

    if (response.status === "ok") {
      return response.articles
        .slice(0, 6) // Take top 5-6 articles
        .map((article, index) => ({
          id: `${ticker}-news-${article.source?.id || 'api'}-${index}`,
          title: article.title || "No Title",
          source: article.source?.name || "Unknown Source",
          articleUrl: article.url || "#",
          articleContent: article.content || article.description || "No Content Available",
          publishedAt: article.publishedAt || new Date().toISOString(),
          imageUrl: article.urlToImage || `https://placehold.co/300x200.png?text=${encodeURIComponent(ticker)}+News`,
          sentiment: "Unknown" as Sentiment, // Placeholder, will be filled by AI
        }));
    } else {
      console.error("NewsAPI error:", response);
      return []; // Return empty if API error
    }
  } catch (error) {
    console.error("Failed to fetch real news:", error);
    return []; // Return empty on exception
  }
}


// Mock news data if NewsAPI is not available or for quick testing
const MOCK_NEWS: Record<string, Omit<NewsArticle, 'id' | 'summary' | 'imageUrl' | 'sentiment'>[]> = {
  "AAPL": [
    { title: "Apple Vision Pro Sees Strong Pre-Orders", source: "TechNewsDaily", articleUrl: "#", articleContent: "Apple's new Vision Pro headset is reportedly seeing strong pre-order numbers...", publishedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    { title: "iPhone 16 Supply Chain Ramping Up", source: "SupplyChainWeekly", articleUrl: "#", articleContent: "Key Apple suppliers are increasing production capacity...", publishedAt: new Date(Date.now() - 86400000 * 5).toISOString() },
    { title: "Apple Faces Antitrust Scrutiny in Europe", source: "GlobalRegulatorNews", articleUrl: "#", articleContent: "European regulators are intensifying their investigation...", publishedAt: new Date(Date.now() - 86400000 * 10).toISOString() },
    { title: "Analysts Bullish on Apple Services Growth", source: "MarketWatch", articleUrl: "#", articleContent: "Several financial analysts have reiterated their buy ratings for Apple stock...", publishedAt: new Date(Date.now() - 86400000 * 15).toISOString() },
    { title: "Apple Invests Further in AI R&D", source: "AIInnovationHub", articleUrl: "#", articleContent: "Apple is reportedly significantly increasing its investment...", publishedAt: new Date(Date.now() - 86400000 * 25).toISOString() },
  ],
  "GOOGL": [
    { title: "Google AI Unveils 'Gemini 2.0'", source: "AI Times", articleUrl: "#", articleContent: "Google AI has announced 'Gemini 2.0', its next-generation large language model...", publishedAt: new Date(Date.now() - 86400000 * 3).toISOString() },
    { title: "Alphabet's Waymo Expands Robotaxi Service", source: "FutureTransport", articleUrl: "#", articleContent: "Waymo, Alphabet's self-driving car unit, is expanding...", publishedAt: new Date(Date.now() - 86400000 * 8).toISOString() },
    { title: "Google Cloud Revenue Growth Slows Slightly", source: "CloudComputingReport", articleUrl: "#", articleContent: "While Google Cloud continues to grow, its latest quarterly revenue figures showed a slight deceleration...", publishedAt: new Date(Date.now() - 86400000 * 12).toISOString() },
    { title: "Pixel 9 Series to Feature Tensor G4 Chip", source: "TechLeaks", articleUrl: "#", articleContent: "Leaks suggest the upcoming Google Pixel 9 series will be powered by the new Tensor G4 chip...", publishedAt: new Date(Date.now() - 86400000 * 20).toISOString() },
    { title: "YouTube Ad Revenue Up, Shorts Monetization Improving", source: "DigitalMediaWorld", articleUrl: "#", articleContent: "Google reported an increase in YouTube advertising revenue...", publishedAt: new Date(Date.now() - 86400000 * 28).toISOString() },
  ],
  "MSFT": [
    { title: "Microsoft Q3 Earnings Beat Expectations", source: "FinancialPost", articleUrl: "#", articleContent: "Microsoft reported strong Q3 earnings, surpassing analyst expectations...", publishedAt: new Date(Date.now() - 86400000 * 4).toISOString() },
    { title: "Microsoft Completes Acquisition of 'GameMakers Inc.'", source: "GamingIndustryNews", articleUrl: "#", articleContent: "Microsoft has finalized its acquisition of 'GameMakers Inc.'...", publishedAt: new Date(Date.now() - 86400000 * 9).toISOString() },
    { title: "Copilot AI Expanding to More Microsoft 365 Services", source: "EnterpriseTech", articleUrl: "#", articleContent: "Microsoft announced plans to integrate its Copilot AI assistant into additional Microsoft 365 services...", publishedAt: new Date(Date.now() - 86400000 * 14).toISOString() },
    { title: "Microsoft Increases Investment in Renewable Energy", source: "SustainableTech", articleUrl: "#", articleContent: "Microsoft is significantly increasing its investment in renewable energy projects...", publishedAt: new Date(Date.now() - 86400000 * 22).toISOString() },
    { title: "New Surface Laptop 7 and Surface Pro 10 Announced", source: "GadgetReview", articleUrl: "#", articleContent: "Microsoft unveiled its latest Surface Laptop 7 and Surface Pro 10 devices...", publishedAt: new Date(Date.now() - 86400000 * 29).toISOString() },
  ]
};


export async function fetchStockDataAndNews(ticker: string): Promise<ServerActionResponse> {
  try {
    const upperTicker = ticker.toUpperCase();
    if (!MOCK_STOCKS[upperTicker]) {
      return { error: `Ticker symbol "${ticker}" not found or not supported. Supported: AAPL, GOOGL, MSFT` };
    }

    const stockDetailsPromise = mockFetchStockData(upperTicker);
    const stockDetails = await stockDetailsPromise;

    if (!stockDetails) {
      return { error: `Failed to fetch data for ticker "${ticker}".` };
    }
    
    const fetchedNewsArticles = await fetchRealNews(stockDetails.data.name, upperTicker);

    // Filter news for the last 30 days for financial summary (NewsAPI 'from' parameter already does this)
    const recentNewsForSummaryInput = fetchedNewsArticles.map(article => ({
      title: article.title,
      articleContent: article.articleContent,
      publishedAt: article.publishedAt,
      source: article.source,
    }));
    
    let financialSummaryText = "Financial summary based on recent news is currently unavailable.";
    if (recentNewsForSummaryInput.length > 0) {
        try {
            const summaryResult = await generateFinancialSummary({
                stockTicker: upperTicker,
                companyName: stockDetails.data.name,
                newsArticles: recentNewsForSummaryInput,
            });
            financialSummaryText = summaryResult.summary;
        } catch (genSummaryError) {
            console.error(`Failed to generate financial summary for ${upperTicker}:`, genSummaryError);
        }
    } else {
        financialSummaryText = `No news articles found for ${upperTicker} in the last 30 days to generate a financial summary.`;
    }

    // Process articles for display: individual summaries and sentiment analysis
    const processedArticlesForDisplay: NewsArticle[] = [];
    const articleProcessingPromises = fetchedNewsArticles.slice(0, 6).map(async (article) => {
      let summarizedArticle = { ...article, summary: "AI summary currently unavailable.", sentiment: "Unknown" as Sentiment };
      try {
        const [summaryResult, sentimentResult] = await Promise.all([
          summarizeNewsArticle({
            articleTitle: article.title,
            articleUrl: article.articleUrl,
            articleContent: article.articleContent, // Full content for summary
            stockTicker: upperTicker,
          }),
          analyzeNewsSentiment({ articleContent: article.articleContent.substring(0,1000) }) // Use a snippet for sentiment for brevity
        ]);
        summarizedArticle.summary = summaryResult.summary;
        summarizedArticle.sentiment = sentimentResult.sentiment;
      } catch (processingError) {
        console.error(`Error processing article "${article.title}":`, processingError);
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

  } catch (error) {
    console.error("Error in fetchStockDataAndNews:", error);
    let errorMessage = "An unexpected error occurred while fetching data. Please try again.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { error: errorMessage };
  }
}
