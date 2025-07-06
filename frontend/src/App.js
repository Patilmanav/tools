import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import './App.css';
import Card from './components/Card';
import ImageTools from './components/ImageTools';
import Dashboard from './components/Dashboard';
import Footer from './components/Footer';
import AboutModal from './components/AboutModal';
import FloatingBadge from './components/FloatingBadge';

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showSplitOptions, setShowSplitOptions] = useState(false);
  const [splitType, setSplitType] = useState('one-one');
  const [customRanges, setCustomRanges] = useState('');
  const [showCompressOptions, setShowCompressOptions] = useState(false);
  const [compressQuality, setCompressQuality] = useState('medium');
  const [showAboutModal, setShowAboutModal] = useState(false);

  const handleFileChange = (event) => {
    setSelectedFiles(event.target.files);
  };

  const handleSplitClick = () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one PDF file to split.');
      return;
    }
    setShowSplitOptions(true);
  };

  const handleCompressClick = () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one PDF file to compress.');
      return;
    }
    setShowCompressOptions(true);
  };

  const handleSplitConfirm = () => {
    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append('files', file);
    }
    formData.append('split_type', splitType);
    if (splitType === 'custom') {
      formData.append('custom_ranges', customRanges);
    }

    fetch(`http://localhost:8000/api/split`, {
      method: 'POST',
      body: formData,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        return { blob, response };
      })
      .then(({ blob, response }) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `split_result.zip`;
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
          }
        }
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        alert(`Operation split completed successfully! File downloaded.`);
        setShowSplitOptions(false);
      })
      .catch((error) => {
        console.error(`Error with split:`, error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
          errorMessage = JSON.stringify(error);
        } else {
          errorMessage = String(error);
        }
        alert(`Error with split: ${errorMessage}`);
        setShowSplitOptions(false);
      });
  };

  const handleCompressConfirm = () => {
    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append('files', file);
    }
    formData.append('quality', compressQuality);

    fetch(`http://localhost:8000/api/compress-pdf`, {
      method: 'POST',
      body: formData,
    })
      .then(async (response) => {
        const contentType = response.headers.get('Content-Type');
        if (!response.ok) {
          // Try to parse error as JSON, fallback to text
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorMessage;
          } catch {
            try {
              errorMessage = await response.text();
            } catch {}
          }
          throw new Error(errorMessage);
        }
        // Only proceed if the response is a ZIP or PDF
        if (
          contentType &&
          (contentType.includes('application/zip') || contentType.includes('application/pdf'))
        ) {
          const blob = await response.blob();
          return { blob, response };
        } else {
          // Not a valid file, treat as error
          const text = await response.text();
          throw new Error(text || 'Unknown error occurred.');
        }
      })
      .then(({ blob, response }) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `compressed_pdfs.zip`;
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
          }
        }
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        alert(`PDF compression completed successfully! File downloaded.`);
        setShowCompressOptions(false);
      })
      .catch((error) => {
        console.error(`Error with compression:`, error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
          errorMessage = JSON.stringify(error);
        } else {
          errorMessage = String(error);
        }
        alert(`Error with compression: ${errorMessage}`);
        setShowCompressOptions(false);
      });
  };

  const handleOperation = (operation) => {
    const formData = new FormData();

    if (operation === 'merge') {
      if (selectedFiles.length < 2) {
        alert(`Please select at least two files for the merge operation.`);
        return;
      }
    } else if (selectedFiles.length === 0) {
      alert(`Please select at least one file for the ${operation} operation.`);
      return;
    }

    for (const file of selectedFiles) {
      formData.append('files', file);
    }

    fetch(`http://localhost:8000/api/${operation}`, {
      method: 'POST',
      body: formData,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        return { blob, response };
      })
      .then(({ blob, response }) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `${operation}_result`;
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
          }
        }
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        alert(`Operation ${operation} completed successfully! File downloaded.`);
      })
      .catch((error) => {
        console.error(`Error with ${operation}:`, error);
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'object' && error !== null) {
          errorMessage = JSON.stringify(error);
        } else {
          errorMessage = String(error);
        }
        alert(`Error with ${operation}: ${errorMessage}`);
      });
  };

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <nav className="main-nav">
            <div className="nav-brand">
              <Link to="/">📊 Dashboard</Link>
            </div>
            <div className="nav-links">
              <Link to="/pdf-tools">📄 PDF Tools</Link>
              <Link to="/image-tools">🖼️ Image Tools</Link>
              <button 
                className="about-button"
                onClick={() => setShowAboutModal(true)}
                title="About the Developer"
              >
                ❓ About
              </button>
            </div>
          </nav>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pdf-tools" element={
              <div className="main-content">
                <h1>PDF Tools</h1>
                <Card title="Select Files">
                  <input type="file" multiple onChange={handleFileChange} />
                </Card>
                <Card title="PDF Operations">
                  <button onClick={handleSplitClick}>Split PDF</button>
                  <button onClick={() => handleOperation('merge')}>Merge PDFs</button>
                  <button onClick={handleCompressClick}>Compress PDF</button>
                  <button onClick={() => handleOperation('pdf-to-doc')}>Convert PDF to DOC</button>
                  <button onClick={() => handleOperation('doc-to-pdf')}>Convert DOC to PDF</button>
                  <button onClick={() => handleOperation('extract-images')}>Extract Images from PDF</button>
                  <button onClick={() => handleOperation('images-to-pdf')}>Convert Images to PDF</button>
                </Card>
              </div>
            } />
            <Route path="/image-tools" element={<ImageTools />} />
          </Routes>

          {showSplitOptions && (
            <div className="modal">
              <div className="modal-content">
                <h2>Split Options</h2>
                <div>
                  <input
                    type="radio"
                    id="one-one"
                    name="splitType"
                    value="one-one"
                    checked={splitType === 'one-one'}
                    onChange={(e) => setSplitType(e.target.value)}
                  />
                  <label htmlFor="one-one">1-1 Page Split</label>
                </div>
                <div>
                  <input
                    type="radio"
                    id="two-two"
                    name="splitType"
                    value="two-two"
                    checked={splitType === 'two-two'}
                    onChange={(e) => setSplitType(e.target.value)}
                  />
                  <label htmlFor="two-two">2-2 Page Split</label>
                </div>
                <div>
                  <input
                    type="radio"
                    id="custom"
                    name="splitType"
                    value="custom"
                    checked={splitType === 'custom'}
                    onChange={(e) => setSplitType(e.target.value)}
                  />
                  <label htmlFor="custom">Custom Split (e.g., 1-4,6-7)</label>
                </div>
                {splitType === 'custom' && (
                  <input
                    type="text"
                    placeholder="Enter custom ranges (e.g., 1-4,6-7)"
                    value={customRanges}
                    onChange={(e) => setCustomRanges(e.target.value)}
                  />
                )}
                <button onClick={handleSplitConfirm}>Split</button>
                <button onClick={() => setShowSplitOptions(false)}>Cancel</button>
              </div>
            </div>
          )}

          {showCompressOptions && (
            <div className="modal">
              <div className="modal-content">
                <h2>Compression Options</h2>
                <div>
                  <input
                    type="radio"
                    id="low"
                    name="compressQuality"
                    value="low"
                    checked={compressQuality === 'low'}
                    onChange={(e) => setCompressQuality(e.target.value)}
                  />
                  <label htmlFor="low">Low Quality (Maximum Compression)</label>
                  <p className="option-description">Smallest file size, may reduce quality</p>
                </div>
                <div>
                  <input
                    type="radio"
                    id="medium"
                    name="compressQuality"
                    value="medium"
                    checked={compressQuality === 'medium'}
                    onChange={(e) => setCompressQuality(e.target.value)}
                  />
                  <label htmlFor="medium">Medium Quality (Balanced)</label>
                  <p className="option-description">Good balance between size and quality</p>
                </div>
                <div>
                  <input
                    type="radio"
                    id="high"
                    name="compressQuality"
                    value="high"
                    checked={compressQuality === 'high'}
                    onChange={(e) => setCompressQuality(e.target.value)}
                  />
                  <label htmlFor="high">High Quality (Minimal Compression)</label>
                  <p className="option-description">Best quality, moderate size reduction</p>
                </div>
                <button onClick={handleCompressConfirm}>Compress</button>
                <button onClick={() => setShowCompressOptions(false)}>Cancel</button>
              </div>
            </div>
          )}
        </header>
        
        {/* Footer */}
        <Footer />
        
        {/* Floating Badge */}
        <FloatingBadge />
        
        {/* About Modal */}
        <AboutModal 
          isOpen={showAboutModal} 
          onClose={() => setShowAboutModal(false)} 
        />
      </div>
    </Router>
  );
}

export default App;
