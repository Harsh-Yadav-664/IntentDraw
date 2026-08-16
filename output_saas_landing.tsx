/* IntentDraw | Regions used: */
import React, { useState } from 'react';
import { Sparkle, Zap, Brain, Rocket, ChevronRight, Menu } from 'lucide-react';

// Reusable GlassCard component for consistent glassmorphism styling
const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`
    bg-white/10 backdrop-blur-md border border-white/20 rounded-[32px] p-8 relative overflow-hidden
    before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300
    ${className}
  `}>
    {children}
  </div>
);

// Reusable Gradient Button component
const GradientButton = ({ children, className = '', outline = false }: { children: React.ReactNode; className?: string; outline?: boolean }) => (
  <button className={`
    font-semibold py-3 px-6 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950
    ${outline
      ? 'bg-transparent border border-purple-400 text-purple-300 hover:bg-purple-900/20'
      : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40'
    }
    ${className}
  `}>
    {children}
  </button>
);

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-hidden">
      {/* Background Gradients for depth and glow - positioned absolutely with blur */}
      <div className="absolute top-[-200px] left-[-200px] w-[500px] h-[500px] bg-gradient-to-br from-purple-800 to-blue-700 rounded-full filter blur-3xl opacity-30 animate-blob mix-blend-screen z-0"></div>
      <div className="absolute bottom-[-300px] right-[-300px] w-[700px] h-[700px] bg-gradient-to-tl from-pink-800 to-indigo-700 rounded-full filter blur-3xl opacity-30 animate-blob animation-delay-2000 mix-blend-screen z-0"></div>
      <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-gradient-to-tr from-green-700 to-teal-600 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-4000 mix-blend-screen z-0"></div>

      {/* Main content wrapper with relative positioning for z-index */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header Section */}
        <header className="flex justify-between items-center py-6">
          <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 tracking-tight">
            IntentFlow
          </div>
          <nav className="hidden md:flex space-x-8 items-center">
            <a href="#" className="text-slate-300 hover:text-white transition-colors duration-200">Features</a>
            <a href="#" className="text-slate-300 hover:text-white transition-colors duration-200">Pricing</a>
            <a href="#" className="text-slate-300 hover:text-white transition-colors duration-200">Contact</a>
            <GradientButton outline>Sign In</GradientButton>
            <GradientButton>Get Started</GradientButton>
          </nav>
          <button
            className="md:hidden text-white"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Open menu"
          >
            <Menu size={28} />
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-20 right-4 bg-white/15 backdrop-blur-lg border border-white/20 rounded-2xl p-6 flex flex-col space-y-4 z-20">
            <a href="#" className="text-slate-200 hover:text-white transition-colors duration-200">Features</a>
            <a href="#" className="text-slate-200 hover:text-white transition-colors duration-200">Pricing</a>
            <a href="#" className="text-slate-200 hover:text-white transition-colors duration-200">Contact</a>
            <GradientButton outline className="w-full">Sign In</GradientButton>
            <GradientButton className="w-full">Get Started</GradientButton>
          </div>
        )}

        {/* Hero Section: Bold Headline & Product Mockup */}
        <section className="text-center py-20 md:py-32 relative">
          <h1 className="text-7xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter leading-none mb-8
            text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600
          ">
            Write Faster.
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto mb-16 px-4">
            Unleash your creativity with AI-powered content generation. From blog posts to ad copy,
            IntentFlow helps you craft compelling narratives in seconds.
          </p>
          <GradientButton className="mb-20">
            Start Free Trial <ChevronRight size={20} className="inline ml-1 -mr-1" />
          </GradientButton>

          {/* Product Dashboard Mockup - a large glassmorphic component */}
          <GlassCard className="max-w-6xl mx-auto p-4 md:p-8 relative mt-16 shadow-2xl shadow-purple-900/50">
            {/* Internal glowing elements for added flair */}
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-purple-500 rounded-full filter blur-2xl opacity-40 animate-pulse-slow"></div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-blue-500 rounded-full filter blur-2xl opacity-40 animate-pulse-slow animation-delay-1000"></div>

            <div className="flex flex-col lg:flex-row gap-6 h-[500px] md:h-[600px] lg:h-[700px]">
              {/* Mockup Sidebar */}
              <div className="w-full lg:w-1/4 bg-black/10 rounded-xl p-4 flex flex-col gap-4 overflow-y-auto">
                <div className="flex items-center gap-2 text-lg font-semibold text-slate-200">
                  <Sparkle size={20} className="text-blue-400" /> New Project
                </div>
                <div className="space-y-2">
                  <div className="bg-white/5 rounded-lg p-3 text-slate-300 cursor-pointer hover:bg-white/10 transition-colors">Blog Post Ideas</div>
                  <div className="bg-white/10 rounded-lg p-3 text-white font-medium cursor-pointer">Ad Copy Generation</div>
                  <div className="bg-white/5 rounded-lg p-3 text-slate-300 cursor-pointer hover:bg-white/10 transition-colors">Social Media Captions</div>
                  <div className="bg-white/5 rounded-lg p-3 text-slate-300 cursor-pointer hover:bg-white/10 transition-colors">Email Templates</div>
                </div>
                <div className="mt-auto pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 text-lg font-semibold text-slate-200">
                    <Rocket size={20} className="text-purple-400" /> Upgrade
                  </div>
                </div>
              </div>
              {/* Mockup Main Editor Area */}
              <div className="flex-1 bg-black/10 rounded-xl p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <h3 className="text-2xl font-bold text-slate-50">Ad Copy for "New Product X"</h3>
                  <div className="flex gap-2">
                    <button className="bg-blue-600/50 text-white rounded-md px-4 py-2 text-sm hover:bg-blue-500/50 transition-colors">Generate</button>
                    <button className="bg-purple-600/50 text-white rounded-md px-4 py-2 text-sm hover:bg-purple-500/50 transition-colors">Save</button>
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded-lg p-4 text-slate-300 leading-relaxed overflow-y-auto custom-scrollbar">
                  <p className="mb-4">
                    "🚀 Launch Your Creativity Sky-High with IntentFlow! Say goodbye to writer's block and hello to endless inspiration. Our cutting-edge AI helps you craft captivating content for any platform, faster than ever before. Try IntentFlow today and transform your writing process!"
                  </p>
                  <p className="mb-4">
                    "💡 Struggling with content creation? IntentFlow is your secret weapon! Generate engaging blog posts, persuasive ad copy, and viral social media captions in minutes, not hours. Unlock your full potential with intelligent suggestions and seamless editing. Get started free!"
                  </p>
                  <p>
                    "✍️ Imagine effortlessly producing high-quality content that resonates with your audience. IntentFlow's intuitive AI assistant understands your needs, delivering fresh ideas and polished drafts with unparalleled speed and accuracy. Elevate your brand's voice – experience the future of writing with IntentFlow!"
                  </p>
                  <p className="mt-4 text-slate-400 italic">
                    (Generated on: 2023-10-27, Tone: Persuasive, Length: Short)
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Feature Cards Section: 3 side-by-side glassmorphic cards */}
        <section className="py-20 md:py-32">
          <h2 className="text-5xl md:text-6xl font-extrabold text-center mb-16
            text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-green-600 tracking-tight
          ">
            Powerful Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <GlassCard className="flex flex-col items-start hover:shadow-xl hover:shadow-teal-900/50 transition-shadow duration-300">
              <div className="p-4 rounded-full bg-blue-500/20 mb-6 border border-blue-400/30">
                <Sparkle size={32} className="text-blue-300" />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-slate-50">AI-Powered Generation</h3>
              <p className="text-slate-300 leading-relaxed">
                Harness the power of advanced AI to generate high-quality, unique content across various formats. From short tweets to long-form articles, get started instantly.
              </p>
              <a href="#" className="mt-6 flex items-center text-blue-400 hover:text-blue-300 transition-colors duration-200 font-semibold">
                Learn More <ChevronRight size={18} className="ml-1" />
              </a>
            </GlassCard>

            <GlassCard className="flex flex-col items-start hover:shadow-xl hover:shadow-purple-900/50 transition-shadow duration-300">
              <div className="p-4 rounded-full bg-purple-500/20 mb-6 border border-purple-400/30">
                <Brain size={32} className="text-purple-300" />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-slate-50">Intelligent Workflows</h3>
              <p className="text-slate-300 leading-relaxed">
                Streamline your content creation process with smart templates, real-time editing, and customizable workflows tailored to your specific needs.
              </p>
              <a href="#" className="mt-6 flex items-center text-purple-400 hover:text-purple-300 transition-colors duration-200 font-semibold">
                Discover More <ChevronRight size={18} className="ml-1" />
              </a>
            </GlassCard>

            <GlassCard className="flex flex-col items-start hover:shadow-xl hover:shadow-green-900/50 transition-shadow duration-300">
              <div className="p-4 rounded-full bg-green-500/20 mb-6 border border-green-400/30">
                <Zap size={32} className="text-green-300" />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-slate-50">Blazing Fast Results</h3>
              <p className="text-slate-300 leading-relaxed">
                Never miss a deadline again. Get instant content suggestions and generate full drafts in a fraction of the time it would take manually.
              </p>
              <a href="#" className="mt-6 flex items-center text-green-400 hover:text-green-300 transition-colors duration-200 font-semibold">
                See How <ChevronRight size={18} className="ml-1" />
              </a>
            </GlassCard>
          </div>
        </section>

        {/* CTA Banner Section: A prominent glassmorphic call to action */}
        <section className="py-20 md:py-32">
          <GlassCard className="text-center p-10 md:p-16 relative overflow-hidden rounded-[32px]
            bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-700/50
            shadow-2xl shadow-blue-900/50
          ">
            {/* Internal blurred circles for more background depth */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-600 rounded-full filter blur-3xl opacity-20 z-0"></div>
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-purple-600 rounded-full filter blur-3xl opacity-20 z-0"></div>

            <h2 className="text-5xl md:text-6xl font-extrabold mb-6 relative z-10
              text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-400
            ">
              Ready to Amplify Your Content?
            </h2>
            <p className="text-xl md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 relative z-10">
              Join thousands of creators who are revolutionizing their writing process with IntentFlow.
              Start creating exceptional content today.
            </p>
            <GradientButton className="text-lg px-8 py-4 relative z-10">
              Get Started for Free <Rocket size={20} className="inline ml-2 -mr-1" />
            </GradientButton>
          </GlassCard>
        </section>

        {/* Footer Section */}
        <footer className="text-center py-10 text-slate-400 text-sm border-t border-white/10 mt-20">
          <p>&copy; {new Date().getFullYear()} IntentFlow. All rights reserved.</p>
          <div className="mt-4 space-x-4">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Cookies</a>
          </div>
        </footer>

      </div>
      {/* Custom Tailwind CSS animations and scrollbar styles */}
      <style>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite cubic-bezier(0.64, 0.0, 0.35, 1);
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.05); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 8s infinite ease-in-out;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(129, 140, 248, 0.5); /* blue-400 */
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(129, 140, 248, 0.7);
        }
      `}</style>
    </div>
  );
}