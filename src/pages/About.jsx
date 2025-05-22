import React from "react";
import { Link } from "react-router-dom";
import { Rocket, BarChart3, Users2, Info, Smartphone, Monitor } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-16">
      <div className="max-w-4xl mx-auto space-y-10">
        <header>
          <h1 className="text-4xl font-bold mb-3">About F1 Career Bumps</h1>
          <p className="text-gray-300 text-lg">
            A fully responsive Formula 1 analytics dashboard built to visualize and explore team and driver performance across the 2025 season.
            Designed with modern React architecture, this app delivers performant, mobile-first visualizations that tell the story behind each race weekend.
          </p>
          <p className="text-gray-400 mt-4 text-sm">
            Created by Cameron Griffin — May 2025 | Updated with mobile-responsive design
          </p>
        </header>

        <section>
          <h2 className="text-2xl font-semibold mb-2">🔧 Tech Stack</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li><strong>React 18 + Vite:</strong> Modern build system for fast development and production builds</li>
            <li><strong>Chart.js + react-chartjs-2:</strong> Interactive, responsive data visualizations</li>
            <li><strong>Responsive Design:</strong> Mobile-first approach with adaptive layouts and touch-friendly interactions</li>
            <li><strong>React Router DOM:</strong> Client-side routing for seamless navigation</li>
            <li><strong>Custom CSS + Mobile CSS:</strong> Modular styling with hamburger navigation and responsive components</li>
            <li><strong>Structured JSON Data:</strong> Custom F1 2025 season dataset with race results, qualifying, and sprint data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">📱 Responsive Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-blue-400">Mobile Experience</h3>
              </div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Hamburger navigation menu</li>
                <li>• Card-based layouts for tables</li>
                <li>• Touch-optimized chart interactions</li>
                <li>• Responsive typography and spacing</li>
                <li>• Optimized chart performance</li>
              </ul>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-green-400">Desktop Experience</h3>
              </div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Full-featured data tables</li>
                <li>• Advanced chart interactions</li>
                <li>• Multi-driver comparisons</li>
                <li>• Detailed tooltips and legends</li>
                <li>• Larger visual real estate</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">📊 Dashboard Pages</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-300">
            <li>
              <Link to="/2025-drivers" className="hover:text-blue-400 font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Driver WDC Bump Chart
              </Link>
              <p className="text-sm ml-7">Cumulative points progression with driver filtering</p>
            </li>
            <li>
              <Link to="/2025-constructors" className="hover:text-green-400 font-semibold flex items-center gap-2">
                <Rocket className="w-5 h-5 text-green-400" />
                Constructor Championship
              </Link>
              <p className="text-sm ml-7">Team standings evolution throughout the season</p>
            </li>
            <li>
              <Link to="/driver-results" className="hover:text-purple-400 font-semibold flex items-center gap-2">
                <Users2 className="w-5 h-5 text-purple-400" />
                Race Results Bump Chart
              </Link>
              <p className="text-sm ml-7">Position-based performance tracking by race</p>
            </li>
            <li>
              <Link to="/driver-stats" className="hover:text-orange-400 font-semibold flex items-center gap-2">
                <Users2 className="w-5 h-5 text-orange-400" />
                Performance Analytics
              </Link>
              <p className="text-sm ml-7">Composite metrics with teammate comparisons</p>
            </li>
            <li>
              <Link to="/head-to-head" className="hover:text-red-400 font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-red-400" />
                Head-to-Head Analysis
              </Link>
              <p className="text-sm ml-7">Direct driver comparisons across all sessions</p>
            </li>
            <li>
              <Link to="/" className="hover:text-gray-300 font-semibold flex items-center gap-2">
                <Info className="w-5 h-5 text-gray-300" />
                Dashboard Home
              </Link>
              <p className="text-sm ml-7">Navigation hub with feature overview</p>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">📈 Key Features</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li><strong>Interactive Visualizations:</strong> Hover tooltips, driver filtering, and responsive legends</li>
            <li><strong>Comprehensive Data:</strong> Race results, qualifying times, sprint races, and head-to-head statistics</li>
            <li><strong>Mobile-First Design:</strong> Optimized for all screen sizes with touch-friendly interactions</li>
            <li><strong>Performance Optimized:</strong> Efficient chart rendering with mobile-specific optimizations</li>
            <li><strong>Modern Architecture:</strong> Component-based React structure for maintainability and extensibility</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">📁 Data Coverage</h2>
          <p className="text-gray-300 mb-3">
            The dashboard currently covers the first 7 rounds of the 2025 F1 season, including:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-gray-200 mb-1">Race Weekends:</h4>
              <ul className="text-gray-400 space-y-1">
                <li>• Australian GP (Melbourne)</li>
                <li>• Chinese GP (Shanghai) *Sprint</li>
                <li>• Japanese GP (Suzuka)</li>
                <li>• Bahrain GP (Sakhir)</li>
                <li>• Saudi Arabian GP (Jeddah)</li>
                <li>• Miami GP *Sprint</li>
                <li>• Imola GP (Emilia-Romagna)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-200 mb-1">Data Points:</h4>
              <ul className="text-gray-400 space-y-1">
                <li>• Race finishing positions</li>
                <li>• Qualifying grid positions</li>
                <li>• Sprint race results</li>
                <li>• Championship points</li>
                <li>• Lap times and deltas</li>
                <li>• DNF/DSQ tracking</li>
              </ul>
            </div>
          </div>
        </section>

        <footer className="pt-6 border-t border-gray-700">
          <p className="text-sm text-gray-500 mb-2">
            Project designed, developed, and optimized by Cameron Griffin.
          </p>
          <p className="text-xs text-gray-600">
            Built as a showcase of modern React development, responsive design principles, and Formula 1 analytics visualization.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default About;