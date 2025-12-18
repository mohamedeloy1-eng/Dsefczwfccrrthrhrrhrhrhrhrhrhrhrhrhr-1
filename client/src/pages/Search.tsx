import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ExternalLink, Globe, Clock, TrendingUp, Sparkles, ArrowLeft, Filter, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
  image?: string;
  source?: string;
  relevance: number;
}

interface SearchResponse {
  success: boolean;
  result?: string;
  results?: SearchResult[];
  summary?: string;
  error?: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"web" | "images" | "news">("web");

  const { data, isLoading, isFetching, refetch } = useQuery<SearchResponse>({
    queryKey: ["/api/search", searchTerm, searchType],
    enabled: searchTerm.length > 0,
  });

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setSearchTerm(query.trim());
    }
  }, [query]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(e as any);
    }
  }, [handleSearch]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  };

  const getRelevanceColor = (relevance: number) => {
    if (relevance >= 80) return "bg-green-500/20 text-green-400 border-green-500/30";
    if (relevance >= 60) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  };

  const getRankEmoji = (index: number) => {
    const emojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
    return emojis[index] || "📌";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              العودة للرئيسية
            </Button>
          </Link>
          
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center gap-3 mb-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
                <Search className="w-8 h-8 text-white" />
              </div>
            </motion.div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
              البحث الذكي المتقدم
            </h1>
            <p className="text-muted-foreground text-lg">
              ابحث واحصل على نتائج دقيقة ومنظمة مع ملخصات ذكية
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-8"
        >
          <Card className="border-2 border-primary/20 shadow-xl shadow-primary/5 backdrop-blur-sm">
            <CardContent className="p-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="اكتب ما تريد البحث عنه..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-12 pr-4 py-6 text-lg rounded-xl border-2 focus:border-primary transition-all duration-300"
                    data-testid="input-search-query"
                  />
                </div>
                
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={searchType === "web" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSearchType("web")}
                      className="rounded-full"
                      data-testid="button-search-web"
                    >
                      <Globe className="w-4 h-4 mr-1" />
                      ويب
                    </Button>
                    <Button
                      type="button"
                      variant={searchType === "images" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSearchType("images")}
                      className="rounded-full"
                      data-testid="button-search-images"
                    >
                      <ImageIcon className="w-4 h-4 mr-1" />
                      صور
                    </Button>
                    <Button
                      type="button"
                      variant={searchType === "news" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSearchType("news")}
                      className="rounded-full"
                      data-testid="button-search-news"
                    >
                      <TrendingUp className="w-4 h-4 mr-1" />
                      أخبار
                    </Button>
                  </div>
                  
                  <Button
                    type="submit"
                    size="lg"
                    disabled={!query.trim() || isLoading}
                    className="rounded-xl px-8 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20"
                    data-testid="button-submit-search"
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <>
                        <Search className="w-5 h-5 mr-2" />
                        بحث
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <AnimatePresence mode="wait">
          {isLoading || isFetching ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <Skeleton className="w-32 h-24 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-3">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                        <div className="flex gap-2">
                          <Skeleton className="h-6 w-20 rounded-full" />
                          <Skeleton className="h-6 w-24 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          ) : data?.success && data.results ? (
            <motion.div
              key="results"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {data.summary && (
                <motion.div variants={itemVariants}>
                  <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-purple-500/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Sparkles className="w-5 h-5 text-primary" />
                        ملخص ذكي
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-foreground/90 leading-relaxed">{data.summary}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  النتائج ({data.results.length})
                </h2>
                <Badge variant="outline" className="text-muted-foreground">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date().toLocaleTimeString("ar-EG")}
                </Badge>
              </div>

              <div className="grid gap-4">
                {data.results.map((result, index) => (
                  <motion.div key={index} variants={itemVariants}>
                    <Card className="group overflow-hidden hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 hover:border-primary/30 hover:-translate-y-1">
                      <CardContent className="p-0">
                        <div className="flex gap-4 p-4">
                          <div className="relative w-32 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-purple-500/20 flex-shrink-0">
                            {result.image ? (
                              <img
                                src={result.image}
                                alt={result.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Globe className="w-8 h-8 text-primary/50" />
                              </div>
                            )}
                            <div className="absolute top-1 left-1 text-lg">
                              {getRankEmoji(index)}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
                                {result.title}
                              </h3>
                              <Badge 
                                variant="outline" 
                                className={`flex-shrink-0 ${getRelevanceColor(result.relevance)}`}
                              >
                                {result.relevance}%
                              </Badge>
                            </div>
                            
                            <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                              {result.snippet}
                            </p>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  <Globe className="w-3 h-3 mr-1" />
                                  {result.source}
                                </Badge>
                              </div>
                              
                              <a
                                href={result.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                                data-testid={`link-result-${index}`}
                              >
                                زيارة
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : data?.error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-destructive" />
                  </div>
                  <h3 className="text-lg font-semibold text-destructive mb-2">خطأ في البحث</h3>
                  <p className="text-muted-foreground">{data.error}</p>
                </CardContent>
              </Card>
            </motion.div>
          ) : searchTerm ? (
            <motion.div
              key="no-results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="border-muted">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">لا توجد نتائج</h3>
                  <p className="text-muted-foreground">جرب كلمات بحث مختلفة</p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6"
              >
                <Search className="w-12 h-12 text-primary/50" />
              </motion.div>
              <h3 className="text-xl font-semibold text-muted-foreground mb-2">
                ابدأ البحث
              </h3>
              <p className="text-muted-foreground">
                اكتب ما تريد البحث عنه في المربع أعلاه
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
