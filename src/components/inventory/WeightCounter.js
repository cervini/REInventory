import React from 'react';
import './WeightCounter.css';

// Conversion factor from lbs to kg
const LBS_TO_KG = 0.453592;

export default function WeightCounter({ currentWeight, maxWeight, unit }) {
  // 1. Determine which values to display based on the selected unit.
  const displayWeight = unit === 'kg' ? (currentWeight * LBS_TO_KG) : currentWeight;
  const displayMaxWeight = unit === 'kg' ? (maxWeight * LBS_TO_KG) : maxWeight;
  
  // 2. Check if the character is over-encumbered.
  const isOverEncumbered = displayWeight > displayMaxWeight;

  return (
    <div className="weight-counter">
      <span className={`weight-counter__current${isOverEncumbered ? ' weight-counter__current--over' : ''}`}>
        {/* Format numbers to one decimal place */}
        {displayWeight.toFixed(1)}
      </span>
      <span className="weight-counter__limit"> / {displayMaxWeight.toFixed(1)} {unit}</span>
    </div>
  );
}