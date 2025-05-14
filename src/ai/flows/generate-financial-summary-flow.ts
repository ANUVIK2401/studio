'use server';
/**
 * @fileOverview Generates a financial summary for a stock based on recent news articles and 1-year performance.
 *
 * - generateFinancialSummary - A function that orchestrates the summary generation.
 * - GenerateFinancialSummaryInput - The input type for the function.
 * - GenerateFinancialSummaryOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define the structure for a single news article input
const NewsArticleInputSchema = z.object({
  title: z.string().describe('The title of the news article.'),
  articleContent: z.string().describe('The full content/body of the news article.'),
  publishedAt: z.string().describe('The publication date of the article (ISO 8601 format).'),
  source: z.string().describe('The source of the news article (e.g., TechCrunch).'),
});

const GenerateFinancialSummaryInputSchema = z.object({
  stockTicker: z.string().describe('The stock ticker symbol (e.g., AAPL, GOOGL).'),
  companyName: z.string().describe('The full name of the company (e.g., Apple Inc.).'),
  newsArticles: z.array(NewsArticleInputSchema).describe('An array of news articles from the past month relevant to the stock.'),
  yearStartPrice: z.number().optional().describe('The stock price at the beginning of the past year. Omit if not available.'),
  yearEndPrice: z.number().optional().describe('The stock price at the end of the past year (or current price if within the year). Omit if not available.'),
  yearHigh: z.number().optional().describe('The highest stock price over the past year. Omit if not available.'),
  yearLow: z.number().optional().describe('The lowest stock price over the past year. Omit if not available.'),
});
export type GenerateFinancialSummaryInput = z.infer<typeof GenerateFinancialSummaryInputSchema>;

const GenerateFinancialSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise financial summary derived from the provided news articles and stock performance, highlighting trends, sentiments, key events, and overall outlook impacting the stock.'),
});
export type GenerateFinancialSummaryOutput = z.infer<typeof GenerateFinancialSummaryOutputSchema>;

export async function generateFinancialSummary(input: GenerateFinancialSummaryInput): Promise<GenerateFinancialSummaryOutput> {
  return generateFinancialSummaryFlow(input);
}

const financialSummaryPrompt = ai.definePrompt({
  name: 'financialSummaryPrompt',
  input: {schema: GenerateFinancialSummaryInputSchema},
  output: {schema: GenerateFinancialSummaryOutputSchema},
  prompt: `You are a Senior Financial Analyst AI. Your task is to provide a concise financial summary and outlook for {{companyName}} ({{stockTicker}}).
Base your analysis *solely* on the following information:
1. News articles published in the last month.
2. Key stock performance metrics from the past year.

Analyze the sentiment, key events, and potential impacts discussed in the news.
Correlate these with the stock's performance trends where appropriate.
Structure your summary to be informative for an investor. Highlight any recurring themes, positive or negative trends, and significant developments.

Do not invent information or use external knowledge beyond the provided data. If data is sparse or unclear, state that the summary is limited.

Past Year Performance Overview:
{{#if yearStartPrice}}Starting Price (approx. 1yr ago): \${{yearStartPrice}}{{else}}N/A{{/if}}
{{#if yearEndPrice}}Most Recent Price: \${{yearEndPrice}}{{else}}N/A{{/if}}
{{#if yearHigh}}52-Week High: \${{yearHigh}}{{else}}N/A{{/if}}
{{#if yearLow}}52-Week Low: \${{yearLow}}{{else}}N/A{{/if}}

Recent News Articles (Last Month):
{{#if newsArticles.length}}
{{#each newsArticles}}
- Title: "{{title}}" (Source: {{source}}, Published: {{publishedAt}})
  Content Snippet: "{{articleContent}}"
---
{{/each}}
{{else}}
No news articles from the past month were provided for analysis.
{{/if}}

Based on all this information, provide your integrated financial summary and outlook:
`,
});

const generateFinancialSummaryFlow = ai.defineFlow(
  {
    name: 'generateFinancialSummaryFlow',
    inputSchema: GenerateFinancialSummaryInputSchema,
    outputSchema: GenerateFinancialSummaryOutputSchema,
  },
  async (input) => {
    // Ensure newsArticles are provided, and slice content if too long for the prompt
    const processedArticles = input.newsArticles.map(article => ({
      ...article,
      // Truncate article content to avoid overly long prompts, focusing on the essence
      articleContent: article.articleContent.substring(0, 1000) + (article.articleContent.length > 1000 ? '...' : ''),
    }));
    
    const promptInput = {
        ...input,
        newsArticles: processedArticles,
    };

    const {output} = await financialSummaryPrompt(promptInput);

    if (!output?.summary) {
      return { summary: 'Could not generate a financial summary based on the provided data. The information might be insufficient or an error occurred.' };
    }
    return output;
  }
);
