# F1 Career Bumps

**A fully responsive React web app for tracking the 2025 Formula 1 season, featuring interactive bump charts, driver statistics, and constructor standings.**  

Built with Chart.js and powered by structured JSON race data, this dashboard visualizes team and driver performance as the season progresses. Optimized for both desktop and mobile experiences with touch-friendly interactions and adaptive layouts.

---

## 🔍 Overview

F1 Career Bumps presents comprehensive visual and statistical breakdowns of Formula 1's 2025 season. The app tracks evolving rankings and performance metrics with:

- 📈 **Interactive Bump Charts** for Drivers' and Constructors' Championships
- 🧠 **Composite Performance Metrics** (points, qualifying, finish positions, head-to-head)
- 🏁 **Detailed Race Results** with position tracking across all sessions
- 📱 **Mobile-First Responsive Design** with touch-optimized interactions
- 🎯 **Precise Tooltips** showing individual driver/team data on hover
- 🔄 **Dynamic Filtering** with driver selection and comparison tools

This project demonstrates modern React development with Chart.js integration and comprehensive mobile optimization.

---

## ⚙️ Tech Stack

| Area                  | Technology                          |
|-----------------------|-------------------------------------|
| **Frontend**          | React 18 + Vite                   |
| **Charting**          | Chart.js (via react-chartjs-2)    |
| **Data Source**       | Custom JSON (`f1_2025_season.json`) |
| **Styling**           | Custom CSS + Mobile-responsive CSS |
| **Routing**           | React Router DOM                   |
| **State Management**  | React useState/useEffect           |
| **Build Tool**        | Vite                               |
| **Package Manager**   | npm                                |

---

## 📂 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Navbar.jsx      # Mobile-responsive navigation with hamburger menu
│   ├── ResponsiveChartContainer.jsx  # Adaptive chart wrapper
│   ├── LayoutWrapper.jsx             # Page layout component
│   └── ChartWrapper.jsx              # Chart-specific wrapper
├── data/               # Static F1 2025 JSON race dataset
│   └── f1_2025_season.json
├── pages/              # Main application views
│   ├── Home.jsx                    # Dashboard landing page
│   ├── ConstructorBump2025Page.jsx # Team championship visualization
│   ├── DriverWDC2025Page.jsx       # Driver points progression
│   ├── DriverResults2025Page.jsx   # Race position tracking
│   ├── DriverStatsPage.jsx         # Performance analytics
│   ├── DriverHeadToHeadPage.jsx    # Direct driver comparisons
│   └── About.jsx                   # Project information
├── utils/              # Helper functions and configurations
│   ├── parseDriverStats.js        # Data processing utilities
│   └── chartOptions.jsx            # Responsive chart configurations
├── App.jsx             # Main app with routing configuration
├── main.jsx           # Application entry point
└── index.css          # Global styles and responsive breakpoints
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/f1-career-bumps.git
   cd f1-career-bumps
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**
   Navigate to `http://localhost:5173` to view the application.

### Build for Production

```bash
npm run build
npm run preview  # Preview production build locally
```

---

## 📊 Features & Pages

### 🏎️ Constructor Championship (`/2025-constructors`)
- Interactive bump chart showing team rankings evolution
- Y-axis: Championship position (P1-P10)
- X-axis: Racing circuits/rounds
- Hover tooltips with team-specific position and points data

### 👤 Driver World Championship (`/2025-drivers`)
- Cumulative points progression for all drivers
- Color-coded lines by team association
- Driver filtering system for focused comparisons
- Mobile-optimized legend placement

### 📋 Race Results Analysis (`/driver-results`)
- Position-based performance tracking across all races
- Individual driver result patterns and consistency analysis
- Reverse Y-axis showing race finishing positions (P1-P20)

### 📈 Performance Analytics (`/driver-stats`)
- Composite performance metrics using normalized data:
  - **Points**: Championship points earned
  - **Average Qualifying**: Grid position performance
  - **Average Finish**: Race result consistency  
  - **Head-to-Head**: Teammate comparison wins
- Team-by-team breakdowns with visual comparisons
- Mobile card layouts for detailed statistics

### ⚔️ Head-to-Head Comparison (`/head-to-head`)
- Direct driver comparisons across all sessions
- Qualifying, Sprint, and Race result analysis
- Time delta calculations and position differences
- Mobile-responsive card layouts for easy comparison

---

## 📱 Mobile Optimization

### Responsive Design Features
- **Hamburger Navigation**: Collapsible menu for mobile devices
- **Adaptive Chart Sizing**: Dynamic height/width based on viewport
- **Touch-Optimized Interactions**: Larger touch targets and hover areas
- **Card-Based Layouts**: Replace tables with mobile-friendly cards
- **Performance Optimizations**: Reduced animations and simplified rendering

### Responsive Breakpoints
- **Mobile**: < 768px (card layouts, hamburger menu, optimized charts)
- **Tablet**: 768px - 1024px (hybrid layouts)
- **Desktop**: > 1024px (full feature set, traditional layouts)

---

## 📁 Data Structure

Race data is stored in `f1_2025_season.json` with comprehensive session coverage:

```json
{
  "races": [
    {
      "round": 1,
      "grand_prix": "Australian Grand Prix",
      "date": "2025-03-16",
      "circuit": "Melbourne Grand Prix Circuit",
      "qualifying_results": [
        {
          "position": 1,
          "driver": "Lando Norris",
          "team": "McLaren",
          "time": "1:15.096",
          "points": 0
        }
      ],
      "sprint_results": [],
      "race_results": [
        {
          "position": 1,
          "driver": "Lando Norris",
          "team": "McLaren",
          "points": 25,
          "grid": 1,
          "time": "1:42:06.304"
        }
      ]
    }
  ]
}
```

### Current Season Coverage
**7 Rounds Complete** (Australian GP through Imola GP)
- **Total Races**: 7
- **Sprint Weekends**: 2 (China, Miami)
- **Drivers Tracked**: 20
- **Teams**: 10

---

## 🌐 Deployment

This project is optimized for modern deployment platforms:

### Recommended Platforms
- **Vercel** (Recommended for React/Vite projects)
- **Netlify** (Easy Git integration)
- **GitHub Pages** (requires routing configuration)

### Deployment Configuration
The app uses client-side routing, so ensure your deployment platform supports SPA routing or configure redirects appropriately.

---

## 🛣️ Roadmap

### Near-term Enhancements
- [ ] Complete 2025 season data integration
- [ ] Progressive Web App (PWA) capabilities
- [ ] Data export functionality (CSV/JSON)
- [ ] Enhanced accessibility features

### Future Features
- [ ] Historical season comparisons (2024 vs 2025)
- [ ] Live API integration (Ergast F1 API)
- [ ] Advanced analytics (tire strategies, weather impact)
- [ ] Dark/Light theme toggle
- [ ] Driver/team performance predictions

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow React best practices and hooks patterns
- Maintain mobile-first responsive design
- Test across different screen sizes
- Ensure Chart.js interactions work on touch devices

---

## 🧠 Author

**Cameron Griffin**  
*Full-Stack Developer & F1 Analytics Enthusiast*

Built as a showcase of modern React development, responsive design principles, and Formula 1 data visualization. This project demonstrates proficiency in creating performant, mobile-optimized web applications with complex data interactions.

---

## 📘 License

This project is open-source under the MIT License. See `LICENSE` file for details.

---

## 🏎️ Acknowledgments

- Formula 1 for providing the inspiration and excitement
- Chart.js community for excellent documentation
- React team for the robust framework
- Vite for blazing-fast development experience