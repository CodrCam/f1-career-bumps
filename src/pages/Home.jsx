// src/pages/Home.jsx

import React from "react";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-10">
      <div className="bg-white shadow-xl rounded-2xl p-10 max-w-2xl w-full text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-800">
          F1 Performance Dashboard
        </h1>
        <p className="text-gray-600 mb-8">
          Welcome! Choose a category below to start exploring driver and constructor analytics for the 2025 season.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            to="/driver-bump-2025"
            className="bg-blue-500 text-white py-3 rounded-xl shadow hover:bg-blue-600 transition"
          >
            2025 Driver Bump Chart
          </Link>
          <Link
            to="/constructor-bump-2025"
            className="bg-green-500 text-white py-3 rounded-xl shadow hover:bg-green-600 transition"
          >
            2025 Constructor Bump Chart
          </Link>
          <Link
            to="/driver-comparison"
            className="bg-purple-500 text-white py-3 rounded-xl shadow hover:bg-purple-600 transition"
          >
            Driver Stat Comparison
          </Link>
          <Link
            to="/about"
            className="bg-gray-400 text-white py-3 rounded-xl shadow hover:bg-gray-500 transition"
          >
            About This Project
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
