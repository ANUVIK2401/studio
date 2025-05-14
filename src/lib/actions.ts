"use server";

import type { StockVoyantData, ServerActionResponse, NewsArticle, StockData, HistoricalDataPoint } from "./types";
import { summarizeNewsArticle } from "@/ai/flows/summarize-news-article";

// MOCK DATA AND FUNCTIONS

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

const MOCK_NEWS: Record<string, Omit<NewsArticle, 'id' | 'summary' | 'imageUrl'>[]> = {
  "AAPL": [
    {
      title: "Apple Unveils New Vision Pro Features at WWDC",
      source: "TechCrunch",
      articleUrl: "https://placehold.co/600x400?text=Article+1+Content",
      articleContent: "Apple today announced several new features for its Vision Pro headset at the Worldwide Developers Conference. These include improved hand tracking, new spatial computing apps, and a more immersive entertainment experience. Analysts are optimistic about the updates, suggesting they could drive further adoption of the mixed-reality device.",
      publishedAt: new Date(Date.now() - 86400000 * 0.5).toISOString(), // 0.5 day ago
    },
    {
      title: "iPhone 16 Production Ramps Up Amid Strong Demand Forecasts",
      source: "Bloomberg",
      articleUrl: "https://placehold.co/600x400?text=Article+2+Content",
      articleContent: "Sources close to Apple's supply chain report that production for the upcoming iPhone 16 series is ramping up. Foxconn and other manufacturing partners are hiring additional workers to meet anticipated strong global demand. The new lineup is expected to feature AI enhancements and camera upgrades.",
      publishedAt: new Date(Date.now() - 86400000 * 1).toISOString(), // 1 day ago
    },
    {
      title: "Analysts Weigh In on Apple's AI Strategy for Services",
      source: "Reuters",
      articleUrl: "https://placehold.co/600x400?text=Article+3+Content",
      articleContent: "Financial analysts are closely watching Apple's evolving AI strategy, particularly how it will be integrated into its services ecosystem. Expectations are high for AI-driven improvements in Siri, Apple Music, and iCloud, potentially creating new revenue streams.",
      publishedAt: new Date(Date.now() - 86400000 * 1.5).toISOString(), // 1.5 days ago
    },
    {
      title: "Apple Expands Manufacturing Footprint in Southeast Asia",
      source: "Nikkei Asia",
      articleUrl: "https://placehold.co/600x400?text=Article+4+Content",
      articleContent: "Apple is reportedly increasing its investment in manufacturing facilities in Vietnam and India as part of its supply chain diversification strategy. This move aims to reduce reliance on a single region and build resilience against geopolitical uncertainties.",
      publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    },
    {
      title: "Next Generation Apple Watch to Feature Advanced Health Sensors",
      source: "The Verge",
      articleUrl: "https://placehold.co/600x400?text=Article+5+Content",
      articleContent: "Rumors suggest the next Apple Watch iteration will include more sophisticated health monitoring sensors, potentially including blood pressure monitoring and sleep apnea detection. This continues Apple's push into personal health and wellness technology.",
      publishedAt: new Date(Date.now() - 86400000 * 2.5).toISOString(), // 2.5 days ago
    }
  ],
  "GOOGL": [
    {
      title: "Google DeepMind Announces Breakthrough in AI Drug Discovery",
      source: "Reuters",
      articleUrl: "https://placehold.co/600x400?text=Article+GOOGL+1+Content",
      articleContent: "Google's DeepMind division today revealed a significant advancement in using artificial intelligence for drug discovery. Their new model, 'AlphaFold Bio', can predict protein structures with unprecedented accuracy, potentially accelerating the development of new medicines for various diseases.",
      publishedAt: new Date(Date.now() - 86400000 * 0.7).toISOString(),
    },
    {
      title: "Google Search Algorithm Update Impacts Local Businesses",
      source: "Search Engine Land",
      articleUrl: "https://placehold.co/600x400?text=Article+GOOGL+2+Content",
      articleContent: "A recent update to Google's search algorithm appears to be affecting the visibility of local businesses in search results. SEO experts are analyzing the changes and advising businesses on how to adapt their online presence.",
      publishedAt: new Date(Date.now() - 86400000 * 1.2).toISOString(),
    },
    {
      title: "Alphabet's Waymo Expands Robotaxi Service to New City",
      source: "TechCrunch",
      articleUrl: "https://placehold.co/600x400?text=Article+GOOGL+3+Content",
      articleContent: "Waymo, Alphabet's self-driving car company, has announced the expansion of its robotaxi service to Austin, Texas. This marks another step in the company's efforts to commercialize autonomous vehicle technology.",
      publishedAt: new Date(Date.now() - 86400000 * 1.8).toISOString(),
    },
    {
      title: "Google Cloud Unveils New AI Tools for Developers",
      source: "VentureBeat",
      articleUrl: "https://placehold.co/600x400?text=Article+GOOGL+4+Content",
      articleContent: "At its annual cloud conference, Google Cloud introduced a suite of new AI-powered tools aimed at developers, including enhanced large language models and improved machine learning infrastructure.",
      publishedAt: new Date(Date.now() - 86400000 * 2.2).toISOString(),
    },
    {
      title: "Regulatory Scrutiny Increases on Google's Ad Tech Business",
      source: "Wall Street Journal",
      articleUrl: "https://placehold.co/600x400?text=Article+GOOGL+5+Content",
      articleContent: "Google's advertising technology business is facing increased regulatory scrutiny in both the US and Europe. Antitrust concerns are being raised about its dominant market position.",
      publishedAt: new Date(Date.now() - 86400000 * 2.8).toISOString(),
    }
  ],
   "MSFT": [
    {
      title: "Microsoft Azure Gains Market Share in Cloud Computing",
      source: "Wall Street Journal",
      articleUrl: "https://placehold.co/600x400?text=Article+MSFT+1+Content",
      articleContent: "Microsoft's Azure cloud platform continues to gain market share, according to a new report from Synergy Research Group. Azure's growth is attributed to strong enterprise adoption and its expanding portfolio of AI and data services.",
      publishedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    },
    {
      title: "Microsoft Integrates Copilot AI into More Office 365 Apps",
      source: "The Verge",
      articleUrl: "https://placehold.co/600x400?text=Article+MSFT+2+Content",
      articleContent: "Microsoft is deepening the integration of its Copilot AI assistant across the Office 365 suite, bringing new generative AI capabilities to Word, Excel, PowerPoint, and Outlook.",
      publishedAt: new Date(Date.now() - 86400000 * 1.5).toISOString(),
    },
    {
      title: "Xbox Announces New Game Pass Titles for Next Month",
      source: "IGN",
      articleUrl: "https://placehold.co/600x400?text=Article+MSFT+3+Content",
      articleContent: "Microsoft's Xbox division has revealed the next batch of games coming to its popular Game Pass subscription service, including several anticipated indie titles and day-one releases.",
      publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      title: "Microsoft and OpenAI Strengthen Partnership on AI Research",
      source: "Bloomberg",
      articleUrl: "https://placehold.co/600x400?text=Article+MSFT+4+Content",
      articleContent: "Microsoft and OpenAI are reportedly strengthening their partnership with new joint initiatives in AI research and development, focusing on building more powerful and responsible AI models.",
      publishedAt: new Date(Date.now() - 86400000 * 2.5).toISOString(),
    },
    {
      title: "Windows 12 Rumors Point to Deeper AI Integration",
      source: "Windows Central",
      articleUrl: "https://placehold.co/600x400?text=Article+MSFT+5+Content",
      articleContent: "Speculation is growing about the next version of Windows, with sources suggesting it will feature significantly deeper AI integration throughout the operating system, potentially transforming user interaction.",
      publishedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
  ]
};

async function mockFetchStockData(ticker: string): Promise<{ data: StockData, historical: HistoricalDataPoint[] } | null> {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
  if (MOCK_STOCKS[ticker]) {
    const stock = MOCK_STOCKS[ticker];
    const priceChange = (Math.random() - 0.5) * (stock.data.price * 0.01); // Max 1% random price fluctuation for realism
    const newPrice = parseFloat((stock.data.price + priceChange).toFixed(2));
    
    // Simulate change based on new price vs a hypothetical previous day's close (original price +- small random amount)
    const prevClose = stock.data.price + (Math.random() -0.5) * (stock.data.price * 0.005);
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

async function mockFetchNews(ticker: string): Promise<NewsArticle[]> {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
  const newsItems = MOCK_NEWS[ticker] || [];
  // Sort by publishedAt to simulate "latest"
  const sortedNews = newsItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return sortedNews.slice(0, 6).map((item, index) => ({ // Take top 5-6
    ...item,
    id: `${ticker}-news-${index + 1}`,
    imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(ticker)}+${index+1}`, // Add placeholder image
  }));
}

export async function fetchStockDataAndNews(ticker: string): Promise<ServerActionResponse> {
  try {
    if (!MOCK_STOCKS[ticker.toUpperCase()]) {
      return { error: `Ticker symbol "${ticker}" not found or not supported. Supported: AAPL, GOOGL, MSFT` };
    }

    const stockInfoPromise = mockFetchStockData(ticker.toUpperCase());
    const newsPromise = mockFetchNews(ticker.toUpperCase());

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
          stockTicker: ticker.toUpperCase(),
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
    let errorMessage = "An unexpected error occurred while fetching data. Please try again.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return { error: errorMessage };
  }
}
