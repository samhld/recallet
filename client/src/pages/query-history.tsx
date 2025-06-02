import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import { LogOut, ChevronDown, ChevronRight, History, Database } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Query {
  id: number;
  query: string;
  resultCount: number;
  entities: string[] | null;
  relationship: string | null;
  postgresQuery: string | null;
  createdAt: string;
}

export default function QueryHistoryPage() {
  const [expandedQueries, setExpandedQueries] = useState<Set<number>>(new Set());
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

  const { data: queries, isLoading, error } = useQuery({
    queryKey: ["/api/queries"],
    retry: false,
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/");
      }, 500);
    }
  }, [error, toast, setLocation]);

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

  const toggleExpanded = (queryId: number) => {
    const newExpanded = new Set(expandedQueries);
    if (newExpanded.has(queryId)) {
      newExpanded.delete(queryId);
    } else {
      newExpanded.add(queryId);
    }
    setExpandedQueries(newExpanded);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getQueryDetails = (query: Query) => ({
    entities: query.entities || [],
    relationship: query.relationship || "Unknown",
    postgresQuery: query.postgresQuery || "No query data available"
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">PersonalBase</h1>
              <nav className="hidden md:flex space-x-8">
                <Link href="/" className="text-gray-500 hover:text-gray-700 pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Dashboard
                </Link>
                <Link href="/add" className="text-gray-500 hover:text-gray-700 pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Add Input
                </Link>
                <Link href="/search" className="text-gray-500 hover:text-gray-700 pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Search
                </Link>
                <Link href="/smart-search" className="text-gray-500 hover:text-gray-700 pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Smart Search
                </Link>
                <span className="text-primary border-b-2 border-primary pb-4 mb-[-1px] px-1 text-sm font-medium">
                  Query History
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
            <Link href="/smart-search" className="flex-1">
              <Button variant="ghost" className="w-full text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                Smart
              </Button>
            </Link>
            <Button className="flex-1 text-xs font-medium text-primary bg-blue-50">
              History
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex items-center space-x-3">
            <History className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-gray-900">Query History</h2>
          </div>

          {/* Query List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : queries && queries.length > 0 ? (
            <div className="space-y-4">
              {queries.map((query: Query) => {
                const details = getQueryDetails(query);
                const isExpanded = expandedQueries.has(query.id);
                
                return (
                  <Card key={query.id} className="shadow-sm border border-gray-200">
                    <Collapsible>
                      <CollapsibleTrigger 
                        className="w-full p-0"
                        onClick={() => toggleExpanded(query.id)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              )}
                              <div className="text-left">
                                <p className="font-medium text-gray-900">{query.query}</p>
                                <p className="text-sm text-gray-500">{formatDate(query.createdAt)}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Badge variant="outline">
                                {query.resultCount} results
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="px-6 pb-6 border-t border-gray-100">
                          <div className="pt-4 space-y-4">
                            
                            {/* Query Analysis */}
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                Query Analysis
                              </h4>
                              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                <div>
                                  <span className="text-sm font-medium text-gray-600">Entities: </span>
                                  {details.entities.map((entity, index) => (
                                    <Badge key={index} variant="secondary" className="mr-2">
                                      {entity}
                                    </Badge>
                                  ))}
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-gray-600">Relationship: </span>
                                  <Badge variant="outline">{details.relationship}</Badge>
                                </div>
                              </div>
                            </div>

                            {/* Database Query */}
                            <div>
                              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                                <Database className="h-4 w-4 mr-2 text-gray-600" />
                                PostgreSQL Query
                              </h4>
                              <div className="bg-gray-900 rounded-lg p-4">
                                <pre className="text-sm text-gray-100 font-mono overflow-x-auto">
                                  {details.postgresQuery}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="shadow-sm border border-gray-200">
              <CardContent className="p-12 text-center">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No queries yet</h3>
                <p className="text-gray-600 mb-4">
                  Start using Smart Search to build your query history
                </p>
                <Link href="/smart-search">
                  <Button className="bg-primary text-white hover:bg-blue-700">
                    Try Smart Search
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}