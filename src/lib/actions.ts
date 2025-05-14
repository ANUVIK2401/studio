"use server";

import type { StockVoyantData, ServerActionResponse, NewsArticle, StockData, HistoricalDataPoint, Sentiment } from "./types";
import { summarizeNewsArticle } from "@/ai/flows/summarize-news-article";
import { generateFinancialSummary, type GenerateFinancialSummaryInput } from "@/ai/flows/generate-financial-summary-flow";
import { analyzeNewsSentiment } from "@/ai/flows/analyze-news-sentiment-flow";
import { subDays, parseISO, formatISO, differenceInDays } from 'date-fns';
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
      const date = subDays(new Date(), 365 - 1 - i); // Ensure dates go from past to present
      return {
        date: date.toISOString().split('T')[0],
        price: parseFloat((150 + Math.sin(i / 50) * 10 + Math.random() * 5).toFixed(2)),
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
      const date = subDays(new Date(), 365 - 1 - i);
      return {
        date: date.toISOString().split('T')[0],
        price: parseFloat((120 + Math.sin(i / 40) * 15 + Math.random() * 8).toFixed(2)),
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
       const date = subDays(new Date(), 365 - 1 - i);
      return {
        date: date.toISOString().split('T')[0],
        price: parseFloat((380 + Math.sin(i / 60) * 20 + Math.random() * 10).toFixed(2)),
      };
    }),
  }
};

async function mockFetchStockData(ticker: string): Promise<{ data: StockData, historical: HistoricalDataPoint[] } | null> {
  await new Promise(resolve => setTimeout(resolve, 300)); 
  if (MOCK_STOCKS[ticker]) {
    const stock = MOCK_STOCKS[ticker];
    const priceFluctuation = (Math.random() - 0.5) * (stock.data.price * 0.005); 
    const newPrice = parseFloat((stock.data.price + priceFluctuation).toFixed(2));
    const prevClose = stock.data.price; 
    const newAbsChange = parseFloat((newPrice - prevClose).toFixed(2));
    const newChangePercent = parseFloat(((newAbsChange / prevClose) * 100).toFixed(2));
    
    // Update historical data to reflect new current price if it's today
    const updatedHistorical = stock.historical.map(h => h); // Create a copy
    const todayStr = new Date().toISOString().split('T')[0];
    if (updatedHistorical.length > 0 && updatedHistorical[updatedHistorical.length -1].date === todayStr) {
        updatedHistorical[updatedHistorical.length -1].price = newPrice;
    } else if (updatedHistorical.length > 0 && parseISO(updatedHistorical[updatedHistorical.length -1].date) < parseISO(todayStr)) {
        // Add today's price if not present
        updatedHistorical.push({ date: todayStr, price: newPrice });
    }
     // Ensure week52High and week52Low are consistent with historical data including current price
    const allPrices = updatedHistorical.map(p => p.price);
    const week52High = Math.max(...allPrices);
    const week52Low = Math.min(...allPrices);


    return {
      data: {
        ...stock.data,
        price: newPrice,
        change: newAbsChange,
        changePercent: newChangePercent,
        week52High: parseFloat(week52High.toFixed(2)),
        week52Low: parseFloat(week52Low.toFixed(2)),
        lastUpdated: new Date().toISOString(),
      },
      historical: updatedHistorical,
    };
  }
  return null;
}

async function fetchRealNews(companyName: string, ticker: string): Promise<NewsArticle[]> {
  if (!newsapi) {
    console.warn("NewsAPI key not configured. Serving mock news for development.");
    return (MOCK_NEWS[ticker] || []).map((item, index) => ({
        ...item,
        id: `${ticker}-news-${index + 1}`,
        imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(ticker)}+News+${index+1}`,
        sentiment: "Unknown" as Sentiment,
    })).slice(0,6);
  }

  try {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const response = await newsapi.v2.everything({
      q: `"${companyName}" OR ${ticker}`, 
      from: formatISO(thirtyDaysAgo, { representation: 'date' }), 
      sortBy: 'relevancy', 
      language: 'en',
      pageSize: 15, 
    });

    if (response.status === "ok") {
      return response.articles
        .slice(0, 6) 
        .map((article, index) => ({
          id: `${ticker}-news-${article.source?.id || 'api'}-${index}`,
          title: article.title || "No Title",
          source: article.source?.name || "Unknown Source",
          articleUrl: article.url || "#",
          articleContent: article.content || article.description || "No Content Available",
          publishedAt: article.publishedAt || new Date().toISOString(),
          imageUrl: article.urlToImage || `https://placehold.co/300x200.png?text=${encodeURIComponent(ticker)}+News`,
          sentiment: "Unknown" as Sentiment, 
        }));
    } else {
      console.error("NewsAPI error:", response);
      return (MOCK_NEWS[ticker] || []).map((item, index) => ({ // Fallback to mock on API error
        ...item,
        id: `${ticker}-news-mock-${index + 1}`,
        imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(ticker)}+News+${index+1}`,
        sentiment: "Unknown" as Sentiment,
      })).slice(0,6);
    }
  } catch (error) {
    console.error("Failed to fetch real news:", error);
     return (MOCK_NEWS[ticker] || []).map((item, index) => ({ // Fallback to mock on exception
        ...item,
        id: `${ticker}-news-mock-exc-${index + 1}`,
        imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(ticker)}+News+${index+1}`,
        sentiment: "Unknown" as Sentiment,
      })).slice(0,6);
  }
}


