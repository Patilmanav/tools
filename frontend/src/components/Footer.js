import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-text">
          Made with ❤️ by <span className="developer-name">Manav Patil</span>
        </div>
        <div className="footer-links">
          <a 
            href="https://patilmanav.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="footer-link"
          >
            Portfolio
          </a>
          <span className="footer-separator">•</span>
          <a 
            href="https://github.com/patilmanav/pdf-tools" 
            target="_blank" 
            rel="noopener noreferrer"
            className="footer-link"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 