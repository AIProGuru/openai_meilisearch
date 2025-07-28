
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Scale, RocketIcon, ShieldIcon, BookOpen } from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 sm:pb-16 md:pb-20 lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 lg:mt-16 lg:px-8 xl:mt-20">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block">Your Personal</span>
                  <span className="block text-primary">Legal Assistant</span>
                </h1>
                <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Navigate legal complexities with confidence. Get expert assistance, document management, and legal insights all in one place.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <Button
                      size="lg"
                      className="w-full flex items-center justify-center"
                      onClick={() => navigate("/auth")}
                    >
                      <RocketIcon className="mr-2" />
                      Get Started
                    </Button>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Why Choose Us?
            </h2>
          </div>

          <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-10">
              {/* Feature 1 */}
              <div className="relative">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                  <Scale className="h-6 w-6" />
                </div>
                <div className="mt-5">
                  <h3 className="text-lg font-medium text-gray-900">Expert Legal Guidance</h3>
                  <p className="mt-2 text-base text-gray-500">
                    Get reliable legal assistance and guidance from experienced professionals.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="relative">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                  <ShieldIcon className="h-6 w-6" />
                </div>
                <div className="mt-5">
                  <h3 className="text-lg font-medium text-gray-900">Secure & Confidential</h3>
                  <p className="mt-2 text-base text-gray-500">
                    Your data is protected with enterprise-grade security measures.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="relative">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div className="mt-5">
                  <h3 className="text-lg font-medium text-gray-900">Resource Library</h3>
                  <p className="mt-2 text-base text-gray-500">
                    Access a comprehensive library of legal resources and templates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
