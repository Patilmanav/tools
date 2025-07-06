import React from 'react';
import './AboutModal.css';

const AboutModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="about-modal-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <button className="about-modal-close" onClick={onClose}>
          ×
        </button>
        
        <div className="about-modal-content">
          <div className="about-header">
            <div className="about-avatar">
              <span className="avatar-placeholder">👨‍💻</span>
            </div>
            <h2 className="about-title">About the Developer</h2>
          </div>
          
          <div className="about-description">
            <p>
              Hey! I'm <strong>Manav Patil</strong> – a Python & React developer focused on automation, ML, and building efficient tools for real-world tasks.
            </p>
            <p>
              This PDF Tools project showcases my passion for creating practical solutions that help people work more efficiently with their documents and images.
            </p>
          </div>
          
          <div className="about-links">
            <h3>Connect with me:</h3>
            <div className="about-links-grid">
              <a 
                href="https://patilmanav.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="about-link portfolio-link"
              >
                <span className="link-icon">🌐</span>
                <span className="link-text">Portfolio</span>
              </a>
              
              <a 
                href="https://github.com/patilmanav" 
                target="_blank" 
                rel="noopener noreferrer"
                className="about-link github-link"
              >
                <span className="link-icon">💻</span>
                <span className="link-text">GitHub</span>
              </a>
              
              <a 
                href="https://www.linkedin.com/in/yourprofile" 
                target="_blank" 
                rel="noopener noreferrer"
                className="about-link linkedin-link"
              >
                <span className="link-icon">🔗</span>
                <span className="link-text">LinkedIn</span>
              </a>
            </div>
          </div>
          
          <div className="about-footer">
            <p className="about-footer-text">
              Built with modern technologies and a focus on user experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutModal; 