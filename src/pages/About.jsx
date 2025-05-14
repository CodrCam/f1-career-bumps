import React from "react";
import { Link } from "react-router-dom";
import { Rocket, BarChart3, Users2, Info } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-16">
      <div className="max-w-4xl mx-auto space-y-10">
        <header>
          <h1 className="text-4xl font-bold mb-3">About This Project</h1>
          <p className="text-gray-300 text-lg">
            The F1 Performance Dashboard is a developer-built analytics tool designed to visualize and explore team and driver performance across the 2025 Formula 1 season.
            Built using modern React tooling, it's designed to be performant, responsive, and visually intuitive — showcasing not just the race results, but the story behind the season.
          </p>
          <p className="text-gray-400 mt-4 text-sm">
            Created by Cameron Griffin — May 2025.
          </p>
        </header>

        <section>
          <h2 className="text-2xl font-semibold mb-2">🔧 Tech Stack</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li><strong>React + Vite:</strong> for fast builds and component structure</li>
            <li><strong>Chart.js:</strong> for elegant interactive data visualizations</li>
            <li><strong>Modular CSS:</strong> no full Tailwind dependency; uses class-based design</li>
            <li><strong>Router DOM:</strong> for a clean multi-page experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">📁 Project Pages</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-300">
            <li>
              <Link to="/2025-drivers" className="hover:text-blue-400 font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Driver Bump Chart
              </Link>
              <p className="text-sm ml-7">Track WDC standings round-by-round</p>
            </li>
            <li>
              <Link to="/2025-constructors" className="hover:text-green-400 font-semibold flex items-center gap-2">
                <Rocket className="w-5 h-5 text-green-400" />
                Constructor Bump Chart
              </Link>
              <p className="text-sm ml-7">Visualize team rankings across the season</p>
            </li>
            <li>
              <Link to="/driver-results" className="hover:text-purple-400 font-semibold flex items-center gap-2">
                <Users2 className="w-5 h-5 text-purple-400" />
                Driver Results Table
              </Link>
              <p className="text-sm ml-7">Compare quali, race, and points side-by-side</p>
            </li>
            <li>
              <Link to="/driver-stats" className="hover:text-orange-400 font-semibold flex items-center gap-2">
                <Users2 className="w-5 h-5 text-orange-400" />
                Driver Stat Comparison
              </Link>
              <p className="text-sm ml-7">Normalized composite metric by team</p>
            </li>
            <li>
              <Link to="/head-to-head" className="hover:text-red-400 font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-red-400" />
                Head-to-Head Comparison
              </Link>
              <p className="text-sm ml-7">Analyze two drivers against each other</p>
            </li>
            <li>
              <Link to="/" className="hover:text-gray-300 font-semibold flex items-center gap-2">
                <Info className="w-5 h-5 text-gray-300" />
                Return to Dashboard
              </Link>
              <p className="text-sm ml-7">Back to the home page view</p>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">📈 Project Goals</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li>Deliver clean, dynamic, data-driven F1 insights</li>
            <li>Demonstrate React proficiency with real-world logic</li>
            <li>Build portfolio-grade visualizations without bloated dependencies</li>
            <li>Make it easy to extend with new seasons, drivers, or feature metrics</li>
          </ul>
        </section>

        <footer className="pt-6 border-t text-sm text-gray-500">
          Project designed, coded, and tuned by Cam Griffin.
        </footer>
      </div>
    </div>
  );
};

export default About;