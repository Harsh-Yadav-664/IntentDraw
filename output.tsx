/* IntentDraw | Regions used: R1, R2, R3, R4, R5, R6, R7, R8, R9, R10 */
import React from 'react';
import {
  Sparkles, // For brand logo
  Zap, // Example feature icon
  LayoutDashboard, // For dashboard mockup placeholder
  ArrowDown, // For directional arrow
  Wand2, // Feature 1 icon
  Rocket, // Feature 2 icon
  Lightbulb, // Feature 3 icon
} from 'lucide-react';

// <!-- LOCKED:R1 -->
const Region1 = () => (
  <nav className="px-8 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
    <div className="flex items-center space-x-2">
      <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
      <span className="text-xl font-bold text-slate-900 dark:text-slate-50">IntentDraw</span>
    </div>
    <div className="hidden md:flex space-x-6">
      <a href="#" className="text-sm font-medium text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-colors">Features</a>
      <a href="#" className="text-sm font-medium text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-colors">Pricing</a>
      <a href="#" className="text-sm font-medium text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-colors">About</a>
      <a href="#" className="text-sm font-medium text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-colors">Contact</a>
    </div>
    <div className="flex items-center space-x-4">
      <button className="text-sm font-medium text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-colors">Sign In</button>
      <button className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors shadow dark:bg-indigo-500 dark:hover:bg-indigo-600">Get Started</button>
    </div>
  </nav>
);

// <!-- LOCKED:R2 -->
const Region2 = () => (
  <section className="container mx-auto px-6 text-center pt-16">
    <h1 className="text-6xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
      Write Faster
    </h1>
  </section>
);

// <!-- LOCKED:R3 -->
const Region3 = () => (
  <div className="flex justify-center -mt-4"> {/* Adjusted margin to sit visually below R2 */}
    <svg width="250" height="20" viewBox="0 0 250 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="block text-indigo-500 dark:text-indigo-400">
      <path d="M5 10 C 60 0, 190 20, 245 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  </div>
);

// <!-- LOCKED:R4 -->
const Region4 = () => (
  <div className="flex justify-center items-center py-4">
    <ArrowDown className="h-10 w-10 text-slate-400 dark:text-slate-600 animate-bounce" />
  </div>
);

// <!-- LOCKED:R5 -->
const Region5 = () => (
  <section className="container mx-auto px-6 mt-8">
    <div className="relative bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-8 shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[400px] flex items-center justify-center">
      {/* Dashboard Mockup Content */}
      <div className="absolute top-4 left-4 flex space-x-2">
        <span className="block h-3 w-3 rounded-full bg-red-500"></span>
        <span className="block h-3 w-3 rounded-full bg-yellow-400"></span>
        <span className="block h-3 w-3 rounded-full bg-green-500"></span>
      </div>
      <div className="absolute top-4 right-4 text-sm text-slate-500 dark:text-slate-400">
        <LayoutDashboard className="inline-block mr-2 h-4 w-4" />
        Live Dashboard Preview
      </div>
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-slate-700 dark:text-slate-200 mb-2">Your Creative Hub</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Access all your writing tools and insights in one intuitive dashboard.
        </p>
        <button className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg text-base font-medium hover:bg-indigo-700 transition-colors shadow-md dark:bg-indigo-500 dark:hover:bg-indigo-600">
          Explore Dashboard
        </button>
      </div>
    </div>
  </section>
);

// <!-- LOCKED:R6 -->
const Region6 = () => (
  <div className="relative w-full overflow-hidden mt-16">
    <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="block w-full h-auto text-slate-100 dark:text-slate-900">
      {/* This SVG is a simple wave. Its color matches the background of the section below it */}
      <path d="M0 0C240 60 480 80 720 80C960 80 1200 60 1440 0V100H0V0Z" fill="currentColor"/>
    </svg>
    {/* Optional gradient to blend into page background */}
    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-950 opacity-50 z-10"></div>
  </div>
);

