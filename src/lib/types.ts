
export interface StockData {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: string;
  volume: string;
  peRatio?: number | string; // Can be N/A
  eps?: number | string; // Can be N/A
  week52High: number;
  week52Low: number;
  lastUpdated: string;
}

export interface HistoricalDataPoint {
  date: string; // e.g., 'YYYY-MM-DD'
  price: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  articleUrl: string;
  articleContent: string; // For AI summarization input
  publishedAt: string; // ISO string
  summary?: string; // AI generated
  imageUrl?: string;
}

export interface StockVoyantData {
  stockData: StockData;
  historicalData: HistoricalDataPoint[];
  newsArticles: NewsArticle[];
}

export type ServerActionResponse = {
  data?: StockVoyantData;
  error?: string;
};
