import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
import { useSeasonData } from "../hooks/useSeasonData.js";
import { getSeasonFromParam } from "../utils/seasons.js";
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
  const { seasonYear } = useParams();
  const selectedYear = getSeasonFromParam(seasonYear);
  const { races } = useSeasonData(selectedYear);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get all drivers from the data
  const allDrivers = useAllDrivers(races);
  
  // Handle driver selection - increased from 2 to 5 drivers
  const { selectedDrivers, handleDriverSelect } = useDriverSelection(allDrivers, 5);
  
  // Get championship data
  const chartData = useChampionshipData(races, selectedDrivers, isMobile);

  const options = createResponsiveChartOptions(
    isMobile, 
    `${selectedYear} Driver World Championship Standings`,
    "driver"
  );

  return (
    <div>
      {/* Championship Chart - now with up to 5 driver selection and no dropdown */}
      <ChampionshipBumpChart
        data={chartData}
        options={options}
        type="driver"
        title={`${selectedYear} Driver World Championship Points`}
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
