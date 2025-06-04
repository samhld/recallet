import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { LogOut, Search, ExternalLink, Tags } from "lucide-react";

interface SearchData {
  query: string;
  category?: string;
}

interface SearchResult {
  id: number;
  content: string;
  category?: string;
  tags?: string;
  createdAt: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/");
      }, 500);
    }
  }, [user, toast, setLocation]);

  const searchMutation = useMutation({
    mutationFn: async (data: SearchData) => {
      const response = await apiRequest("POST", "/api/search", data);
      return await response.json();
    },
    onSuccess: (data) => {
      setResults(data);
      setHasSearched(true);
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation("/");
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to search",
        variant: "destructive",
      });
    },
  });

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      toast({
        title: "Error",
        description: "Please enter a search query",
        variant: "destructive",
      });
      return;
    }

    searchMutation.mutate({
      query: query.trim(),
      category: category && category !== "all" ? category : undefined,
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200">{part}</span>
      ) : (
        part
      )
    );
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'meeting': return 'bg-blue-100 text-blue-800';
      case 'research': return 'bg-green-100 text-green-800';
      case 'idea': return 'bg-purple-100 text-purple-800';
      case 'learning': return 'bg-orange-100 text-orange-800';
      case 'personal': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Recallet</h1>
              <nav className="hidden md:flex space-x-8">
                <Link href="/" className="text-gray-500 hover:text-gray-700 pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Dashboard
                </Link>
                <Link href="/add" className="text-gray-500 hover:text-gray-700 pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Add Input
                </Link>
                <span className="text-primary border-b-2 border-primary pb-4 mb-[-1px] px-1 text-sm font-medium">
                  Search
                </span>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user?.username}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-white border-b border-gray-200">
        <div className="px-4 py-2">
          <div className="flex space-x-4">
            <Link href="/" className="flex-1">
              <Button variant="ghost" className="w-full text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                Dashboard
              </Button>
            </Link>
            <Link href="/add" className="flex-1">
              <Button variant="ghost" className="w-full text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                Add
              </Button>
            </Link>
            <Button className="flex-1 text-sm font-medium text-primary bg-blue-50">
              Search
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Search Interface */}
          <Card className="shadow-sm border border-gray-200">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Search Your Knowledge Base</h2>
                  <p className="text-sm text-gray-600">Find information from your stored inputs using keywords</p>
                </div>
                <form onSubmit={handleSearch} className="flex space-x-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search your inputs..."
                      className="pl-10 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="bg-primary text-white hover:bg-blue-700 font-medium"
                    disabled={searchMutation.isPending}
                  >
                    {searchMutation.isPending ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Searching...
                      </div>
                    ) : (
                      "Search"
                    )}
                  </Button>
                </form>
                {/* Search Filters */}
                <div className="flex flex-wrap gap-3">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-40 text-sm focus:ring-2 focus:ring-primary focus:border-transparent">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="meeting">Meeting Notes</SelectItem>
                      <SelectItem value="research">Research</SelectItem>
                      <SelectItem value="idea">Ideas</SelectItem>
                      <SelectItem value="learning">Learning</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search Results */}
          {hasSearched && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Search Results
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({results.length} found)
                  </span>
                </h3>
              </div>

              {results.length === 0 ? (
                <Card className="shadow-sm border border-gray-200">
                  <CardContent className="p-12 text-center">
                    <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                    <p className="text-gray-600 mb-4">
                      Try adjusting your search terms or removing filters
                    </p>
                    <Link href="/add">
                      <Button className="bg-primary text-white hover:bg-blue-700">
                        Add New Input
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {results.map((result) => (
                    <Card key={result.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            {result.category && (
                              <Badge className={`text-xs font-medium ${getCategoryColor(result.category)}`}>
                                {result.category.charAt(0).toUpperCase() + result.category.slice(1)}
                              </Badge>
                            )}
                            <span className="text-sm text-gray-500">{formatDate(result.createdAt)}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-gray-900 leading-relaxed">
                            {highlightSearchTerm(result.content, query)}
                          </p>
                          {result.tags && (
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span className="flex items-center">
                                <Tags className="h-3 w-3 mr-1" />
                                {result.tags}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {!hasSearched && (
            <Card className="shadow-sm border border-gray-200">
              <CardContent className="p-12 text-center">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Search your knowledge base</h3>
                <p className="text-gray-600">
                  Enter keywords to find information from your stored inputs
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
