import type { NewsArticle } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, CalendarDays, Newspaper } from "lucide-react";
import Image from "next/image";
import { formatDistanceToNow } from 'date-fns';

interface NewsArticleCardProps {
  article: NewsArticle;
}

export function NewsArticleCard({ article }: NewsArticleCardProps) {
  const timeAgo = formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true });

  return (
    <Card className="flex flex-col h-full shadow-md hover:shadow-lg transition-shadow duration-200 rounded-lg overflow-hidden">
      {article.imageUrl && (
        <div className="relative w-full h-48">
          <Image 
            src={article.imageUrl} 
            alt={article.title} 
            layout="fill" 
            objectFit="cover"
            data-ai-hint="news business"
          />
        </div>
      )}
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold leading-tight">
          {article.title}
        </CardTitle>
        <div className="flex items-center space-x-4 text-xs text-muted-foreground pt-1">
          <div className="flex items-center">
            <Newspaper className="h-3.5 w-3.5 mr-1" />
            {article.source}
          </div>
          <div className="flex items-center">
            <CalendarDays className="h-3.5 w-3.5 mr-1" />
            {timeAgo}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow pb-4">
        <CardDescription className="text-sm line-clamp-4">
          {article.summary || "Summary not available."}
        </CardDescription>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" asChild className="w-full">
          <a href={article.articleUrl} target="_blank" rel="noopener noreferrer">
            Read Full Article
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}