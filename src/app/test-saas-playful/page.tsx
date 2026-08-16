"use client";
/* IntentDraw | Regions used: NONE */
import React from 'react';
import { Sparkles, Brain, PencilLine, Rocket, MessageCircle } from 'lucide-react';

const Nav = () => (
  <nav className="py-6 px-8 flex items-center justify-between relative z-20">
    <div className="flex items-center space-x-2 text-2xl font-extrabold text-purple-800 tracking-tight">
      <Sparkles className="h-8 w-8 text-pink-500" />
      <span>IntentDraw</span>
    </div>
    <div className="hidden md:flex items-center space-x-8 text-lg font-medium text-purple-700">
      <a href="#" className="hover:text-pink-500 transition-colors">Features</a>
      <a href="#" className="hover:text-pink-500 transition-colors">Pricing</a>
      <a href="#" className="hover:text-pink-500 transition-colors">Blog</a>
      <a href="#" className="hover:text-pink-500 transition-colors">Contact</a>
    </div>
    <div className="flex items-center space-x-4">
      <button className="hidden md:block py-2 px-6 bg-transparent text-purple-700 font-bold rounded-full hover:bg-purple-100 transition-all text-lg">
        Log In
      </button>
      <button className="py-3 px-8 bg-purple-600 text-white font-extrabold rounded-full shadow-[0_12px_30px_rgba(100,0,200,0.2)] hover:bg-purple-700 transition-all text-lg">
        Get Started
      </button>
    </div>
  </nav>
);

