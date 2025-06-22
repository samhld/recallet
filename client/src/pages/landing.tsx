import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Landing() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { login, register, isLoginLoading, isRegisterLoading } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isLogin) {
        await login({ username, password });
      } else {
        await register({ username, password });
      }
      toast({
        title: "Success",
        description: isLogin ? "Logged in successfully" : "Account created successfully",
      });
    } catch (error) {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "Invalid credentials",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: (error as Error).message || "Authentication failed",
          variant: "destructive",
        });
      }
    }
  };

  const isLoading = isLoginLoading || isRegisterLoading;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%)'}}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="text-center">
              <img 
                src="/recallet-logo.png" 
                alt="Recallet - Your Second Memory" 
                className="h-20 w-auto mx-auto"
                onError={(e) => {
                  console.error('Image failed to load, falling back to text');
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling;
                  if (fallback) fallback.style.display = 'block';
                }}
              />
              <div style={{ display: 'none' }} className="text-center">
                <h1 className="text-4xl font-bold text-white tracking-wider">RECALLET</h1>
                <p className="text-white text-sm tracking-widest opacity-80">YOUR SECOND MEMORY</p>
              </div>
            </div>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-8">
            {/* Auth Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
              <Button
                type="button"
                variant={isLogin ? "default" : "ghost"}
                className={`flex-1 text-sm font-medium ${
                  isLogin 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => setIsLogin(true)}
              >
                Login
              </Button>
              <Button
                type="button"
                variant={!isLogin ? "default" : "ghost"}
                className={`flex-1 text-sm font-medium ${
                  !isLogin 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => setIsLogin(false)}
              >
                Register
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Username
                </Label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isLogin ? "Enter your username" : "Choose a username"}
                  required
                  className="focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isLogin ? "Enter your password" : "Create a password"}
                  required
                  className="focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Confirm Password
                  </Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                    className="focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-primary text-white hover:bg-blue-700 font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isLogin ? "Signing In..." : "Creating Account..."}
                  </div>
                ) : (
                  isLogin ? "Sign In" : "Create Account"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
