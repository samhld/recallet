import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { LogOut, Save, RotateCcw } from "lucide-react";

interface InputData {
  content: string;
  category?: string;
  tags?: string;
}

export default function AddInput() {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const createInputMutation = useMutation({
    mutationFn: async (data: InputData) => {
      const response = await apiRequest("POST", "/api/inputs", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inputs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Success",
        description: "Input saved successfully!",
      });
      setContent("");
      setCategory("");
      setTags("");
      setLocation("/");
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
        description: "Failed to save input",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Content is required",
        variant: "destructive",
      });
      return;
    }

    createInputMutation.mutate({
      content: content.trim(),
      category: category || undefined,
      tags: tags || undefined,
    });
  };

  const handleClear = () => {
    setContent("");
    setCategory("");
    setTags("");
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
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">PersonalBase</h1>
              <nav className="hidden md:flex space-x-8">
                <Link href="/" className="text-gray-500 hover:text-gray-700 pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Dashboard
                </Link>
                <span className="text-primary border-b-2 border-primary pb-4 mb-[-1px] px-1 text-sm font-medium">
                  Add Input
                </span>
                <Link href="/search" className="text-gray-500 hover:text-gray-700 pb-4 mb-[-1px] px-1 text-sm font-medium transition-colors">
                  Search
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
          <div className="flex space-x-4">
            <Link href="/" className="flex-1">
              <Button variant="ghost" className="w-full text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                Dashboard
              </Button>
            </Link>
            <Button className="flex-1 text-sm font-medium text-primary bg-blue-50">
              Add
            </Button>
            <Link href="/search" className="flex-1">
              <Button variant="ghost" className="w-full text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                Search
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Input</h2>
              <p className="text-sm text-gray-600 mt-1">Store information that you can query later</p>
            </div>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Category <span className="text-gray-400">(optional)</span>
                  </Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="focus:ring-2 focus:ring-primary focus:border-transparent">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">Meeting Notes</SelectItem>
                      <SelectItem value="research">Research</SelectItem>
                      <SelectItem value="idea">Ideas</SelectItem>
                      <SelectItem value="learning">Learning</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Tags <span className="text-gray-400">(optional)</span>
                  </Label>
                  <Input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Enter tags separated by commas"
                    className="focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500">Use tags to make your content easier to find</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Content</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    placeholder="Enter your information here..."
                    className="focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    required
                  />
                  <p className="text-xs text-gray-500">Be specific and detailed to improve search results</p>
                </div>

                <div className="flex space-x-3">
                  <Button
                    type="submit"
                    className="flex-1 bg-primary text-white hover:bg-blue-700 font-medium"
                    disabled={createInputMutation.isPending}
                  >
                    {createInputMutation.isPending ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Input
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClear}
                    className="px-4 border border-gray-300 text-gray-700 hover:bg-gray-50"
                    disabled={createInputMutation.isPending}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
