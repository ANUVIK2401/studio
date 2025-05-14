'use server';
/**
 * @fileOverview Analyzes the sentiment of a news article.
 *
 * - analyzeNewsSentiment - A function that analyzes news article sentiment.
 * - AnalyzeNewsSentimentInput - The input type for the function.
 * - AnalyzeNewsSentimentOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { Sentiment } from '@/lib/types';

const AnalyzeNewsSentimentInputSchema = z.object({
  articleContent: z.string().describe('The content of the news article to analyze.'),
});
export type AnalyzeNewsSentimentInput = z.infer<typeof AnalyzeNewsSentimentInputSchema>;

const SentimentEnum = z.enum(["Positive", "Neutral", "Negative", "Unknown"]);

const AnalyzeNewsSentimentOutputSchema = z.object({
  sentiment: SentimentEnum.describe('The analyzed sentiment of the article: Positive, Neutral, Negative, or Unknown if not determinable.'),
});
export type AnalyzeNewsSentimentOutput = z.infer<typeof AnalyzeNewsSentimentOutputSchema>;

export async function analyzeNewsSentiment(input: AnalyzeNewsSentimentInput): Promise<AnalyzeNewsSentimentOutput> {
  return analyzeNewsSentimentFlow(input);
}

const sentimentAnalysisPrompt = ai.definePrompt({
  name: 'sentimentAnalysisPrompt',
  input: {schema: AnalyzeNewsSentimentInputSchema},
  output: {schema: AnalyzeNewsSentimentOutputSchema},
  prompt: `Analyze the sentiment of the following news article content.
Classify the sentiment as "Positive", "Neutral", or "Negative". If the sentiment is unclear or cannot be determined, classify it as "Unknown".
Provide only the classification word as the output.

Article Content:
{{{articleContent}}}

Sentiment:`,
  config: { // Default safety settings should be fine, but can be adjusted if needed
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ]
  }
});

const analyzeNewsSentimentFlow = ai.defineFlow(
  {
    name: 'analyzeNewsSentimentFlow',
    inputSchema: AnalyzeNewsSentimentInputSchema,
    outputSchema: AnalyzeNewsSentimentOutputSchema,
  },
  async (input) => {
    // Truncate content if too long for the prompt to avoid errors
    const truncatedContent = input.articleContent.substring(0, 30000); // Gemini has large context, but good to be safe

    const {output} = await sentimentAnalysisPrompt({ articleContent: truncatedContent });

    if (!output?.sentiment) {
      return { sentiment: "Unknown" as Sentiment };
    }
    return { sentiment: output.sentiment as Sentiment };
  }
);
