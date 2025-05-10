# F1 Career Bumps

**A fully responsive React web app for tracking the 2025 Formula 1 season, featuring interactive bump charts, driver statistics, and constructor standings.**  
Built with Chart.js and powered by structured JSON race data, this dashboard visualizes team and driver performance as the season progresses.

---

## 🔍 Overview

F1 Career Bumps presents visual and statistical breakdowns of Formula 1’s 2025 season. The app tracks evolving rankings and head-to-head metrics with:

- 📈 Bump charts for **Drivers’ and Constructors’ Championships**
- 🧠 Composite **driver performance metrics** (points, qualifying, finish, head-to-head)
- 🏁 Per-race **driver finishing tables**
- 🔁 Responsive design for all screen sizes

This project is built using **React**, **Chart.js**, and a custom JSON dataset updated with each race.

---

## ⚙️ Tech Stack

| Area               | Tech/Tool                      |
|--------------------|--------------------------------|
| Frontend           | React 18                       |
| Charting Library   | Chart.js (via react-chartjs-2) |
| Data Source        | Custom JSON (`f1_2025_season.json`) |
| Styling            | Custom CSS                     |
| Routing            | React Router DOM               |
| State Management   | React useState/useEffect       |
| Package Manager    | npm                            |

---

## 📂 Project Structure

src/
├── components/        # Navbar, Layout & Chart wrappers
├── data/              # Static F1 2025 JSON race dataset
├── pages/             # All chart views and stat pages
├── utils/             # Data parsing and helper logic
├── App.jsx            # Main app with router
├── main.jsx           # Entry point
├── index.css          # Global styles

---

## 🚀 Getting Started

### 1. Clone the Repo

```bash
git clone https://github.com/your-username/f1-career-bumps.git
cd f1-career-bumps

2. Install Dependencies

npm install

3. Start the Development Server

npm run dev

Then open http://localhost in your browser.

⸻

📊 Pages & Features

🏎 Constructors 2025 (/2025-constructors)
	•	Displays a bump chart showing the evolving team rankings after each race.
	•	Y-axis shows WCC position (P1 to P10), X-axis shows race rounds.

👤 Drivers 2025 (/2025-drivers)
	•	Bump chart of cumulative points over time for every driver.
	•	Lines are color-coded by team association.

📋 Results Table (/driver-results)
	•	Driver-by-driver finishing positions across every race.
	•	Helpful for spotting trends or inconsistencies.

📈 Driver Stats (/driver-stats)
	•	Head-to-head comparison within each team.
	•	Includes normalized metrics:
	•	Points
	•	Average Qualifying
	•	Average Finish
	•	Head-to-Head Wins

⸻

📁 Data Structure

All race results are stored in f1_2025_season.json:

{
  "races": [
    {
      "round": 1,
      "location": "Bahrain",
      "race_results": [
        { "driver": "Lando Norris", "team": "McLaren", "position": 2, "points": 18 },
        { "driver": "Charles Leclerc", "team": "Ferrari", "position": 1, "points": 25 },
        ...
      ]
    },
    ...
  ]
}



⸻

🌐 Deployment

This project is configured for deployment via Vite for fast, lightweight performance. You can deploy via:
	•	Netlify
	•	Vercel
	•	GitHub Pages (with adjustments for routing)

⸻

🛣️ Roadmap
	•	Add 2024 historical comparisons
	•	Add interactive driver/team selectors
	•	Integrate live Ergast API data
	•	Add dark mode toggle
	•	Export charts to PNG

⸻

🤝 Contributing

Pull requests are welcome! Please create an issue to discuss major features or ideas before submitting a PR.

⸻

🧠 Author

Cam Griffin 
Built as a visual tribute to the art and analytics of Formula 1.
Ideas, data entries, and chart renderings handcrafted for precision.

⸻

📘 License

This project is open-source under the MIT License.