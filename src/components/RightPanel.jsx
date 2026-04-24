import React from "react";

const RightPanel = ({ completed = 0, missed = 0, rate = 0 }) => {
  return (
    <>
      {/* Monthly Eco Impact */}
      <div className="card eco">
        <h3>Monthly Eco Impact</h3>

        <div className="eco-row">
          <div>
            <p>Waste Collected</p>
            <h2>{completed} Days</h2>
          </div>

          <div>
            <p>Pickup Rate</p>
            <h2>{rate}%</h2>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="card">
        <h4>Legend</h4>
        <p>🟢 Completed</p>
        <p>🔴 Missed</p>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h4>Recent Activity</h4>
        <p>Waste Collected: {completed} times</p>
        <p>Waste Missed: {missed} times</p>
      </div>
    </>
  );
};

export default RightPanel;