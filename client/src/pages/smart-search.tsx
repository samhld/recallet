import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { LogOut, Search, Brain } from "lucide-react";

interface SmartSearchData {
  query: string;
}

interface SmartSearchResult {
  query: {
    entities: string[];
    relationship: string;
  };
  answers: string[];
  entities: string[];
  relationship: string;
}

export default function SmartSearchPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SmartSearchResult | null>(null);
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

  const smartSearchMutation = useMutation({
    mutationFn: async (data: SmartSearchData) => {
      const response = await apiRequest("POST", "/api/smart-search", data);
      return await response.json();
    },
    onSuccess: (data) => {
      setResult(data);
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
        description: "Smart search failed",
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

    smartSearchMutation.mutate({
      query: query.trim(),
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

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img 
                src="/recallet-logo.png" 
                alt="Recallet" 
                className="h-8 w-auto"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling;
                  if (fallback) fallback.style.display = 'block';
                }}
              />
              <h1 className="text-2xl font-bold text-foreground" style={{ display: 'none' }}>Recallet</h1>
              <nav className="hidden md:flex space-x-8">
                <Link href="/" className="text-muted-foreground hover:text-foreground pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Dashboard
                </Link>
                <Link href="/add" className="text-muted-foreground hover:text-foreground pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Add Input
                </Link>
                <Link href="/search" className="text-muted-foreground hover:text-foreground pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Search
                </Link>
                <span className="text-primary border-b-2 border-primary pb-4 mb-[-1px] px-1 text-sm font-medium">
                  Smart Search
                </span>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">{user?.username}</span>
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
          <div className="flex space-x-2">
            <Link href="/" className="flex-1">
              <Button variant="ghost" className="w-full text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                Dashboard
              </Button>
            </Link>
            <Link href="/add" className="flex-1">
              <Button variant="ghost" className="w-full text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                Add
              </Button>
            </Link>
            <Link href="/search" className="flex-1">
              <Button variant="ghost" className="w-full text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                Search
              </Button>
            </Link>
            <Button className="flex-1 text-xs font-medium text-primary bg-blue-50">
              Smart
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Search Interface */}
          <Card className="shadow-sm border border-border">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-2 flex items-center">
                    <Brain className="h-5 w-5 mr-2 text-primary" />
                    Smart Search
                  </h2>
                  <p className="text-sm text-foreground/70">Ask natural language questions about your knowledge base</p>
                </div>
                <form onSubmit={handleSearch} className="flex space-x-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-foreground/50" />
                    <Input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ask a question like 'Who are my favorite artists?'"
                      className="pl-10 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="bg-primary text-white hover:bg-blue-700 font-medium"
                    disabled={smartSearchMutation.isPending}
                  >
                    {smartSearchMutation.isPending ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Thinking...
                      </div>
                    ) : (
                      "Ask"
                    )}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          {/* Search Results */}
          {hasSearched && result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  Smart Search Results
                </h3>
              </div>

              {/* Query Analysis */}
              <Card className="shadow-sm border border-border">
                <CardContent className="p-6">
                  <h4 className="font-medium text-foreground mb-3">Query Analysis</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-foreground/70">Entities: </span>
                      {result.entities.map((entity, index) => (
                        <Badge key={index} variant="secondary" className="mr-2">
                          {entity}
                        </Badge>
                      ))}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Relationship: </span>
                      <Badge variant="outline">{result.relationship}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Answers */}
              <Card className="shadow-sm border border-gray-200">
                <CardContent className="p-6">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Answers ({result.answers.length} found)
                  </h4>
                  {result.answers.length === 0 ? (
                    <div className="text-center py-8">
                      <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No answers found</h3>
                      <p className="text-gray-600 mb-4">
                        Try asking a different question or add more inputs to your knowledge base
                      </p>
                      <Link href="/add">
                        <Button className="bg-primary text-white hover:bg-blue-700">
                          Add New Input
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {result.answers.map((answer, index) => (
                        <div key={index} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-green-900 font-medium">{answer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {!hasSearched && (
            <Card className="shadow-sm border border-gray-200">
              <CardContent className="p-12 text-center">
                <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ask intelligent questions</h3>
                <p className="text-gray-600 mb-4">
                  Use natural language to query your knowledge base. Try questions like:
                </p>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>"Who are my favorite artists?"</p>
                  <p>"What does my girlfriend like?"</p>
                  <p>"Which bands do I love?"</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}