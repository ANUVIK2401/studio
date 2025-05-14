'use server';
/**
 * @fileOverview Generates a financial summary for a stock based on recent news articles.
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
});
export type GenerateFinancialSummaryInput = z.infer<typeof GenerateFinancialSummaryInputSchema>;

const GenerateFinancialSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise financial summary derived from the provided news articles, highlighting trends, sentiments, and key events impacting the stock.'),
});
export type GenerateFinancialSummaryOutput = z.infer<typeof GenerateFinancialSummaryOutputSchema>;

export async function generateFinancialSummary(input: GenerateFinancialSummaryInput): Promise<GenerateFinancialSummaryOutput> {
  return generateFinancialSummaryFlow(input);
}

const financialSummaryPrompt = ai.definePrompt({
  name: 'financialSummaryPrompt',
  input: {schema: GenerateFinancialSummaryInputSchema},
  output: {schema: GenerateFinancialSummaryOutputSchema},
  prompt: `You are a Senior Financial Analyst AI. Your task is to provide a concise financial summary and outlook for {{companyName}} ({{stockTicker}}) based *solely* on the following news articles published in the last month.

Analyze the sentiment, key events, and potential impacts discussed in these articles. Structure your summary to be informative for an investor. Highlight any recurring themes, positive or negative trends, and significant developments.

Do not invent information or use external knowledge beyond these articles. If the articles are sparse or unclear, state that the summary is limited by the available information.

News Articles:
{{#each newsArticles}}
- Title: "{{title}}" (Source: {{source}}, Published: {{publishedAt}})
  Content Snippet: "{{articleContent}}"
---
{{/each}}

Based on this information, provide your financial summary:
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

    const {output} = await financialSummaryPrompt({
        ...input,
        newsArticles: processedArticles,
    });

    if (!output?.summary) {
      return { summary: 'Could not generate a financial summary based on the provided news. The information might be insufficient or an error occurred.' };
    }
    return output;
  }
);
