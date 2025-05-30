import React, { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import f1SeasonData from "../data/f1_2025_season.json";
import { createResponsiveChartOptions } from "../utils/chartOptions.jsx";
import { useChampionshipData, useDriverSelection, useAllDrivers } from "../components/F1DataComponents.jsx";
import { ChampionshipBumpChart } from "../components/ChartComponents.jsx";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const DriverWDC2025Page = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get all drivers from the data
  const allDrivers = useAllDrivers(f1SeasonData.races);
  
  // Handle driver selection - increased from 2 to 5 drivers
  const { selectedDrivers, handleDriverSelect } = useDriverSelection(allDrivers, 5);
  
  // Get championship data
  const chartData = useChampionshipData(f1SeasonData.races, selectedDrivers, isMobile);

  const options = createResponsiveChartOptions(
    isMobile, 
    "2025 Driver World Championship Standings",
    "driver"
  );

  return (
    <div>
      {/* Championship Chart - now with up to 5 driver selection and no dropdown */}
      <ChampionshipBumpChart
        data={chartData}
        options={options}
        type="driver"
        title="2025 Driver World Championship Points"
        selectedDrivers={selectedDrivers}
        onDriverSelect={handleDriverSelect}
        allDrivers={allDrivers}
        isMobile={isMobile}
        maxDrivers={5}
      />
    </div>
  );
};

export default DriverWDC2025Page;