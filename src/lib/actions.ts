"use server";

import type { StockVoyantData, ServerActionResponse, NewsArticle, StockData, HistoricalDataPoint } from "./types";
import { summarizeNewsArticle } from "@/ai/flows/summarize-news-article";
import { generateFinancialSummary, type GenerateFinancialSummaryInput } from "@/ai/flows/generate-financial-summary-flow";
import { subDays, parseISO } from 'date-fns';


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
      title: "Apple Vision Pro Sees Strong Pre-Orders",
      source: "TechNewsDaily",
      articleUrl: "https://placehold.co/600x400?text=Vision+Pro+Success",
      articleContent: "Apple's new Vision Pro headset is reportedly seeing strong pre-order numbers, exceeding initial analyst expectations. This early demand signals potential for a new major product category for Apple, though long-term success will depend on app ecosystem and broader consumer adoption. Some concerns remain about the high price point.",
      publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    },
    {
      title: "iPhone 16 Supply Chain Ramping Up",
      source: "SupplyChainWeekly",
      articleUrl: "https://placehold.co/600x400?text=iPhone+16+Production",
      articleContent: "Key Apple suppliers are increasing production capacity for components expected to be used in the upcoming iPhone 16. This move indicates Apple is on track for its usual fall launch schedule. The new models are rumored to feature enhanced AI capabilities and camera improvements.",
      publishedAt: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
    },
    {
      title: "Apple Faces Antitrust Scrutiny in Europe Over App Store Policies",
      source: "GlobalRegulatorNews",
      articleUrl: "https://placehold.co/600x400?text=Apple+EU+Antitrust",
      articleContent: "European regulators are intensifying their investigation into Apple's App Store policies, particularly concerning commission rates and restrictions on alternative payment systems. This could lead to significant fines or forced changes to Apple's business model in the region.",
      publishedAt: new Date(Date.now() - 86400000 * 10).toISOString(), // 10 days ago
    },
     {
      title: "Analysts Bullish on Apple Services Growth",
      source: "MarketWatch",
      articleUrl: "https://placehold.co/600x400?text=Apple+Services+Growth",
      articleContent: "Several financial analysts have reiterated their buy ratings for Apple stock, citing continued strong growth in its services division. Subscription services like Apple Music, iCloud, and Apple TV+ are seen as key drivers of recurring revenue.",
      publishedAt: new Date(Date.now() - 86400000 * 15).toISOString(), // 15 days ago
    },
    {
      title: "Apple Invests Further in AI Research and Development",
      source: "AIInnovationHub",
      articleUrl: "https://placehold.co/600x400?text=Apple+AI+Investment",
      articleContent: "Apple is reportedly significantly increasing its investment in artificial intelligence research and development. This includes hiring top AI talent and acquiring smaller AI startups, signaling a strategic push to integrate more advanced AI features across its product lines.",
      publishedAt: new Date(Date.now() - 86400000 * 25).toISOString(), // 25 days ago
    },
     {
      title: "Older Apple News Not For Summary",
      source: "ArchiveNews",
      articleUrl: "https://placehold.co/600x400?text=Apple+Old+News",
      articleContent: "This is an older news article from more than a month ago and should not be included in the financial summary. It discusses past product launches.",
      publishedAt: new Date(Date.now() - 86400000 * 40).toISOString(), // 40 days ago
    }
  ],
  "GOOGL": [
    // ... (similar structure with 5-6 articles, varying dates, including some older than 1 month)
    {
      title: "Google AI Unveils New Large Language Model 'Gemini 2.0'",
      source: "AI Times",
      articleUrl: "https://placehold.co/600x400?text=GOOGL+AI+LLM",
      articleContent: "Google AI has announced 'Gemini 2.0', its next-generation large language model, promising enhanced reasoning and coding capabilities. This move aims to compete directly with OpenAI's latest models and solidify Google's position in the AI race. Early benchmarks show impressive performance.",
      publishedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      title: "Alphabet's Waymo Expands Robotaxi Service",
      source: "FutureTransport",
      articleUrl: "https://placehold.co/600x400?text=Waymo+Expansion",
      articleContent: "Waymo, Alphabet's self-driving car unit, is expanding its commercial robotaxi service to two new cities. This indicates growing confidence in the technology and a push towards wider commercialization, though regulatory hurdles and public acceptance remain key challenges.",
      publishedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    },
    {
      title: "Google Cloud Revenue Growth Slows Slightly, Concerns Analysts",
      source: "CloudComputingReport",
      articleUrl: "https://placehold.co/600x400?text=Google+Cloud+Revenue",
      articleContent: "While Google Cloud continues to grow, its latest quarterly revenue figures showed a slight deceleration in growth rate compared to previous periods. Some analysts express concern this might indicate intensifying competition from AWS and Azure.",
      publishedAt: new Date(Date.now() - 86400000 * 12).toISOString(),
    },
    {
      title: "Pixel 9 Series to Feature Tensor G4 Chip and AI Focus",
      source: "TechLeaks",
      articleUrl: "https://placehold.co/600x400?text=Pixel+9+Tensor+G4",
      articleContent: "Leaks suggest the upcoming Google Pixel 9 series will be powered by the new Tensor G4 chip, with a strong emphasis on on-device AI features. Google aims to leverage its AI prowess to differentiate its hardware offerings.",
      publishedAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    },
    {
      title: "YouTube Ad Revenue Up, Shorts Monetization Improving",
      source: "DigitalMediaWorld",
      articleUrl: "https://placehold.co/600x400?text=YouTube+Ads+Shorts",
      articleContent: "Google reported an increase in YouTube advertising revenue, with promising signs of improved monetization for its short-form video platform, YouTube Shorts. This is crucial for competing with TikTok and Instagram Reels.",
      publishedAt: new Date(Date.now() - 86400000 * 28).toISOString(),
    },
    {
      title: "Google Settles Old Privacy Lawsuit",
      source: "LegalNews",
      articleUrl: "https://placehold.co/600x400?text=Google+Old+Lawsuit",
      articleContent: "This is an older news article about Google settling a privacy lawsuit that concluded over a month ago. It should not be part of the current financial summary.",
      publishedAt: new Date(Date.now() - 86400000 * 50).toISOString(),
    }
  ],
   "MSFT": [
    // ... (similar structure with 5-6 articles, varying dates, including some older than 1 month)
    {
      title: "Microsoft Q3 Earnings Beat Expectations, Azure Growth Strong",
      source: "FinancialPost",
      articleUrl: "https://placehold.co/600x400?text=MSFT+Q3+Earnings",
      articleContent: "Microsoft reported strong Q3 earnings, surpassing analyst expectations, largely driven by continued robust growth in its Azure cloud computing division. The company's AI initiatives, particularly Copilot integrations, are also starting to show positive revenue impact.",
      publishedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    {
      title: "Microsoft Completes Acquisition of Gaming Studio 'GameMakers Inc.'",
      source: "GamingIndustryNews",
      articleUrl: "https://placehold.co/600x400?text=MSFT+Acquisition",
      articleContent: "Microsoft has finalized its acquisition of 'GameMakers Inc.', a prominent game development studio. This move is expected to bolster Xbox Game Studios' portfolio and enhance content for the Game Pass subscription service. Regulatory approval was the final step.",
      publishedAt: new Date(Date.now() - 86400000 * 9).toISOString(),
    },
    {
      title: "Copilot AI Expanding to More Microsoft 365 Services",
      source: "EnterpriseTech",
      articleUrl: "https://placehold.co/600x400?text=Copilot+Expansion",
      articleContent: "Microsoft announced plans to integrate its Copilot AI assistant into additional Microsoft 365 services, including SharePoint and Microsoft Teams Premium. The company is betting heavily on generative AI to drive productivity and enterprise software sales.",
      publishedAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    },
    {
      title: "Microsoft Increases Investment in Renewable Energy for Data Centers",
      source: "SustainableTech",
      articleUrl: "https://placehold.co/600x400?text=MSFT+Renewable+Energy",
      articleContent: "Microsoft is significantly increasing its investment in renewable energy projects to power its global network of data centers. This aligns with its sustainability goals and aims to address the growing energy demands of AI workloads.",
      publishedAt: new Date(Date.now() - 86400000 * 22).toISOString(),
    },
    {
      title: "New Surface Laptop 7 and Surface Pro 10 Announced",
      source: "GadgetReview",
      articleUrl: "https://placehold.co/600x400?text=Surface+Launch",
      articleContent: "Microsoft unveiled its latest Surface Laptop 7 and Surface Pro 10 devices, featuring new Intel Core Ultra processors and dedicated NPUs for enhanced AI performance. These devices are aimed at both consumers and professionals.",
      publishedAt: new Date(Date.now() - 86400000 * 29).toISOString(),
    },
    {
      title: "Microsoft's Old Partnership with Nokia - A Look Back",
      source: "TechHistory",
      articleUrl: "https://placehold.co/600x400?text=MSFT+Nokia+History",
      articleContent: "This article is a historical piece about Microsoft's partnership with Nokia from many years ago. It's older than one month and not relevant for the current financial summary.",
      publishedAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    }
  ]
};

