import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-news-article.ts';
import '@/ai/flows/generate-financial-summary-flow.ts';
import '@/ai/flows/analyze-news-sentiment-flow.ts'; // Added new flow