const HeroSection = () => (
  <section className="relative py-24 px-8 bg-gradient-to-br from-purple-100 to-pink-100 overflow-hidden text-center flex flex-col items-center justify-center">
    {/* Decorative bubbles */}
    <div className="absolute top-1/4 left-1/4 w-40 h-40 bg-pink-200 rounded-full mix-blend-multiply opacity-50 blur-2xl animate-blob-delay-1"></div>
    <div className="absolute bottom-1/3 right-1/4 w-32 h-32 bg-yellow-200 rounded-full mix-blend-multiply opacity-50 blur-2xl animate-blob-delay-2"></div>
    <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-purple-200 rounded-full mix-blend-multiply opacity-50 blur-2xl animate-blob-delay-3"></div>

    <h1 className="text-6xl md:text-8xl font-extrabold text-purple-950 tracking-tight leading-tight max-w-4xl relative z-10">
      Write Faster. <br /> Create Freely.
    </h1>
    <p className="mt-8 text-2xl text-purple-700 max-w-2xl leading-relaxed relative z-10">
      Unleash your playful genius with AI-powered writing tools designed for joyful creation, not tedious tasks.
    </p>
    <button className="mt-12 py-4 px-10 bg-purple-600 text-white font-extrabold rounded-full text-2xl shadow-[0_15px_40px_rgba(100,0,200,0.3)] hover:bg-purple-700 transition-all transform hover:-translate-y-1 relative z-10">
      Start Your Playdate
    </button>

    {/* Product Dashboard Mockup */}
    <div className="mt-20 w-full max-w-6xl aspect-[16/9] bg-gradient-to-br from-pink-200 to-yellow-200 rounded-3xl shadow-[0_20px_50px_rgba(100,0,200,0.25)] flex items-center justify-center p-8 relative z-10">
      <div className="w-full h-full bg-white rounded-2xl p-6 shadow-inner flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-2">
            <span className="w-3 h-3 bg-red-400 rounded-full"></span>
            <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
            <span className="w-3 h-3 bg-green-400 rounded-full"></span>
          </div>
          <div className="flex-grow flex justify-center">
            <div className="bg-purple-50 text-purple-800 text-sm font-medium py-2 px-6 rounded-full">
              My Awesome Project.docx
            </div>
          </div>
          <div className="flex space-x-2 text-purple-500">
            <Sparkles className="w-5 h-5" />
            <MessageCircle className="w-5 h-5" />
          </div>
        </div>
        <div className="flex-grow flex space-x-6">
          <div className="w-2/3 bg-purple-50 rounded-2xl p-6 text-left text-lg text-purple-800 leading-relaxed font-light">
            <p className="mb-4">
              Once upon a time, in a land filled with fluffy clouds and rainbow rivers, lived a little cloud named Nimbus. Nimbus wasn't like the other clouds; he dreamed of painting the sky with vibrant colors, not just shades of grey.
            </p>
            <p>
              One sunny morning, a wise old unicorn with a glittery mane, named Stardust, floated by. "Nimbus," she whinnied gently, "your dreams are calling! You just need a little magical ink."
            </p>
            <div className="mt-6 p-4 bg-pink-100 rounded-2xl flex items-start space-x-3 shadow-[0_4px_15px_rgba(255,100,150,0.1)]">
              <Sparkles className="w-6 h-6 text-pink-600 mt-1" />
              <div>
                <p className="font-semibold text-pink-700">AI Suggestion:</p>
                <p className="text-pink-800">
                  Perhaps "magical ink" could be more descriptive? How about "starlight essence" or "rainbow dew"?
                </p>
              </div>
            </div>
          </div>
          <div className="w-1/3 bg-yellow-50 rounded-2xl p-6 text-left flex flex-col space-y-4">
            <h3 className="text-xl font-bold text-yellow-800 mb-2">Tools & Wizards</h3>
            <div className="flex items-center space-x-3 p-3 bg-yellow-100 rounded-xl shadow-[0_3px_10px_rgba(255,200,0,0.08)]">
              <Brain className="w-6 h-6 text-yellow-600" />
              <span className="text-yellow-900 font-medium">Idea Generator</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-yellow-100 rounded-xl shadow-[0_3px_10px_rgba(255,200,0,0.08)]">
              <PencilLine className="w-6 h-6 text-yellow-600" />
              <span className="text-yellow-900 font-medium">Style Refiner</span>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-yellow-100 rounded-xl shadow-[0_3px_10px_rgba(255,200,0,0.08)]">
              <Rocket className="w-6 h-6 text-yellow-600" />
              <span className="text-yellow-900 font-medium">Publishing Assistant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const FeaturesSection = () => (
  <section className="py-24 px-8 bg-yellow-50 text-center">
    <h2 className="text-5xl font-extrabold text-purple-950 tracking-tight leading-tight mb-6">
      Magical Tools for Your Mind
    </h2>
    <p className="text-xl text-purple-700 max-w-2xl mx-auto mb-16 leading-relaxed">
      Explore the enchanting features that make writing feel like play, not work.
    </p>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-7xl mx-auto">
      <div className="bg-pink-100 p-10 rounded-3xl shadow-[0_15px_40px_rgba(255,100,150,0.2)] hover:shadow-[0_20px_50px_rgba(255,100,150,0.3)] transition-all transform hover:-translate-y-2">
        <div className="w-20 h-20 bg-pink-300 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_5px_20px_rgba(255,100,150,0.15)]">
          <Brain className="w-10 h-10 text-pink-800" />
        </div>
        <h3 className="text-3xl font-bold text-purple-900 mb-4">Spark Ideas</h3>
        <p className="text-lg text-purple-700 leading-relaxed">
          Stuck in a creative rut? Our AI brainstorming companion generates fresh, whimsical ideas to get your words flowing again. Never face a blank page alone.
        </p>
      </div>

      <div className="bg-purple-100 p-10 rounded-3xl shadow-[0_15px_40px_rgba(100,0,200,0.2)] hover:shadow-[0_20px_50px_rgba(100,0,200,0.3)] transition-all transform hover:-translate-y-2">
        <div className="w-20 h-20 bg-purple-300 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_5px_20px_rgba(100,0,200,0.15)]">
          <PencilLine className="w-10 h-10 text-purple-800" />
        </div>
        <h3 className="text-3xl font-bold text-purple-900 mb-4">Refine & Shine</h3>
        <p className="text-lg text-purple-700 leading-relaxed">
          Polish your prose with a touch of magic. Get suggestions for clearer sentences, bolder vocabulary, and a style that truly reflects your unique voice.
        </p>
      </div>

      <div className="bg-yellow-100 p-10 rounded-3xl shadow-[0_15px_40px_rgba(255,200,0,0.2)] hover:shadow-[0_20px_50px_rgba(255,200,0,0.3)] transition-all transform hover:-translate-y-2">
        <div className="w-20 h-20 bg-yellow-300 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_5px_20px_rgba(255,200,0,0.15)]">
          <Rocket className="w-10 h-10 text-yellow-800" />
        </div>
        <h3 className="text-3xl font-bold text-purple-900 mb-4">Boost Creativity</h3>
        <p className="text-lg text-purple-700 leading-relaxed">
          Access a treasure chest of playful prompts, story starters, and creative templates to unlock endless possibilities and make every writing session an adventure.
        </p>
      </div>
    </div>
  </section>
);

const CtaSection = () => (
  <section className="py-24 px-8 bg-purple-600 text-white text-center relative overflow-hidden">
    {/* Decorative swirls/shapes */}
    <div className="absolute -top-20 -left-20 w-64 h-64 bg-pink-400 rounded-full opacity-10 mix-blend-screen blur-3xl animate-spin-slow"></div>
    <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-yellow-400 rounded-full opacity-10 mix-blend-screen blur-3xl animate-spin-slow-reverse"></div>

    <div className="relative z-10">
      <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
        Ready to Make Writing Fun Again?
      </h2>
      <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-12 leading-relaxed opacity-90">
        Join thousands of happy writers who are transforming their creative process into a delightful journey. It's time to play!
      </p>
      <button className="py-4 px-12 bg-pink-500 text-white font-extrabold rounded-full text-2xl shadow-[0_15px_40px_rgba(255,100,150,0.4)] hover:bg-pink-600 transition-all transform hover:-translate-y-1">
        Let's Get Playful!
      </button>
    </div>
  </section>
);

const Footer = () => (
  <footer className="py-12 px-8 bg-purple-950 text-purple-300 text-center">
    <div className="flex flex-col md:flex-row items-center justify-between max-w-7xl mx-auto">
      <div className="flex items-center space-x-2 text-2xl font-extrabold text-white tracking-tight mb-6 md:mb-0">
        <Sparkles className="h-7 w-7 text-pink-400" />
        <span>IntentDraw</span>
      </div>
      <div className="flex flex-wrap justify-center md:justify-end space-x-8 text-lg font-medium">
        <a href="#" className="hover:text-pink-400 transition-colors mb-2 md:mb-0">Privacy</a>
        <a href="#" className="hover:text-pink-400 transition-colors mb-2 md:mb-0">Terms</a>
        <a href="#" className="hover:text-pink-400 transition-colors mb-2 md:mb-0">Support</a>
        <a href="#" className="hover:text-pink-400 transition-colors mb-2 md:mb-0">Careers</a>
      </div>
    </div>
    <p className="mt-12 text-purple-400 text-sm">
      &copy; {new Date().getFullYear()} IntentDraw. All rights reserved. Dream big, write fun.
    </p>
  </footer>
);

export default function App() {
  return (
    <div className="min-h-screen font-sans bg-pink-50 text-purple-950">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
        .font-sans {
          font-family: 'Poppins', sans-serif;
        }
        @keyframes blob-delay-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes blob-delay-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, 30px) scale(0.95); }
          66% { transform: translate(-10px, -40px) scale(1.2); }
        }
        @keyframes blob-delay-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-50px, 10px) scale(1.05); }
          66% { transform: translate(30px, -30px) scale(0.85); }
        }
        .animate-blob-delay-1 { animation: blob-delay-1 12s infinite alternate ease-in-out; }
        .animate-blob-delay-2 { animation: blob-delay-2 14s infinite alternate ease-in-out; }
        .animate-blob-delay-3 { animation: blob-delay-3 10s infinite alternate ease-in-out; }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-slow-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-slow { animation: spin-slow 60s linear infinite; }
        .animate-spin-slow-reverse { animation: spin-slow-reverse 70s linear infinite; }
      `}} />
      <Nav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}