async function mockFetchStockData(ticker: string): Promise<{ data: StockData, historical: HistoricalDataPoint[] } | null> {
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay
  if (MOCK_STOCKS[ticker]) {
    const stock = MOCK_STOCKS[ticker];
    const priceChange = (Math.random() - 0.5) * (stock.data.price * 0.01);
    const newPrice = parseFloat((stock.data.price + priceChange).toFixed(2));
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
  await new Promise(resolve => setTimeout(resolve, 700)); 
  const newsItems = MOCK_NEWS[ticker] || [];
  const sortedNews = newsItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return sortedNews.map((item, index) => ({
    ...item,
    id: `${ticker}-news-${index + 1}`,
    imageUrl: `https://placehold.co/300x200.png?text=${encodeURIComponent(ticker)}+News+${index+1}`,
  }));
}

export async function fetchStockDataAndNews(ticker: string): Promise<ServerActionResponse> {
  try {
    const upperTicker = ticker.toUpperCase();
    if (!MOCK_STOCKS[upperTicker]) {
      return { error: `Ticker symbol "${ticker}" not found or not supported. Supported: AAPL, GOOGL, MSFT` };
    }

    const stockInfoPromise = mockFetchStockData(upperTicker);
    const allNewsPromise = mockFetchNews(upperTicker);

    const [stockDetails, allRawNewsArticles] = await Promise.all([stockInfoPromise, allNewsPromise]);

    if (!stockDetails) {
      return { error: `Failed to fetch data for ticker "${ticker}".` };
    }

    // Filter news for the last 30 days for financial summary
    const thirtyDaysAgo = subDays(new Date(), 30);
    const recentNewsForSummary = allRawNewsArticles.filter(article => 
      parseISO(article.publishedAt) >= thirtyDaysAgo
    );
    
    // Prepare input for financial summary flow
    const financialSummaryInput: GenerateFinancialSummaryInput = {
      stockTicker: upperTicker,
      companyName: stockDetails.data.name,
      newsArticles: recentNewsForSummary.map(article => ({
        title: article.title,
        articleContent: article.articleContent, // Genkit flow will truncate if necessary
        publishedAt: article.publishedAt,
        source: article.source,
      })),
    };

    let financialSummaryText = "Financial summary based on recent news is currently unavailable.";
    if (financialSummaryInput.newsArticles.length > 0) {
        try {
            const summaryResult = await generateFinancialSummary(financialSummaryInput);
            financialSummaryText = summaryResult.summary;
        } catch (genSummaryError) {
            console.error(`Failed to generate financial summary for ${upperTicker}:`, genSummaryError);
            // Keep default message or provide more specific error
        }
    } else {
        financialSummaryText = `No news articles found for ${upperTicker} in the last 30 days to generate a financial summary.`;
    }


    // Summarize all fetched articles (up to 6 for display cards)
    const articlesForDisplay = allRawNewsArticles.slice(0, 6);
    const summarizedArticlesForDisplay: NewsArticle[] = [];

    for (const article of articlesForDisplay) {
      try {
        const indivSummaryResult = await summarizeNewsArticle({
          articleTitle: article.title,
          articleUrl: article.articleUrl,
          articleContent: article.articleContent,
          stockTicker: upperTicker,
        });
        summarizedArticlesForDisplay.push({
          ...article,
          summary: indivSummaryResult.summary,
        });
      } catch (summaryError) {
        console.error(`Failed to summarize article "${article.title}":`, summaryError);
        summarizedArticlesForDisplay.push({
          ...article,
          summary: "AI summary currently unavailable for this article.",
        });
      }
    }
    
    const responseData: StockVoyantData = {
      stockData: stockDetails.data,
      historicalData: stockDetails.historical,
      newsArticles: summarizedArticlesForDisplay, // These are the ones with individual summaries for cards (if we use cards)
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
