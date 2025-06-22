import { useState, KeyboardEvent } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Database, 
  Search, 
  Calendar, 
  LogOut,
  ArrowRight,
  Plus,
  Search as SearchIcon,
  Send,
  Sparkles
} from "lucide-react";

interface Stats {
  totalInputs: number;
  totalQueries: number;
  thisWeekInputs: number;
}

interface InputItem {
  id: number;
  content: string;
  category?: string;
  tags?: string;
  createdAt: string;
}

interface Query {
  id: number;
  query: string;
  resultCount: number;
  createdAt: string;
}

interface InputData {
  content: string;
  category?: string;
  tags?: string;
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

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [inputContent, setInputContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SmartSearchResult | null>(null);

  // Mutations for input and search
  const addInputMutation = useMutation({
    mutationFn: async (data: InputData) => {
      const response = await fetch("/api/inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to add input");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Input added successfully",
      });
      setInputContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/inputs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to add input",
        variant: "destructive",
      });
    },
  });

  const smartSearchMutation = useMutation({
    mutationFn: async (data: { query: string }): Promise<SmartSearchResult> => {
      const response = await fetch("/api/smart-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to search");
      return response.json();
    },
    onSuccess: (data: SmartSearchResult) => {
      setSearchResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/queries"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to search",
        variant: "destructive",
      });
    },
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: recentInputs } = useQuery<InputItem[]>({
    queryKey: ["/api/inputs"],
  });

  const { data: recentQueries } = useQuery<Query[]>({
    queryKey: ["/api/queries"],
  });

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

  const handleInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (e.metaKey || e.ctrlKey) {
        // Command/Ctrl + Enter: Add new line
        return;
      } else {
        // Enter: Submit input(s)
        e.preventDefault();
        handleSubmitInput();
      }
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSubmitInput = () => {
    if (!inputContent.trim()) return;

    // Split by lines and process each as separate input
    const lines = inputContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 1) {
      // Single input
      addInputMutation.mutate({ content: inputContent.trim() });
    } else {
      // Multiple inputs - process each line
      lines.forEach((line) => {
        if (line.trim()) {
          addInputMutation.mutate({ content: line.trim() });
        }
      });
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    smartSearchMutation.mutate({ query: searchQuery.trim() });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    if (diffInDays === 1) return "1 day ago";
    return `${diffInDays} days ago`;
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
                <span className="text-primary border-b-2 border-primary pb-4 mb-[-1px] px-1 text-sm font-medium">
                  Dashboard
                </span>
                <Link href="/search" className="text-muted-foreground hover:text-foreground pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Search
                </Link>
                <Link href="/query-history" className="text-muted-foreground hover:text-foreground pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Query History
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">{user?.username}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Add Input Section */}
        <div className="mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Plus className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Add New Input</h2>
              </div>
              <div className="space-y-4">
                <Textarea
                  placeholder="Enter your knowledge (press Enter to submit, Cmd/Ctrl+Enter for new line)"
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  className="min-h-[100px]"
                />
                <div className="flex justify-between items-center">
                  <p className="text-sm text-foreground/70">
                    Press Enter to submit • Cmd/Ctrl+Enter for new line • Multiple lines = multiple inputs
                  </p>
                  <Button
                    onClick={handleSubmitInput}
                    disabled={!inputContent.trim() || addInputMutation.isPending}
                    className="flex items-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{addInputMutation.isPending ? "Saving..." : "Save"}</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Smart Search Section */}
        <div className="mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Smart Search</h2>
              </div>
              <div className="space-y-4">
                <Input
                  placeholder="Ask a question about your knowledge (press Enter to search)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                />
                <div className="flex justify-between items-center">
                  <p className="text-sm text-foreground/70">
                    Press Enter to search • Try: "who are my favorite artists?" or "what do I love?"
                  </p>
                  <Button
                    onClick={handleSearch}
                    disabled={!searchQuery.trim() || smartSearchMutation.isPending}
                    className="flex items-center space-x-2"
                  >
                    <SearchIcon className="w-4 h-4" />
                    <span>{smartSearchMutation.isPending ? "Searching..." : "Search"}</span>
                  </Button>
                </div>
                
                {/* Search Results */}
                {searchResults && (
                  <div className="mt-6 p-4 bg-card/50 rounded-lg border">
                    <h3 className="font-medium mb-2 text-foreground">Search Results:</h3>
                    <div className="space-y-2">
                      {searchResults.answers.map((answer, index) => (
                        <p key={index} className="text-foreground bg-card p-3 rounded border">
                          {answer}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Database className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">{stats?.totalInputs || 0}</h3>
                  <p className="text-sm text-foreground/70">Total Inputs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Search className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">{stats?.totalQueries || 0}</h3>
                  <p className="text-sm text-foreground/70">Total Queries</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">{stats?.thisWeekInputs || 0}</h3>
                  <p className="text-sm text-foreground/70">This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Inputs */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Recent Inputs</h3>
                <Link href="/search" className="text-sm text-primary hover:underline">
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {recentInputs && recentInputs.length > 0 ? (
                  recentInputs.slice(0, 5).map((input) => (
                    <div key={input.id} className="p-3 bg-card/50 rounded-lg border">
                      <p className="text-sm text-foreground mb-1">{input.content}</p>
                      <p className="text-xs text-foreground/70">{formatTimeAgo(input.createdAt)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-foreground/70 text-sm">No inputs yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Queries */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Recent Queries</h3>
                <Link href="/query-history" className="text-sm text-primary hover:underline">
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                {recentQueries && recentQueries.length > 0 ? (
                  recentQueries.slice(0, 5).map((query) => (
                    <div key={query.id} className="p-3 bg-card/50 rounded-lg border">
                      <p className="text-sm text-foreground mb-1">{query.query}</p>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-foreground/70">{formatTimeAgo(query.createdAt)}</p>
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                          {query.resultCount} results
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-foreground/70 text-sm">No queries yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}