// Mock news data if NewsAPI is not available or for quick testing
const MOCK_NEWS: Record<string, Omit<NewsArticle, 'id' | 'summary' | 'imageUrl' | 'sentiment'>[]> = {
  "AAPL": [
    { title: "Apple Vision Pro Sees Strong Pre-Orders Amidst High Price Point", source: "TechCrunch", articleUrl: "#", articleContent: "Apple's new Vision Pro mixed reality headset is reportedly seeing strong pre-order numbers despite its premium $3,499 price tag. Analysts are watching closely to see if it can carve out a significant niche in the burgeoning spatial computing market. Early reviews praise the immersive experience but note the cost as a barrier for mass adoption.", publishedAt: subDays(new Date(), 2).toISOString() },
    { title: "iPhone 16 Supply Chain Ramping Up for September Launch", source: "Bloomberg", articleUrl: "#", articleContent: "Key Apple suppliers like Foxconn and Pegatron are increasing production capacity in anticipation of the iPhone 16 series, expected to be unveiled in September. Rumors suggest new AI features and camera improvements.", publishedAt: subDays(new Date(), 5).toISOString() },
    { title: "Apple Faces New Antitrust Scrutiny in Europe Over App Store Policies", source: "Reuters", articleUrl: "#", articleContent: "European Union regulators are intensifying their investigation into Apple's App Store policies, particularly concerning developer fees and restrictions on alternative payment systems. This could lead to significant fines or mandated changes.", publishedAt: subDays(new Date(), 10).toISOString() },
    { title: "Analysts Bullish on Apple Services Growth Trajectory", source: "MarketWatch", articleUrl: "#", articleContent: "Several financial analysts have reiterated their buy ratings for Apple stock (AAPL), citing strong continued growth in its services division, which includes the App Store, Apple Music, iCloud, and Apple TV+. This segment is seen as a key driver for future profitability.", publishedAt: subDays(new Date(), 15).toISOString() },
    { title: "Apple Invests Further in AI R&D, Potentially Developing Own Search Engine", source: "The Verge", articleUrl: "#", articleContent: "Apple is reportedly significantly increasing its investment in artificial intelligence research and development. Speculation is rife that this includes efforts to develop its own search engine to reduce reliance on Google, and to integrate more advanced AI capabilities across its ecosystem.", publishedAt: subDays(new Date(), 25).toISOString() },
    { title: "Apple's Wearables Market Share Remains Strong Despite Competition", source: "IDC", articleUrl: "#", articleContent: "According to recent market data from IDC, Apple continues to lead the wearables market with its Apple Watch and AirPods. While competition is increasing, Apple's ecosystem and brand loyalty provide a strong moat.", publishedAt: subDays(new Date(), 28).toISOString() },
  ],
  "GOOGL": [
    { title: "Google AI Unveils 'Gemini Advanced' Capabilities at I/O Conference", source: "TechRadar", articleUrl: "#", articleContent: "Google AI has announced significant upgrades to its 'Gemini' large language model series during its annual I/O conference. 'Gemini Advanced' promises enhanced reasoning, coding, and multimodal understanding, positioning it as a direct competitor to OpenAI's latest offerings.", publishedAt: subDays(new Date(), 3).toISOString() },
    { title: "Alphabet's Waymo Expands Robotaxi Service to New Cities", source: "CNBC", articleUrl: "#", articleContent: "Waymo, Alphabet's self-driving car unit, is expanding its fully autonomous robotaxi service to Austin and Dallas, signaling growing confidence in its technology and regulatory approvals. This move intensifies competition with GM's Cruise.", publishedAt: subDays(new Date(), 8).toISOString() },
    { title: "Google Cloud Revenue Growth Meets Expectations, Focus on AI Integration", source: "Wall Street Journal", articleUrl: "#", articleContent: "Google Cloud Platform (GCP) reported quarterly revenue figures that met analyst expectations. The company emphasized its strategy of integrating advanced AI capabilities, powered by Gemini, into its cloud offerings to attract enterprise clients.", publishedAt: subDays(new Date(), 12).toISOString() },
    { title: "Pixel 9 Series to Feature Tensor G4 Chip and Satellite Connectivity", source: "9to5Google", articleUrl: "#", articleContent: "Leaks suggest the upcoming Google Pixel 9 series will be powered by the new Tensor G4 chip, with a focus on on-device AI processing. Additionally, emergency satellite connectivity is rumored to be a new feature, similar to Apple's iPhone.", publishedAt: subDays(new Date(), 20).toISOString() },
    { title: "YouTube Ad Revenue Up, Shorts Monetization Improving Steadily", source: "Variety", articleUrl: "#", articleContent: "Google reported an increase in YouTube advertising revenue, driven by both traditional video ads and improvements in monetizing YouTube Shorts. The company is optimistic about Shorts' contribution to future growth.", publishedAt: subDays(new Date(), 28).toISOString() },
  ],
  "MSFT": [
    { title: "Microsoft Q3 Earnings Beat Expectations Driven by Cloud and AI", source: "Bloomberg", articleUrl: "#", articleContent: "Microsoft reported strong Q3 earnings, surpassing analyst expectations, largely driven by continued robust growth in its Azure cloud platform and increasing contributions from AI-powered services like Copilot.", publishedAt: subDays(new Date(), 4).toISOString() },
    { title: "Microsoft Completes Acquisition of 'GameMakers Inc.' to Bolster Xbox Portfolio", source: "IGN", articleUrl: "#", articleContent: "Microsoft has finalized its acquisition of 'GameMakers Inc.', a prominent game development studio. This move is expected to significantly bolster the Xbox Game Studios portfolio and bring exclusive titles to the Game Pass subscription service.", publishedAt: subDays(new Date(), 9).toISOString() },
    { title: "Copilot AI Expanding to More Microsoft 365 Services, New Tier Announced", source: "ZDNet", articleUrl: "#", articleContent: "Microsoft announced plans to integrate its Copilot AI assistant into additional Microsoft 365 services, including Outlook and PowerPoint. A new premium tier, 'Copilot Pro', was also unveiled for individual users.", publishedAt: subDays(new Date(), 14).toISOString() },
    { title: "Microsoft Increases Investment in Renewable Energy for Data Centers", source: "TechCrunch", articleUrl: "#", articleContent: "Microsoft is significantly increasing its investment in renewable energy projects to power its global network of data centers, aligning with its sustainability goals to be carbon negative by 2030.", publishedAt: subDays(new Date(), 22).toISOString() },
    { title: "New Surface Laptop 7 and Surface Pro 10 Announced with Snapdragon X Elite Chips", source: "Windows Central", articleUrl: "#", articleContent: "Microsoft unveiled its latest Surface Laptop 7 and Surface Pro 10 devices, with select models featuring the new Qualcomm Snapdragon X Elite ARM-based processors, promising improved performance and battery life for Windows on ARM.", publishedAt: subDays(new Date(), 29).toISOString() },
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

    // Prepare data for financial summary (news from last 30 days)
    const recentNewsForSummaryInput = fetchedNewsArticles
      .filter(article => differenceInDays(new Date(), parseISO(article.publishedAt)) <= 30)
      .map(article => ({
        title: article.title,
        articleContent: article.articleContent,
        publishedAt: article.publishedAt,
        source: article.source,
    }));

    // Extract 1-year performance data for financial summary
    let yearStartPrice, yearEndPrice, yearHigh, yearLow;
    if (stockDetails.historical && stockDetails.historical.length > 0) {
        const sortedHistorical = [...stockDetails.historical].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Find price closest to 1 year ago
        const oneYearAgo = subDays(new Date(), 365);
        let closestToYearAgo = sortedHistorical[0];
        for(const point of sortedHistorical) {
            if(parseISO(point.date) <= oneYearAgo) {
                closestToYearAgo = point;
            } else {
                break; //  sortedHistorical is sorted by date
            }
        }
        yearStartPrice = closestToYearAgo.price;
        yearEndPrice = sortedHistorical[sortedHistorical.length - 1].price; // Most recent price
        
        // Calculate 52-week high/low from the *actual historical data provided*
        // which might not be exactly 365 points or perfectly aligned to 52 weeks from "today"
        // but rather represent the dataset we have.
        const relevantHistoricalData = sortedHistorical.slice(-365); // Consider up to last 365 data points for high/low
        yearHigh = Math.max(...relevantHistoricalData.map(p => p.price));
        yearLow = Math.min(...relevantHistoricalData.map(p => p.price));
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

    // Process articles for display: individual summaries and sentiment analysis
    const processedArticlesForDisplay: NewsArticle[] = [];
    const articleProcessingPromises = fetchedNewsArticles.slice(0, 6).map(async (article) => {
      let summarizedArticle = { ...article, summary: "AI summary currently unavailable.", sentiment: "Unknown" as Sentiment };
      try {
        // Limit content length for AI calls to avoid excessive token usage / cost / latency
        const contentForSummary = article.articleContent.substring(0, 4000); 
        const contentForSentiment = article.articleContent.substring(0, 1000);

        const [summaryResult, sentimentResult] = await Promise.all([
          summarizeNewsArticle({
            articleTitle: article.title,
            articleUrl: article.articleUrl,
            articleContent: contentForSummary, 
            stockTicker: upperTicker,
          }),
          analyzeNewsSentiment({ articleContent: contentForSentiment }) 
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