// <!-- LOCKED:R7 -->
const Region7 = () => (
  <div className="p-6 bg-white dark:bg-slate-900 rounded-lg shadow-md border border-slate-200 dark:border-slate-800 text-center">
    <div className="p-3 bg-indigo-50 dark:bg-indigo-950 rounded-full inline-flex items-center justify-center mb-4">
      <Wand2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
    </div>
    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-2">AI-Powered Creation</h3>
    <p className="text-slate-600 dark:text-slate-400 text-sm">Generate compelling content with intelligent suggestions and tools.</p>
  </div>
);

// <!-- LOCKED:R8 -->
const Region8 = () => (
  <div className="p-6 bg-white dark:bg-slate-900 rounded-lg shadow-md border border-slate-200 dark:border-slate-800 text-center">
    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-full inline-flex items-center justify-center mb-4">
      <Rocket className="h-6 w-6 text-green-600 dark:text-green-400" />
    </div>
    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-2">Boost Productivity</h3>
    <p className="text-slate-600 dark:text-slate-400 text-sm">Streamline your workflow and save precious time on every project.</p>
  </div>
);

// <!-- LOCKED:R9 -->
const Region9 = () => (
  <div className="p-6 bg-white dark:bg-slate-900 rounded-lg shadow-md border border-slate-200 dark:border-slate-800 text-center">
    <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-full inline-flex items-center justify-center mb-4">
      <Lightbulb className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
    </div>
    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-2">Innovative Insights</h3>
    <p className="text-slate-600 dark:text-slate-400 text-sm">Gain valuable data-driven insights to refine your writing strategy.</p>
  </div>
);

// <!-- LOCKED:R10 -->
const Region10 = () => (
  <section className="bg-indigo-600 dark:bg-indigo-700 text-white py-12 px-8 rounded-lg shadow-xl text-center">
    <h2 className="text-4xl font-extrabold mb-4">Ready to Write Faster?</h2>
    <p className="text-indigo-100 dark:text-indigo-200 max-w-2xl mx-auto mb-8">
      Join thousands of satisfied users who are revolutionizing their content creation process.
    </p>
    <button className="px-8 py-4 bg-white text-indigo-600 dark:bg-slate-800 dark:text-indigo-300 rounded-lg text-lg font-bold hover:bg-gray-100 dark:hover:bg-slate-900 transition-colors shadow-lg">
      Start Your Free Trial
    </button>
  </section>
);

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50 font-sans antialiased">
      <div className="w-full flex flex-col gap-8">
        {/* ROW 1: Full width */}
        <div className="w-full">
          <Region1 />
        </div>
        {/* ROW 2: Full width */}
        <div className="w-full">
          <Region2 />
        </div>
        {/* ROW 3: 2 columns */}
        {/* This row contains the underline (R3) and the arrow (R4).
            The skeleton mandates a flex-row. We'll center their actual content. */}
        <div className="w-full flex flex-col md:flex-row gap-6 justify-center items-center px-6">
          <div style={{ flexBasis: '40%' }} className="flex-grow flex justify-center items-center">
            <Region3 />
          </div>
          <div style={{ flexBasis: '5%' }} className="flex-grow flex justify-center items-center">
            <Region4 />
          </div>
        </div>
        {/* ROW 4: Full width */}
        <div className="w-full">
          <Region5 />
        </div>
        {/* ROW 5: Full width */}
        <div className="w-full">
          <Region6 />
        </div>
        {/* ROW 6: 3 columns */}
        <div className="w-full flex flex-col md:flex-row gap-6 container mx-auto px-6 mt-16">
          <div style={{ flexBasis: '20%' }} className="flex-grow">
            <Region7 />
          </div>
          <div style={{ flexBasis: '20%' }} className="flex-grow">
            <Region8 />
          </div>
          <div style={{ flexBasis: '20%' }} className="flex-grow">
            <Region9 />
          </div>
        </div>
        {/* ROW 7: Full width */}
        <div className="w-full mt-16 pb-16 px-6 container mx-auto">
          <Region10 />
        </div>
      </div>
    </div>
  );
}