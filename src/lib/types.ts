
export type Sentiment = "Positive" | "Neutral" | "Negative" | "Unknown";

export interface StockData {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: string; // Will be formatted (e.g., "2.5T")
  volume: string; // Will be formatted (e.g., "60.5M")
  peRatio?: number | string; // Can be N/A from API
  eps?: number | string; // Can be N/A from API
  week52High?: number; // Can be N/A from API
  week52Low?: number; // Can be N/A from API
  lastUpdated: string; // ISO string date or a descriptive string like "Live"
  previousClose?: number;
  openPrice?: number;
  dayHigh?: number;
  dayLow?: number;
}

export interface HistoricalDataPoint {
  date: string; // 'YYYY-MM-DD'
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  articleUrl: string;
  articleContent: string; // For AI summarization input
  publishedAt: string; // ISO string
  summary?: string; // AI generated for individual article
  imageUrl?: string;
  sentiment?: Sentiment;
}

export interface StockVoyantData {
  stockData: StockData;
  historicalData: HistoricalDataPoint[];
  newsArticles: NewsArticle[];
  financialSummary?: string;
}

export type ServerActionResponse = {
  data?: StockVoyantData;
  error?: string;
};
