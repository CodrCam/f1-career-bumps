import React from "react";
import { Link } from "react-router-dom";
import { Rocket, BarChart3, Users2, Info, Smartphone, Monitor, Timer, Target, Zap, TrendingUp, Database, Cpu } from "lucide-react";
import { CURRENT_SEASON, getSeasonPath } from "../utils/seasons.js";

const About = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-16">
      <div className="max-w-4xl mx-auto space-y-10">
        <header>
          <h1 className="text-4xl font-bold mb-3">About Slipstream</h1>
          <p className="text-gray-300 text-lg">
            A Formula 1 analytics platform combining season results, championship movement, pit stop trends, and live telemetry analysis.
            Built with modern React architecture, this dashboard focuses on clear visualizations and practical race-weekend context.
          </p>
          <p className="text-gray-400 mt-4 text-sm">
            Created by Cameron Griffin — Season data, telemetry tools, and pit stop trend modeling
          </p>
        </header>

        <section>
          <h2 className="text-2xl font-semibold mb-2">🔧 Tech Stack</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-blue-400">Core Technologies</h3>
              </div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• <strong>React 19 + Vite:</strong> Modern build system with fast HMR</li>
                <li>• <strong>Chart.js + react-chartjs-2:</strong> Interactive data visualizations</li>
                <li>• <strong>React Router DOM:</strong> Client-side routing</li>
                <li>• <strong>Custom CSS + Mobile CSS:</strong> Responsive design system</li>
                <li>• <strong>Component Architecture:</strong> Modular, reusable UI components</li>
              </ul>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-green-400">Data & Analytics</h3>
              </div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• <strong>Season API:</strong> Hosted season data by year</li>
                <li>• <strong>Formula1.com:</strong> Official completed-race results updates</li>
                <li>• <strong>Trend Modeling:</strong> Weighted pit stop scoring</li>
                <li>• <strong>Data Processing:</strong> Race and championship transformations</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">Pit Stop Trend Forecasting</h2>
          <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-6 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-6 h-6 text-yellow-400" />
              <h3 className="font-semibold text-yellow-400 text-lg">Weighted Statistical Model</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-200">
              <div>
                <h4 className="font-semibold mb-2">Forecast Inputs:</h4>
                <ul className="space-y-1">
                  <li>• Trend direction over recent races</li>
                  <li>• Weighted moving averages</li>
                  <li>• Consistency scoring algorithms</li>
                  <li>• Performance trajectory scoring</li>
                  <li>• Confidence bands from historical consistency</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Forecast Outputs:</h4>
                <ul className="space-y-1">
                  <li>• Next-race pit stop trend forecast</li>
                  <li>• Speed vs consistency analysis</li>
                  <li>• Strategic pattern recognition</li>
                  <li>• Transparent confidence scoring</li>
                  <li>• Comprehensive driver/team metrics</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">📱 Responsive Design Excellence</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-blue-400">Mobile Experience</h3>
              </div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Hamburger navigation with smooth animations</li>
                <li>• Card-based layouts for complex data</li>
                <li>• Touch-optimized chart interactions</li>
                <li>• Responsive typography and spacing</li>
                <li>• Optimized chart performance for mobile</li>
                <li>• Adaptive grid layouts</li>
              </ul>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="w-5 h-5 text-green-400" />
                <h3 className="font-semibold text-green-400">Desktop Experience</h3>
              </div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Full-featured data tables with sorting</li>
                <li>• Multi-chart visualizations</li>
                <li>• Detailed tooltip information</li>
                <li>• Multi-driver/team comparisons</li>
                <li>• Larger visual real estate utilization</li>
                <li>• Filtering and controls</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">📊 Comprehensive Dashboard Features</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-gray-300">
            
            {/* Historical Analytics */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-blue-400">Historical Season Analytics</h3>
              
              <div>
                <Link to={getSeasonPath(CURRENT_SEASON, 'drivers')} className="hover:text-blue-400 font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  Driver WDC Bump Chart
                </Link>
                <p className="text-sm ml-7">Championship points progression with interactive filtering</p>
              </div>
              
              <div>
                <Link to={getSeasonPath(CURRENT_SEASON, 'constructors')} className="hover:text-green-400 font-semibold flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-green-400" />
                  Constructor Championship
                </Link>
                <p className="text-sm ml-7">Team standings evolution with gap analysis</p>
              </div>
              
              <div>
                <Link to={getSeasonPath(CURRENT_SEASON, 'driver-results')} className="hover:text-purple-400 font-semibold flex items-center gap-2">
                  <Users2 className="w-5 h-5 text-purple-400" />
                  Race Results Bump Chart
                </Link>
                <p className="text-sm ml-7">Position-based performance tracking across all races</p>
              </div>
              
              <div>
                <Link to={getSeasonPath(CURRENT_SEASON, 'driver-stats')} className="hover:text-orange-400 font-semibold flex items-center gap-2">
                  <Users2 className="w-5 h-5 text-orange-400" />
                  Performance Analytics
                </Link>
                <p className="text-sm ml-7">Composite metrics with detailed teammate comparisons</p>
              </div>
              
              <div>
                <Link to={getSeasonPath(CURRENT_SEASON, 'head-to-head')} className="hover:text-red-400 font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-red-400" />
                  Head-to-Head Analysis
                </Link>
                <p className="text-sm ml-7">Direct driver comparisons across qualifying, sprint, and race</p>
              </div>
            </div>

            {/* Live Analysis Features */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-cyan-400">Live Telemetry & Pit Trends</h3>
              
              <div>
                <Link to={getSeasonPath(CURRENT_SEASON, 'pit-stop-analysis')} className="hover:text-yellow-400 font-semibold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Pit Stop Trend Forecasts
                  <span className="text-xs bg-yellow-500 text-black px-2 py-1 rounded">Model</span>
                </Link>
                <p className="text-sm ml-7">Weighted historical forecasts from pit stop performance data</p>
              </div>
              
              <div>
                <Link to={getSeasonPath(CURRENT_SEASON, 'sector-analysis')} className="hover:text-cyan-400 font-semibold flex items-center gap-2">
                  <Timer className="w-5 h-5 text-cyan-400" />
                  Sector Time Analysis
                  <span className="text-xs bg-cyan-500 text-black px-2 py-1 rounded">Live</span>
                </Link>
                <p className="text-sm ml-7">Sector performance comparison for selected race sessions</p>
              </div>
              
              <div>
                <Link to={getSeasonPath(CURRENT_SEASON, 'pit-strategy')} className="hover:text-pink-400 font-semibold flex items-center gap-2">
                  <Target className="w-5 h-5 text-pink-400" />
                  Pit Stop Strategy
                  <span className="text-xs bg-pink-500 text-black px-2 py-1 rounded">Live</span>
                </Link>
                <p className="text-sm ml-7">Strategic timing analysis with pit window optimization</p>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700">
                <Link to="/" className="hover:text-gray-300 font-semibold flex items-center gap-2">
                  <Info className="w-5 h-5 text-gray-300" />
                  Dashboard Home
                </Link>
                <p className="text-sm ml-7">Navigation hub with comprehensive feature overview</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">🚀 Dashboard Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-400 mb-2">Data Visualization</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Interactive multi-driver filtering (up to 5 selections)</li>
                <li>• Dynamic tooltips with contextual information</li>
                <li>• Responsive chart scaling and optimization</li>
                <li>• Color-coded team and driver representations</li>
                <li>• Smooth animations and transitions</li>
                <li>• Real-time data loading with error handling</li>
              </ul>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold text-green-400 mb-2">Trend Forecasting</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Heuristic scoring system (0-100 scale)</li>
                <li>• Mathematical trend analysis and forecasting</li>
                <li>• Consistency metrics with standard deviation</li>
                <li>• Performance trajectory modeling</li>
                <li>• Confidence rating system</li>
                <li>• Strategic pattern recognition</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">📁 Comprehensive Data Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-400 mb-2">Season Results Data</h3>
              <div className="text-sm text-gray-300">
                <p className="mb-2">Hosted season records covering:</p>
                <ul className="space-y-1">
                  <li>• 2025 and 2026 season routes</li>
                  <li>• Race, qualifying, sprint, and sprint qualifying results</li>
                  <li>• Driver and constructor championship movement</li>
                  <li>• Formula1.com updater for completed race weekends</li>
                  <li>• Season data organized by year and round</li>
                  <li>• Local JSON fallback for development</li>
                </ul>
              </div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold text-cyan-400 mb-2">Race-Weekend Session Data</h3>
              <div className="text-sm text-gray-300">
                <p className="mb-2">Real-time session data including:</p>
                <ul className="space-y-1">
                  <li>• Sector times and performance analysis</li>
                  <li>• Pit stop timing and duration data</li>
                  <li>• Lap-by-lap telemetry information</li>
                  <li>• Driver and session metadata</li>
                  <li>• Strategic decision tracking</li>
                  <li>• Live qualifying and race sessions</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">🎯 Technical Highlights</h2>
          <div className="bg-gradient-to-r from-gray-800 to-gray-700 p-6 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <h4 className="font-semibold text-blue-400 mb-2">Performance Optimization</h4>
                <ul className="text-gray-300 space-y-1">
                  <li>• Memoized data processing</li>
                  <li>• Lazy loading components</li>
                  <li>• Efficient chart rendering</li>
                  <li>• Mobile-optimized calculations</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-green-400 mb-2">Data Processing</h4>
                <ul className="text-gray-300 space-y-1">
                  <li>• Mathematical trend scoring</li>
                  <li>• Statistical analysis algorithms</li>
                  <li>• Real-time API integration</li>
                  <li>• Error handling and validation</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-purple-400 mb-2">User Experience</h4>
                <ul className="text-gray-300 space-y-1">
                  <li>• Responsive design patterns</li>
                  <li>• Intuitive navigation system</li>
                  <li>• Loading states and feedback</li>
                  <li>• Accessibility considerations</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <footer className="pt-6 border-t border-gray-700">
          <p className="text-sm text-gray-500 mb-2">
            F1 Analytics Platform designed, developed, and continuously improved by Cameron Griffin.
          </p>
          <p className="text-xs text-gray-600 mb-2">
            Featuring season-aware data, Formula1.com result sync, automatic updates, and responsive design.
          </p>
          <p className="text-xs text-gray-600">
            Built as a showcase of modern React development, data visualization, and Formula 1 analytics.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default About;
