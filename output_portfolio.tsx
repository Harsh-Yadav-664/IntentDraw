/* IntentDraw | Regions used: None */
import React from 'react';
import { Camera, ChevronRight } from 'lucide-react';

// Using a custom type for ImageItem for better structure
type ImageItem = {
  src: string;
  alt: string;
  title: string;
  category: string;
};

// Inventing realistic-sounding placeholder content and Unsplash image URLs
const imageItems: ImageItem[] = [
  {
    src: "https://images.unsplash.com/photo-1510414441221-f09d846b0a09?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    alt: "Misty mountain landscape at dawn with soft light",
    title: "Silent Peaks, Golden Hour",
    category: "Landscape",
  },
  {
    src: "https://images.unsplash.com/photo-1502622340-e17b88ec7b08?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    alt: "Abstract architectural detail of a modern building",
    title: "Urban Facade, Reflected Light",
    category: "Architecture",
  },
  {
    src: "https://images.unsplash.com/photo-1498642730303-34e9e4367ef2?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    alt: "Portrait of a thoughtful woman with natural light",
    title: "Glimmer of Resilience",
    category: "Portrait",
  },
  {
    src: "https://images.unsplash.com/photo-1549495758-c99026d3d9d5?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB3MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    alt: "Close-up of a delicate flower with soft focus background",
    title: "Botanical Whisper",
    category: "Nature",
  },
  {
    src: "https://images.unsplash.com/photo-1516082490790-280b1807d9c6?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    alt: "Rugged coastline with waves crashing against rocks",
    title: "Coastal Fury, Untamed",
    category: "Seascape",
  },
  {
    src: "https://images.unsplash.com/photo-1515902098495-92762a4d0f62?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    alt: "Minimalist street scene with a lone figure walking",
    title: "Solitude in Motion",
    category: "Street",
  },
  {
    src: "https://images.unsplash.com/photo-1534067980556-91e0a816174d?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    alt: "Vast desert landscape with rolling sand dunes under clear sky",
    title: "Echoes of the Sand",
    category: "Desert",
  },
  {
    src: "https://images.unsplash.com/photo-1506540502179-c5c7d0d0c3f5?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    alt: "Intricate details of a vintage camera lens",
    title: "The Observer's Eye",
    category: "Still Life",
  },
];

const PhotoCard: React.FC<{ item: ImageItem }> = ({ item }) => (
  <div className="group relative overflow-hidden bg-white border border-slate-100 rounded-sm">
    <img
      src={item.src}
      alt={item.alt}
      className="w-full h-72 object-cover object-center transition-transform duration-500 ease-in-out group-hover:scale-105"
    />
    <div className="p-4">
      <h3 className="text-xl font-serif text-slate-900 leading-tight mb-1">{item.title}</h3>
      <p className="text-sm font-sans text-slate-500 uppercase tracking-wide">{item.category}</p>
    </div>
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-4">
        <button className="flex items-center text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
            View Details <ChevronRight size={16} className="ml-1" />
        </button>
    </div>
  </div>
);


export default function App() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 font-sans antialiased">
      {/* Header/Hero Section */}
      <header className="max-w-6xl mx-auto px-6 pt-24 pb-16 md:pb-24 border-b border-slate-200">
        <h1 className="font-serif text-6xl md:text-7xl font-light text-slate-900 leading-tight mb-4 tracking-tight">
          The Art of Light
        </h1>
        <p className="text-xl md:text-2xl font-light text-slate-700 max-w-3xl mb-8">
          A curated collection of exceptional photography, exploring narratives through light, shadow, and form.
          Each image tells a story, captured with precision and artistic vision.
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <button className="flex items-center px-6 py-3 bg-slate-900 text-white text-sm uppercase tracking-wide font-medium rounded-sm hover:bg-slate-700 transition-colors duration-200">
            Explore Portfolio <ChevronRight size={18} className="ml-2" />
          </button>
          <button className="flex items-center px-6 py-3 border border-slate-300 text-slate-800 text-sm uppercase tracking-wide font-medium rounded-sm hover:bg-slate-100 transition-colors duration-200">
            Contact Artist
          </button>
        </div>
      </header>

      {/* Portfolio Grid Section */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="font-serif text-5xl font-light text-slate-900 mb-12 border-b border-slate-200 pb-4">
          Featured Works
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {imageItems.map((item, index) => {
            let classes = "";
            if (index === 0) { // First item, larger, spans 2 columns on larger screens
              classes = "lg:col-span-2";
            } else if (index === 3) { // Fourth item, spans 2 columns on medium screens
              classes = "md:col-span-2";
            }
            // All images will maintain h-72 and object-cover, ensuring consistent visual weight in the grid.
            // Spanning items will effectively have a wider image.

            return (
              <div key={index} className={`${classes}`}>
                <PhotoCard item={item} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer / Call to action */}
      <footer className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-200 text-center text-slate-600">
        <h3 className="font-serif text-3xl font-light mb-4">
          Discover more of my vision.
        </h3>
        <p className="mb-6 max-w-2xl mx-auto leading-relaxed">
          Explore the full archives, commission a bespoke piece, or get in touch for collaborations.
          My passion is to create enduring visual stories that resonate.
        </p>
        <button className="inline-flex items-center px-8 py-4 border border-slate-300 text-slate-800 text-md uppercase tracking-wide font-medium rounded-sm hover:bg-slate-100 transition-colors duration-200">
          <Camera size={20} className="mr-2" /> View All Collections
        </button>
      </footer>
    </div>
  );
}