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
import { ResponsiveDriverSelector } from "../components/UIControls.jsx";

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
  
  // Handle driver selection
  const { selectedDrivers, handleDriverSelect } = useDriverSelection(allDrivers, 2);
  
  // Get championship data
  const chartData = useChampionshipData(f1SeasonData.races, selectedDrivers, isMobile);

  // Handle driver selection for mobile/desktop
  const handleDriverChange = (index, value) => {
    if (index === 'reset') {
      handleDriverSelect('reset');
    } else {
      const newSelection = [...selectedDrivers];
      newSelection[index] = value;
      // Update the selection by clearing and adding back
      handleDriverSelect('reset');
      newSelection.filter(Boolean).forEach(driver => {
        handleDriverSelect('toggle', driver);
      });
    }
  };

  const options = createResponsiveChartOptions(
    isMobile, 
    "2025 Driver World Championship Standings",
    "driver"
  );

  return (
    <div>
      {/* Driver Selector */}
      <ResponsiveDriverSelector
        drivers={allDrivers}
        selectedDrivers={[selectedDrivers[0] || "", selectedDrivers[1] || ""]}
        onDriverChange={handleDriverChange}
        maxDrivers={2}
        isMobile={isMobile}
      />
      
      {/* Championship Chart */}
      <ChampionshipBumpChart
        data={chartData}
        options={options}
        type="driver"
        title="2025 Driver World Championship Bump Chart"
        selectedDrivers={selectedDrivers}
        onDriverSelect={handleDriverSelect}
        allDrivers={allDrivers}
        isMobile={isMobile}
      />
    </div>
  );
};

export default DriverWDC2025Page;