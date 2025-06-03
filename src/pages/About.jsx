import React from "react";
import { Link } from "react-router-dom";
import { Rocket, BarChart3, Users2, Info, Smartphone, Monitor, Timer, Target, Zap, Brain, Database, Cpu } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white px-6 py-16">
      <div className="max-w-4xl mx-auto space-y-10">
        <header>
          <h1 className="text-4xl font-bold mb-3">About F1 Performance Dashboard</h1>
          <p className="text-gray-300 text-lg">
            A comprehensive Formula 1 analytics platform combining historical season data with real-time telemetry analysis. 
            Built with modern React architecture, this dashboard delivers advanced AI-powered insights, live sector analysis, 
            pit strategy optimization, and mobile-first visualizations that reveal the hidden patterns in F1 performance data.
          </p>
          <p className="text-gray-400 mt-4 text-sm">
            Created by Cameron Griffin — Enhanced with AI Analytics & Live Data Integration | 2025
          </p>
        </header>

        <section>
          <h2 className="text-2xl font-semibold mb-2">🔧 Advanced Tech Stack</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-blue-400">Core Technologies</h3>
              </div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• <strong>React 18 + Vite:</strong> Modern build system with fast HMR</li>
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
                <li>• <strong>OpenF1 API:</strong> Real-time telemetry and session data</li>
                <li>• <strong>Custom F1 Dataset:</strong> Comprehensive 2025 season results</li>
                <li>• <strong>AI/ML Algorithms:</strong> Predictive analytics engine</li>
                <li>• <strong>Statistical Modeling:</strong> Linear regression & trend analysis</li>
                <li>• <strong>Data Processing:</strong> Advanced mathematical computations</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">🧠 AI-Powered Analytics Features</h2>
          <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-6 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-6 h-6 text-yellow-400" />
              <h3 className="font-semibold text-yellow-400 text-lg">Advanced Machine Learning Engine</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-200">
              <div>
                <h4 className="font-semibold mb-2">Predictive Algorithms:</h4>
                <ul className="space-y-1">
                  <li>• Linear regression trend analysis</li>
                  <li>• Weighted moving averages</li>
                  <li>• Consistency scoring algorithms</li>
                  <li>• Performance trajectory modeling</li>
                  <li>• Statistical confidence ratings</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Analytics Capabilities:</h4>
                <ul className="space-y-1">
                  <li>• Next-race performance forecasting</li>
                  <li>• Speed vs consistency analysis</li>
                  <li>• Strategic pattern recognition</li>
                  <li>• Real-time confidence scoring</li>
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
                <li>• Advanced multi-chart visualizations</li>
                <li>• Enhanced tooltip information</li>
                <li>• Multi-driver/team comparisons</li>
                <li>• Larger visual real estate utilization</li>
                <li>• Advanced filtering and controls</li>
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
                <Link to="/2025-drivers" className="hover:text-blue-400 font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  Driver WDC Bump Chart
                </Link>
                <p className="text-sm ml-7">Championship points progression with interactive filtering</p>
              </div>
              
              <div>
                <Link to="/2025-constructors" className="hover:text-green-400 font-semibold flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-green-400" />
                  Constructor Championship
                </Link>
                <p className="text-sm ml-7">Team standings evolution with gap analysis</p>
              </div>
              
              <div>
                <Link to="/driver-results" className="hover:text-purple-400 font-semibold flex items-center gap-2">
                  <Users2 className="w-5 h-5 text-purple-400" />
                  Race Results Bump Chart
                </Link>
                <p className="text-sm ml-7">Position-based performance tracking across all races</p>
              </div>
              
              <div>
                <Link to="/driver-stats" className="hover:text-orange-400 font-semibold flex items-center gap-2">
                  <Users2 className="w-5 h-5 text-orange-400" />
                  Performance Analytics
                </Link>
                <p className="text-sm ml-7">Composite metrics with detailed teammate comparisons</p>
              </div>
              
              <div>
                <Link to="/head-to-head" className="hover:text-red-400 font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-red-400" />
                  Head-to-Head Analysis
                </Link>
                <p className="text-sm ml-7">Direct driver comparisons across qualifying, sprint, and race</p>
              </div>
            </div>

            {/* Live Analysis Features */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-cyan-400">Live Telemetry & AI Analytics</h3>
              
              <div>
                <Link to="/pit-stop-analysis" className="hover:text-yellow-400 font-semibold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  AI Pit Stop Analytics
                  <span className="text-xs bg-yellow-500 text-black px-2 py-1 rounded">Enhanced</span>
                </Link>
                <p className="text-sm ml-7">Advanced ML predictions with comprehensive statistical modeling</p>
              </div>
              
              <div>
                <Link to="/sector-analysis" className="hover:text-cyan-400 font-semibold flex items-center gap-2">
                  <Timer className="w-5 h-5 text-cyan-400" />
                  Sector Time Analysis
                  <span className="text-xs bg-cyan-500 text-black px-2 py-1 rounded">Live</span>
                </Link>
                <p className="text-sm ml-7">Real-time sector performance comparison via OpenF1 API</p>
              </div>
              
              <div>
                <Link to="/pit-strategy" className="hover:text-pink-400 font-semibold flex items-center gap-2">
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
          <h2 className="text-2xl font-semibold mb-2">🚀 Advanced Features & Capabilities</h2>
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
              <h3 className="font-semibold text-green-400 mb-2">AI & Analytics</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Predictive scoring algorithms (0-100 scale)</li>
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
              <h3 className="font-semibold text-blue-400 mb-2">Historical Season Data (2025)</h3>
              <div className="text-sm text-gray-300">
                <p className="mb-2">Complete 9-round dataset covering:</p>
                <ul className="space-y-1">
                  <li>• Australian GP, Chinese GP* (Sprint), Japanese GP</li>
                  <li>• Bahrain GP, Saudi Arabian GP, Miami GP* (Sprint)</li>
                  <li>• Emilia-Romagna GP, Monaco GP, Spanish GP</li>
                  <li>• 21 drivers across 10 teams</li>
                  <li>• Race results, qualifying, sprint races</li>
                  <li>• Championship points and standings</li>
                </ul>
              </div>
            </div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="font-semibold text-cyan-400 mb-2">Live Telemetry (OpenF1 API)</h3>
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
                  <li>• Advanced mathematical modeling</li>
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
            Advanced F1 Analytics Platform designed, developed, and continuously enhanced by Cameron Griffin.
          </p>
          <p className="text-xs text-gray-600 mb-2">
            Featuring cutting-edge AI prediction algorithms, real-time telemetry integration, and responsive design excellence.
          </p>
          <p className="text-xs text-gray-600">
            Built as a comprehensive showcase of modern React development, machine learning integration, data visualization mastery, and Formula 1 analytics innovation.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default About;