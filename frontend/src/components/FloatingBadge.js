import React from 'react';
import './FloatingBadge.css';

const FloatingBadge = () => {
  return (
    <div className="floating-badge">
      <a 
        href="https://patilmanav.com" 
        target="_blank" 
        rel="noopener noreferrer"
        className="floating-badge-link"
      >
        <span className="floating-badge-icon">🛠️</span>
        <span className="floating-badge-text">Built by Manav Patil</span>
      </a>
    </div>
  );
};

export default FloatingBadge; 