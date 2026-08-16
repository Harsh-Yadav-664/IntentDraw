"use client";
/* IntentDraw | Regions used: None */
import React from 'react';
import { Sparkles, PlugZap, Users, Monitor, PenTool, Search, MessageSquare } from 'lucide-react';

const HeroSection = () => (
  <section className="relative pt-24 pb-32 text-center overflow-hidden">
    {/* Background gradient blur */}
    <div className="absolute inset-x-0 top-1/2 -mt-48 h-96 w-full bg-gradient-to-tr from-blue-600/50 to-purple-600/50 blur-[150px] opacity-70"></div>

    <div className="relative z-10 px-4 max-w-7xl mx-auto">
      <h1 className="text-6xl md:text-8xl lg:text-9xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-blue-300 tracking-tight leading-tight mb-6">
        Write Faster.
      </h1>
      <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto mb-16">
        Harness the power of AI to supercharge your writing process, from ideation to final draft.
      </p>

      {/* Product Dashboard Mockup */}
      <div className="relative w-full max-w-6xl mx-auto h-[350px] md:h-[550px] lg:h-[650px] bg-black/10 backdrop-blur-xl border border-white/20 rounded-[32px] p-6 lg:p-10 flex flex-col shadow-2xl shadow-purple-500/20 overflow-hidden">
        {/* Mockup Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center space-x-3">
            <Monitor className="text-purple-400" size={24} />
            <span className="text-lg font-semibold text-slate-200">IntentDraw Dashboard</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-400">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search documents..."
              className="bg-transparent border border-white/10 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-blue-400 w-32 md:w-48"
            />
          </div>
        </div>

        {/* Mockup Main Content */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sidebar */}
          <div className="hidden md:block col-span-1 bg-white/5 rounded-xl p-4 space-y-4 border border-white/10">
            <h4 className="text-slate-300 font-medium mb-2">Projects</h4>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2 text-blue-300 font-semibold bg-blue-900/30 py-2 px-3 rounded-lg">
                <PenTool size={18} />
                <span>My Article Draft</span>
              </li>
              <li className="flex items-center space-x-2 text-slate-400 hover:text-slate-300 cursor-pointer py-2 px-3 rounded-lg transition-colors">
                <Sparkles size={18} />
                <span>Marketing Copy</span>
              </li>
              <li className="flex items-center space-x-2 text-slate-400 hover:text-slate-300 cursor-pointer py-2 px-3 rounded-lg transition-colors">
                <MessageSquare size={18} />
                <span>Team Chat</span>
              </li>
            </ul>
          </div>

          {/* Editor Area */}
          <div className="col-span-1 md:col-span-2 bg-white/5 rounded-xl p-6 border border-white/10 flex flex-col">
            <h4 className="text-slate-200 text-xl font-bold mb-4">Unleashing Creativity with AI</h4>
            <div className="text-slate-300 text-sm leading-relaxed flex-1 overflow-auto custom-scrollbar">
              <p className="mb-3">
                Welcome to your new writing sanctuary! Here, you can craft compelling content with
                unprecedented speed and precision. Our AI-powered tools seamlessly integrate into
                your workflow, offering suggestions, rephrasing options, and even generating
                entire paragraphs to get you past that writer's block.
              </p>
              <p className="mb-3">
                Imagine never struggling for the right word again. With real-time feedback and
                intelligent insights, your prose will shine brighter than ever. Focus on your ideas,
                and let IntentDraw handle the mechanics.
              </p>
              <p className="text-slate-400 italic">
                AI Suggestion: "Elaborate on the benefits of real-time collaboration for team projects."
              </p>
              <p className="mb-3">
                Team collaboration is effortless. Share documents, leave comments, and track changes
                in a dynamic environment designed to foster collective brilliance. Every team member
                stays on the same page, accelerating project delivery and enhancing communication.
              </p>
            </div>
            <button className="mt-6 self-start bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-2 px-5 rounded-lg text-sm shadow-md hover:opacity-90 transition-opacity">
              Continue Writing
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const FeatureCardsSection = () => (
  <section className="relative py-24 overflow-hidden">
    {/* Background gradient blur */}
    <div className="absolute inset-x-0 -bottom-1/4 h-96 w-full bg-gradient-to-bl from-purple-700/50 to-pink-600/50 blur-[150px] opacity-60"></div>

    <div className="relative z-10 px-4 max-w-7xl mx-auto">
      <h2 className="text-4xl md:text-5xl font-extrabold text-center text-slate-100 mb-16">
        Unlock Your Writing Potential
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Feature Card 1 */}
        <div className="bg-black/10 backdrop-blur-md border border-white/20 rounded-[32px] p-8 flex flex-col items-start space-y-5 shadow-xl shadow-purple-500/10 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 transform hover:-translate-y-2">
          <Sparkles className="text-blue-400" size={48} strokeWidth={1.5} />
          <h3 className="text-3xl font-bold text-slate-100">AI-Powered Autocomplete</h3>
          <p className="text-lg text-slate-300">
            Never face writer's block again. Our intelligent AI suggests words, phrases, and even
            full sentences in real-time as you type, streamlining your creative flow.
          </p>
        </div>

        {/* Feature Card 2 */}
        <div className="bg-black/10 backdrop-blur-md border border-white/20 rounded-[32px] p-8 flex flex-col items-start space-y-5 shadow-xl shadow-blue-500/10 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 transform hover:-translate-y-2">
          <PlugZap className="text-purple-400" size={48} strokeWidth={1.5} />
          <h3 className="text-3xl font-bold text-slate-100">Seamless Integration</h3>
          <p className="text-lg text-slate-300">
            Connect IntentDraw with your favorite tools and platforms. Export directly, collaborate
            with ease, and maintain your existing workflow without interruption.
          </p>
        </div>

        {/* Feature Card 3 */}
        <div className="bg-black/10 backdrop-blur-md border border-white/20 rounded-[32px] p-8 flex flex-col items-start space-y-5 shadow-xl shadow-pink-500/10 hover:shadow-2xl hover:shadow-pink-500/20 transition-all duration-300 transform hover:-translate-y-2">
          <Users className="text-teal-400" size={48} strokeWidth={1.5} />
          <h3 className="text-3xl font-bold text-slate-100">Real-time Collaboration</h3>
          <p className="text-lg text-slate-300">
            Work together effortlessly. Share documents, track changes, and provide feedback
            instantly, fostering a truly collaborative writing environment.
          </p>
        </div>
      </div>
    </div>
  </section>
);

const CTABannerSection = () => (
  <section className="relative py-24 overflow-hidden">
    {/* Background gradient blur */}
    <div className="absolute inset-x-0 top-1/2 -mt-48 h-96 w-full bg-gradient-to-tr from-cyan-600/50 to-blue-600/50 blur-[150px] opacity-70"></div>

    <div className="relative z-10 px-4 max-w-5xl mx-auto">
      <div className="bg-black/10 backdrop-blur-xl border border-white/20 rounded-[32px] p-12 lg:p-16 text-center shadow-2xl shadow-blue-500/20">
        <h2 className="text-4xl md:text-5xl font-extrabold text-slate-100 leading-tight mb-6">
          Ready to Write Smarter?
        </h2>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
          Join thousands of writers who are transforming their productivity with IntentDraw.
          Start your journey to faster, better writing today.
        </p>
        <button className="bg-gradient-to-br from-purple-600 to-blue-500 text-white font-bold py-4 px-10 rounded-full text-lg shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all duration-300 transform hover:-translate-y-1">
          Get Started for Free
        </button>
      </div>
    </div>
  </section>
);

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-hidden">
      <HeroSection />
      <FeatureCardsSection />
      <CTABannerSection />
    </div>
  );
}