"use server";

import type { StockVoyantData, ServerActionResponse, NewsArticle, StockData, HistoricalDataPoint } from "./types";
import { summarizeNewsArticle } from "@/ai/flows/summarize-news-article";

// MOCK DATA AND FUNCTIONS
// In a real application, these would call external APIs (Yahoo Finance, NewsAPI)

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

const MOCK_NEWS: Record<string, Omit<NewsArticle, 'id' | 'summary' | 'imageUrl'>[]> = {
  "AAPL": [
    {
      title: "Apple Unveils New Vision Pro Features at WWDC",
      source: "TechCrunch",
      articleUrl: "https://placehold.co/600x400?text=Article+1+Content", // Placeholder URL
      articleContent: "Apple today announced several new features for its Vision Pro headset at the Worldwide Developers Conference. These include improved hand tracking, new spatial computing apps, and a more immersive entertainment experience. Analysts are optimistic about the updates, suggesting they could drive further adoption of the mixed-reality device.",
      publishedAt: new Date(Date.now() - 86400000 * 1).toISOString(), // 1 day ago
    },
    {
      title: "iPhone 16 Production Ramps Up Amid Strong Demand Forecasts",
      source: "Bloomberg",
      articleUrl: "https://placehold.co/600x400?text=Article+2+Content", // Placeholder URL
      articleContent: "Sources close to Apple's supply chain report that production for the upcoming iPhone 16 series is ramping up. Foxconn and other manufacturing partners are hiring additional workers to meet anticipated strong global demand. The new lineup is expected to feature AI enhancements and camera upgrades.",
      publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    },
  ],
  "GOOGL": [
    {
      title: "Google DeepMind Announces Breakthrough in AI Drug Discovery",
      source: "Reuters",
      articleUrl: "https://placehold.co/600x400?text=Article+3+Content", // Placeholder URL
      articleContent: "Google's DeepMind division today revealed a significant advancement in using artificial intelligence for drug discovery. Their new model, 'AlphaFold Bio', can predict protein structures with unprecedented accuracy, potentially accelerating the development of new medicines for various diseases. This marks a major step for AI in healthcare.",
      publishedAt: new Date(Date.now() - 86400000 * 0.5).toISOString(), // 12 hours ago
    },
  ],
   "MSFT": [
    {
      title: "Microsoft Azure Gains Market Share in Cloud Computing",
      source: "Wall Street Journal",
      articleUrl: "https://placehold.co/600x400?text=Article+4+Content", // Placeholder URL
      articleContent: "Microsoft's Azure cloud platform continues to gain market share, according to a new report from Synergy Research Group. Azure's growth is attributed to strong enterprise adoption and its expanding portfolio of AI and data services. The report highlights Azure's competitive positioning against AWS and Google Cloud.",
      publishedAt: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
    },
  ]
};

async function mockFetchStockData(ticker: string): Promise<{ data: StockData, historical: HistoricalDataPoint } | null> {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
  if (MOCK_STOCKS[ticker]) {
    // Simulate dynamic price update
    const stock = MOCK_STOCKS[ticker];
    const priceChange = (Math.random() - 0.5) * 2; // Small random change
    const newPrice = parseFloat((stock.data.price + priceChange).toFixed(2));
    const newChange = parseFloat((stock.data.change + (priceChange > 0 ? Math.random() : -Math.random())).toFixed(2));
    const newChangePercent = parseFloat(((newChange / (newPrice - newChange)) * 100).toFixed(2));
    
    return {
      data: {
        ...stock.data,
        price: newPrice,
        change: newChange,
        changePercent: newChangePercent,
        lastUpdated: new Date().toISOString(),
      },
      historical: stock.historical,
    };
  }
  return null;
}

async function mockFetchNews(ticker: string): Promise<NewsArticle[]> {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
  const newsItems = MOCK_NEWS[ticker] || [];
  return newsItems.map((item, index) => ({
    ...item,
    id: `${ticker}-news-${index + 1}`,
    imageUrl: `https://placehold.co/300x200.png?text=${ticker}+News+${index+1}`, // Add placeholder image
  }));
}

export async function fetchStockDataAndNews(ticker: string): Promise<ServerActionResponse> {
  try {
    // Validate ticker (simple check for mock)
    if (!MOCK_STOCKS[ticker]) {
      return { error: `Ticker symbol "${ticker}" not found or not supported.` };
    }

    const stockInfoPromise = mockFetchStockData(ticker);
    const newsPromise = mockFetchNews(ticker);

    const [stockDetails, rawNewsArticles] = await Promise.all([stockInfoPromise, newsPromise]);

    if (!stockDetails) {
      return { error: `Failed to fetch data for ticker "${ticker}".` };
    }

    const summarizedArticles: NewsArticle[] = [];
    for (const article of rawNewsArticles) {
      try {
        const summaryResult = await summarizeNewsArticle({
          articleTitle: article.title,
          articleUrl: article.articleUrl,
          articleContent: article.articleContent,
          stockTicker: ticker,
        });
        summarizedArticles.push({
          ...article,
          summary: summaryResult.summary,
        });
      } catch (summaryError) {
        console.error(`Failed to summarize article "${article.title}":`, summaryError);
        summarizedArticles.push({
          ...article,
          summary: "AI summary currently unavailable for this article.",
        });
      }
    }
    
    const responseData: StockVoyantData = {
      stockData: stockDetails.data,
      historicalData: stockDetails.historical,
      newsArticles: summarizedArticles,
    };

    return { data: responseData };

  } catch (error) {
    console.error("Error in fetchStockDataAndNews:", error);
    return { error: "An unexpected error occurred while fetching data. Please try again." };
  }
}