import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Database, 
  Search, 
  Calendar, 
  LogOut,
  ArrowRight,
  Plus,
  Search as SearchIcon 
} from "lucide-react";

interface Stats {
  totalInputs: number;
  totalQueries: number;
  thisWeekInputs: number;
}

interface Input {
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

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation("/");
        }, 500);
      }
    },
  });

  const { data: recentInputs } = useQuery<Input[]>({
    queryKey: ["/api/inputs"],
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation("/");
        }, 500);
      }
    },
  });

  const { data: recentQueries } = useQuery<Query[]>({
    queryKey: ["/api/queries"],
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation("/");
        }, 500);
      }
    },
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
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">PersonalBase</h1>
              <nav className="hidden md:flex space-x-8">
                <span className="text-primary border-b-2 border-primary pb-4 mb-[-1px] px-1 text-sm font-medium">
                  Dashboard
                </span>
                <Link href="/add" className="text-gray-500 hover:text-gray-700 pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Add Input
                </Link>
                <Link href="/search" className="text-gray-500 hover:text-gray-700 pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Search
                </Link>
                <Link href="/smart-search" className="text-gray-500 hover:text-gray-700 pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Smart Search
                </Link>
                <Link href="/query-history" className="text-gray-500 hover:text-gray-700 pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Query History
                </Link>
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
            <Button className="flex-1 text-xs font-medium text-primary bg-blue-50">
              Dashboard
            </Button>
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-sm border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-primary bg-opacity-10 rounded-lg">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Inputs</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats?.totalInputs || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Search className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Queries</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats?.totalQueries || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">This Week</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats?.thisWeekInputs || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Inputs */}
            <Card className="shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Recent Inputs</h3>
              </div>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {recentInputs && recentInputs.length > 0 ? (
                    recentInputs.map((input) => (
                      <div key={input.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 leading-relaxed line-clamp-2">
                            {input.content}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTimeAgo(input.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Plus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No inputs yet</p>
                      <Link href="/add">
                        <Button variant="link" className="text-primary hover:text-blue-700 text-sm">
                          Add your first input
                        </Button>
                      </Link>
                    </div>
                  )}
                  {recentInputs && recentInputs.length > 0 && (
                    <div className="pt-2">
                      <Link href="/search">
                        <Button variant="link" className="text-sm text-primary hover:text-blue-700 font-medium p-0">
                          View all inputs <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Queries */}
            <Card className="shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Recent Queries</h3>
              </div>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {recentQueries && recentQueries.length > 0 ? (
                    recentQueries.map((query) => (
                      <div key={query.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="p-1 bg-cyan-100 rounded">
                          <SearchIcon className="h-3 w-3 text-cyan-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 font-medium">{query.query}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            <span>{query.resultCount} result{query.resultCount !== 1 ? 's' : ''}</span> • <span>{formatTimeAgo(query.createdAt)}</span>
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <SearchIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No queries yet</p>
                      <Link href="/search">
                        <Button variant="link" className="text-primary hover:text-blue-700 text-sm">
                          Start searching
                        </Button>
                      </Link>
                    </div>
                  )}
                  {recentQueries && recentQueries.length > 0 && (
                    <div className="pt-2">
                      <Link href="/search">
                        <Button variant="link" className="text-sm text-primary hover:text-blue-700 font-medium p-0">
                          View query history <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
