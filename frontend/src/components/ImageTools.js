import React, { useState, useRef, useEffect } from 'react';
import './ImageTools.css';

const ImageTools = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [imageInfo, setImageInfo] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [processingHistory, setProcessingHistory] = useState([]);
  const [showCropOverlay, setShowCropOverlay] = useState(false);
  const [cropSelection, setCropSelection] = useState({ x: 0, y: 0, width: 200, height: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState(null);
  const [operationQueue, setOperationQueue] = useState([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  
  // Image editing parameters
  const [editParams, setEditParams] = useState({
    resize: { width: 800, height: 600, maintainAspectRatio: true },
    crop: { left: 0, top: 0, width: 200, height: 200 },
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    blur: 0,
    sharpen: 1.0,
    compression: { quality: 80, format: 'JPEG' }
  });

  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const cropOverlayRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setOriginalImageUrl(url);
      setPreviewImageUrl(url);
      setImageInfo(null);
      setProcessingHistory([]);
      setShowCropOverlay(false);
      getImageInfo(file);
    }
  };

  const getImageInfo = async (file) => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/get-image-info`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setImageInfo(data);
    } catch (error) {
      console.error('Error getting image info:', error);
    }
  };

  const handleImageOperation = async (operation, params = {}) => {
    if (!selectedFile) {
      alert('Please select an image first.');
      return;
    }

    if (isBatchMode) {
      // Add to operation queue instead of applying immediately
      const newOperation = {
        id: Date.now(),
        operation,
        params,
        name: getOperationName(operation)
      };
      setOperationQueue(prev => [...prev, newOperation]);
      return;
    }

    await applySingleOperation(operation, params);
  };

  const applySingleOperation = async (operation, params = {}) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    // Add parameters to form data
    Object.keys(params).forEach(key => {
      formData.append(key, params[key]);
    });

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/${operation}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewImageUrl(url);
      
      // Add to processing history
      const historyItem = {
        id: Date.now(),
        operation,
        params,
        timestamp: new Date().toLocaleTimeString(),
        imageUrl: url
      };
      setProcessingHistory(prev => [historyItem, ...prev.slice(0, 9)]); // Keep last 10 operations

      // Get updated image info
      const tempFile = new File([blob], `processed_${selectedFile.name}`, { type: blob.type });
      getImageInfo(tempFile);

    } catch (error) {
      console.error(`Error with ${operation}:`, error);
      alert(`Error with ${operation}: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const applyBatchOperations = async () => {
    if (operationQueue.length === 0) {
      alert('No operations in queue. Add some operations first.');
      return;
    }

    setIsProcessing(true);
    setBatchProgress(0);
    let currentFile = selectedFile;

    try {
      for (let i = 0; i < operationQueue.length; i++) {
        const { operation, params } = operationQueue[i];
        setBatchProgress(((i + 1) / operationQueue.length) * 100);

        const formData = new FormData();
        formData.append('file', currentFile);

        // Add parameters to form data
        Object.keys(params).forEach(key => {
          formData.append(key, params[key]);
        });

        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/${operation}`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPreviewImageUrl(url);
        
        // Update current file for next operation
        currentFile = new File([blob], `processed_${selectedFile.name}`, { type: blob.type });
      }

      // Add batch operation to history
      const historyItem = {
        id: Date.now(),
        operation: 'batch',
        params: { operations: operationQueue },
        timestamp: new Date().toLocaleTimeString(),
        imageUrl: URL.createObjectURL(currentFile)
      };
      setProcessingHistory(prev => [historyItem, ...prev.slice(0, 9)]);

      // Clear queue and exit batch mode
      setOperationQueue([]);
      setIsBatchMode(false);
      setBatchProgress(0);

      // Get updated image info
      getImageInfo(currentFile);

    } catch (error) {
      console.error('Error with batch operations:', error);
      alert(`Error with batch operations: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setBatchProgress(0);
    }
  };

  const getOperationName = (operation) => {
    const operationNames = {
      'resize-image': 'Resize',
      'crop-image': 'Crop',
      'adjust-brightness': 'Brightness',
      'adjust-contrast': 'Contrast',
      'adjust-saturation': 'Saturation',
      'apply-blur': 'Blur',
      'apply-sharpen': 'Sharpen',
      'convert-to-grayscale': 'Grayscale',
      'rotate-image': 'Rotate',
      'flip-image': 'Flip',
      'compress-image': 'Compress'
    };
    return operationNames[operation] || operation;
  };

  const removeFromQueue = (operationId) => {
    setOperationQueue(prev => prev.filter(op => op.id !== operationId));
  };

  const clearQueue = () => {
    setOperationQueue([]);
  };

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    if (isBatchMode) {
      setOperationQueue([]);
    }
  };

  const downloadImage = () => {
    if (previewImageUrl) {
      const a = document.createElement('a');
      a.href = previewImageUrl;
      a.download = `edited_${selectedFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const resetImage = () => {
    setPreviewImageUrl(originalImageUrl);
    setProcessingHistory([]);
    setShowCropOverlay(false);
    if (selectedFile) {
      getImageInfo(selectedFile);
    }
  };

  const applyResize = () => {
    const { width, height, maintainAspectRatio } = editParams.resize;
    handleImageOperation('resize-image', { width, height });
  };

  const applyCrop = () => {
    if (showCropOverlay) {
      // Use visual crop selection - convert to actual image coordinates
      const { x, y, width, height } = cropSelection;
      
      // Get the actual image dimensions and displayed dimensions
      if (imageRef.current && imageInfo) {
        const imageRect = imageRef.current.getBoundingClientRect();
        const overlayRect = cropOverlayRef.current.getBoundingClientRect();
        const actualWidth = imageInfo.size[0];
        const actualHeight = imageInfo.size[1];
        
        // Calculate the image position relative to the overlay
        const imageOffsetX = imageRect.left - overlayRect.left;
        const imageOffsetY = imageRect.top - overlayRect.top;
        
        // Calculate scale factors
        const scaleX = actualWidth / imageRect.width;
        const scaleY = actualHeight / imageRect.height;
        
        // Convert visual coordinates to actual image coordinates
        // Subtract the image offset to get coordinates relative to the image
        const left = Math.round((x - imageOffsetX) * scaleX);
        const top = Math.round((y - imageOffsetY) * scaleY);
        const right = Math.round((x - imageOffsetX + width) * scaleX);
        const bottom = Math.round((y - imageOffsetY + height) * scaleY);
        
        // Ensure coordinates are within bounds
        const finalLeft = Math.max(0, Math.min(left, actualWidth - 1));
        const finalTop = Math.max(0, Math.min(top, actualHeight - 1));
        const finalRight = Math.max(finalLeft + 1, Math.min(right, actualWidth));
        const finalBottom = Math.max(finalTop + 1, Math.min(bottom, actualHeight));
        
        console.log('Crop coordinates:', {
          visual: { x, y, width, height },
          imageOffset: { imageOffsetX, imageOffsetY },
          calculated: { left, top, right, bottom },
          final: { finalLeft, finalTop, finalRight, finalBottom },
          imageSize: { actualWidth, actualHeight },
          displaySize: { width: imageRect.width, height: imageRect.height }
        });
        
        handleImageOperation('crop-image', { 
          left: finalLeft, 
          top: finalTop, 
          right: finalRight, 
          bottom: finalBottom 
        });
      }
      setShowCropOverlay(false);
    } else {
      // Use manual crop coordinates
      const { left, top, width, height } = editParams.crop;
      handleImageOperation('crop-image', { 
        left, 
        top, 
        right: left + width, 
        bottom: top + height 
      });
    }
  };

  const startCropMode = () => {
    setShowCropOverlay(true);
    // Initialize crop selection to center of image
    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const centerX = (rect.width - 200) / 2;
      const centerY = (rect.height - 200) / 2;
      setCropSelection({ x: centerX, y: centerY, width: 200, height: 200 });
    }
  };

  const cancelCropMode = () => {
    setShowCropOverlay(false);
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };

  // Add keyboard event listener for ESC key to cancel crop mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showCropOverlay) {
        cancelCropMode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCropOverlay]);

  // Mouse event handlers for crop selection
  const handleMouseDown = (e) => {
    if (!showCropOverlay || !cropOverlayRef.current) return;

    e.preventDefault(); // Prevent default to avoid text selection
    const rect = cropOverlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on resize handles
    const handleSize = 10;
    const { x: cropX, y: cropY, width, height } = cropSelection;

    // Check corners for resizing
    if (x >= cropX + width - handleSize && x <= cropX + width + handleSize &&
        y >= cropY + height - handleSize && y <= cropY + height + handleSize) {
      setIsResizing(true);
      setResizeHandle('se');
    } else if (x >= cropX - handleSize && x <= cropX + handleSize &&
               y >= cropY - handleSize && y <= cropY + handleSize) {
      setIsResizing(true);
      setResizeHandle('nw');
    } else if (x >= cropX + width - handleSize && x <= cropX + width + handleSize &&
               y >= cropY - handleSize && y <= cropY + handleSize) {
      setIsResizing(true);
      setResizeHandle('ne');
    } else if (x >= cropX - handleSize && x <= cropX + handleSize &&
               y >= cropY + height - handleSize && y <= cropY + height + handleSize) {
      setIsResizing(true);
      setResizeHandle('sw');
    } else if (x >= cropX && x <= cropX + width && y >= cropY && y <= cropY + height) {
      // Dragging the selection
      setIsDragging(true);
      setDragStart({ x: x - cropX, y: y - cropY, isDragging: true });
    } else {
      // Creating a new selection
      setIsDragging(true);
      setDragStart({ x, y, isDragging: false });
      setCropSelection({ x, y, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e) => {
    if (!showCropOverlay || !cropOverlayRef.current) return;

    e.preventDefault(); // Prevent default to avoid text selection
    const rect = cropOverlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      if (dragStart.isDragging) {
        // This is dragging an existing selection
        const newX = Math.max(0, Math.min(rect.width - cropSelection.width, x - dragStart.x));
        const newY = Math.max(0, Math.min(rect.height - cropSelection.height, y - dragStart.y));
        setCropSelection(prev => ({ ...prev, x: newX, y: newY }));
      } else {
        // This is creating a new selection
        const newX = Math.min(dragStart.x, x);
        const newY = Math.min(dragStart.y, y);
        const newWidth = Math.abs(x - dragStart.x);
        const newHeight = Math.abs(y - dragStart.y);
        
        // Ensure minimum size
        const finalWidth = Math.max(50, newWidth);
        const finalHeight = Math.max(50, newHeight);
        
        // Ensure selection stays within bounds
        const finalX = Math.max(0, Math.min(rect.width - finalWidth, newX));
        const finalY = Math.max(0, Math.min(rect.height - finalHeight, newY));
        
        setCropSelection({ x: finalX, y: finalY, width: finalWidth, height: finalHeight });
      }
    } else if (isResizing) {
      let newWidth = cropSelection.width;
      let newHeight = cropSelection.height;
      let newX = cropSelection.x;
      let newY = cropSelection.y;

      switch (resizeHandle) {
        case 'se':
          newWidth = Math.max(50, x - cropSelection.x);
          newHeight = Math.max(50, y - cropSelection.y);
          break;
        case 'nw':
          newWidth = Math.max(50, cropSelection.x + cropSelection.width - x);
          newHeight = Math.max(50, cropSelection.y + cropSelection.height - y);
          newX = x;
          newY = y;
          break;
        case 'ne':
          newWidth = Math.max(50, x - cropSelection.x);
          newHeight = Math.max(50, cropSelection.y + cropSelection.height - y);
          newY = y;
          break;
        case 'sw':
          newWidth = Math.max(50, cropSelection.x + cropSelection.width - x);
          newHeight = Math.max(50, y - cropSelection.y);
          newX = x;
          break;
      }

      // Ensure selection stays within bounds
      newX = Math.max(0, Math.min(rect.width - newWidth, newX));
      newY = Math.max(0, Math.min(rect.height - newHeight, newY));
      newWidth = Math.min(newWidth, rect.width - newX);
      newHeight = Math.min(newHeight, rect.height - newY);

      setCropSelection({ x: newX, y: newY, width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };

  const applyBrightness = () => {
    handleImageOperation('adjust-brightness', { factor: editParams.brightness });
  };

  const applyContrast = () => {
    handleImageOperation('adjust-contrast', { factor: editParams.contrast });
  };

  const applySaturation = () => {
    handleImageOperation('adjust-saturation', { factor: editParams.saturation });
  };

  const applyBlur = () => {
    handleImageOperation('apply-blur', { radius: editParams.blur });
  };

  const applySharpen = () => {
    handleImageOperation('apply-sharpen', { factor: editParams.sharpen });
  };

  const applyCompression = () => {
    const { quality, format } = editParams.compression;
    handleImageOperation('compress-image', { quality, format });
  };

  const quickOperations = [
    { name: 'Grayscale', operation: 'convert-to-grayscale' },
    { name: 'Rotate 90°', operation: 'rotate-image', params: { angle: 90 } },
    { name: 'Rotate 180°', operation: 'rotate-image', params: { angle: 180 } },
    { name: 'Rotate 270°', operation: 'rotate-image', params: { angle: 270 } },
    { name: 'Flip Horizontal', operation: 'flip-image', params: { direction: 'horizontal' } },
    { name: 'Flip Vertical', operation: 'flip-image', params: { direction: 'vertical' } },
  ];

  return (
    <div className="image-tools">
      <div className="header">
        <h1>🖼️ Professional Image Editor</h1>
        <p>Edit, enhance, and optimize your images with real-time preview</p>
      </div>

      <div className="main-container">
        {/* File Upload Section */}
        <div className="upload-section">
          <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
            {!selectedFile ? (
              <div className="upload-placeholder">
                <i className="upload-icon">📁</i>
                <p>Click to select an image or drag and drop</p>
                <span>Supports: JPG, PNG, GIF, WebP</span>
              </div>
            ) : (
              <div className="file-info">
                <p>📷 {selectedFile.name}</p>
                <p>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {selectedFile && (
          <div className="editor-layout">
            {/* Left Side - Preview and Quick Actions */}
            <div className="left-panel">
              {/* Image Preview */}
              <div className="preview-container">
                <div className="preview-header">
                  <h3>Image Preview</h3>
                  <div className="preview-controls">
                    <button onClick={resetImage} className="btn-secondary">Reset</button>
                    <button onClick={downloadImage} className="btn-primary">Download</button>
                  </div>
                </div>
                <div className="image-preview" ref={cropOverlayRef}>
                  {previewImageUrl && (
                    <>
                      <img 
                        ref={imageRef}
                        src={previewImageUrl} 
                        alt="Preview" 
                        className="preview-image"
                      />
                      {showCropOverlay && (
                        <div 
                          className="crop-overlay"
                          onMouseDown={handleMouseDown}
                          onMouseMove={handleMouseMove}
                          onMouseUp={handleMouseUp}
                          onMouseLeave={handleMouseUp}
                        >
                          <div 
                            className="crop-selection"
                            style={{
                              left: cropSelection.x,
                              top: cropSelection.y,
                              width: cropSelection.width,
                              height: cropSelection.height
                            }}
                          >
                            <div className="crop-handle crop-handle-nw"></div>
                            <div className="crop-handle crop-handle-ne"></div>
                            <div className="crop-handle crop-handle-sw"></div>
                            <div className="crop-handle crop-handle-se"></div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {isProcessing && (
                    <div className="processing-overlay">
                      <div className="spinner"></div>
                      <p>Processing...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="quick-actions-panel">
                <h3>Quick Actions</h3>
                <div className="quick-grid">
                  {quickOperations.map((op) => (
                    <button
                      key={op.name}
                      onClick={() => handleImageOperation(op.operation, op.params || {})}
                      className="quick-btn"
                    >
                      {op.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Information */}
              {imageInfo && (
                <div className="image-info-panel">
                  <h3>Image Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Dimensions:</span>
                      <span className="info-value">{imageInfo.size[0]} × {imageInfo.size[1]} px</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Format:</span>
                      <span className="info-value">{imageInfo.format || 'Unknown'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Color Mode:</span>
                      <span className="info-value">{imageInfo.mode || 'Unknown'}</span>
                    </div>
                    {imageInfo.compression_info && (
                      <>
                        <div className="info-item">
                          <span className="info-label">File Size:</span>
                          <span className="info-value">{imageInfo.compression_info.original_size_readable}</span>
                        </div>
                        <div className="compression-analysis">
                          <h4>Compression Analysis</h4>
                          <div className="compression-grid">
                            {Object.entries(imageInfo.compression_info.formats_analysis).map(([format, data]) => (
                              data && (
                                <div key={format} className="compression-item">
                                  <span className="format-name">{format}</span>
                                  <span className="format-size">{data.size_readable}</span>
                                  <span className={`compression-ratio ${data.quality_score.toLowerCase()}`}>
                                    {data.compression_ratio > 0 ? `-${data.compression_ratio.toFixed(1)}%` : 'N/A'}
                                  </span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side - Editing Tools */}
            <div className="right-panel">
              <div className="editing-tools">
                <div className="tabs">
                  <button 
                    className={`tab ${activeTab === 'basic' ? 'active' : ''}`}
                    onClick={() => setActiveTab('basic')}
                  >
                    Basic Tools {isBatchMode && <span className="batch-indicator">●</span>}
                  </button>
                  <button 
                    className={`tab ${activeTab === 'advanced' ? 'active' : ''}`}
                    onClick={() => setActiveTab('advanced')}
                  >
                    Advanced Tools {isBatchMode && <span className="batch-indicator">●</span>}
                  </button>
                  <button 
                    className={`tab ${activeTab === 'batch' ? 'active' : ''}`}
                    onClick={() => setActiveTab('batch')}
                  >
                    Batch Mode
                  </button>
                  <button 
                    className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                  >
                    History
                  </button>
                </div>

                <div className="tab-content">
                  {activeTab === 'basic' && (
                    <div className="basic-tools">
                      {isBatchMode && (
                        <div className="batch-status">
                          <div className="batch-status-indicator">
                            <span className="batch-dot">●</span>
                            Batch Mode Active - Operations will be queued
                          </div>
                        </div>
                      )}
                      <div className="tool-group">
                        <h3>Resize</h3>
                        <div className="tool-controls">
                          <div className="input-group">
                            <label>Width:</label>
                            <input
                              type="number"
                              value={editParams.resize.width}
                              onChange={(e) => setEditParams({
                                ...editParams,
                                resize: { ...editParams.resize, width: parseInt(e.target.value) }
                              })}
                            />
                          </div>
                          <div className="input-group">
                            <label>Height:</label>
                            <input
                              type="number"
                              value={editParams.resize.height}
                              onChange={(e) => setEditParams({
                                ...editParams,
                                resize: { ...editParams.resize, height: parseInt(e.target.value) }
                              })}
                            />
                          </div>
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={editParams.resize.maintainAspectRatio}
                              onChange={(e) => setEditParams({
                                ...editParams,
                                resize: { ...editParams.resize, maintainAspectRatio: e.target.checked }
                              })}
                            />
                            Maintain Aspect Ratio
                          </label>
                          <button onClick={applyResize} className="btn-apply">
                            {isBatchMode ? 'Add Resize to Queue' : 'Apply Resize'}
                          </button>
                        </div>
                      </div>

                      <div className="tool-group">
                        <h3>Crop</h3>
                        <div className="tool-controls">
                          {!showCropOverlay ? (
                            <>
                              <p className="crop-instructions">Click "Start Crop Mode" to visually select the area you want to crop.</p>
                              <button onClick={startCropMode} className="btn-apply">Start Crop Mode</button>
                              <div className="manual-crop-fallback">
                                <h4>Or use manual coordinates:</h4>
                                <div className="input-group">
                                  <label>Left:</label>
                                  <input
                                    type="number"
                                    value={editParams.crop.left}
                                    onChange={(e) => setEditParams({
                                      ...editParams,
                                      crop: { ...editParams.crop, left: parseInt(e.target.value) }
                                    })}
                                  />
                                </div>
                                <div className="input-group">
                                  <label>Top:</label>
                                  <input
                                    type="number"
                                    value={editParams.crop.top}
                                    onChange={(e) => setEditParams({
                                      ...editParams,
                                      crop: { ...editParams.crop, top: parseInt(e.target.value) }
                                    })}
                                  />
                                </div>
                                <div className="input-group">
                                  <label>Width:</label>
                                  <input
                                    type="number"
                                    value={editParams.crop.width}
                                    onChange={(e) => setEditParams({
                                      ...editParams,
                                      crop: { ...editParams.crop, width: parseInt(e.target.value) }
                                    })}
                                  />
                                </div>
                                <div className="input-group">
                                  <label>Height:</label>
                                  <input
                                    type="number"
                                    value={editParams.crop.height}
                                    onChange={(e) => setEditParams({
                                      ...editParams,
                                      crop: { ...editParams.crop, height: parseInt(e.target.value) }
                                    })}
                                  />
                                </div>
                                <button onClick={applyCrop} className="btn-apply">Apply Manual Crop</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="crop-instructions">
                                <strong>Crop Mode Active:</strong><br/>
                                • Click and drag to create a new selection<br/>
                                • Drag the selection box to move it<br/>
                                • Drag the corner handles to resize<br/>
                                • Click "Apply Crop" when ready
                              </p>
                              <div className="crop-controls">
                                <button onClick={applyCrop} className="btn-apply">Apply Crop</button>
                                <button onClick={cancelCropMode} className="btn-secondary">Cancel (ESC)</button>
                              </div>
                              <div className="crop-info">
                                <p>Selection: {Math.round(cropSelection.width)} × {Math.round(cropSelection.height)} px</p>
                                <p>Position: ({Math.round(cropSelection.x)}, {Math.round(cropSelection.y)})</p>
                                {imageInfo && (
                                  <p>Image Size: {imageInfo.size[0]} × {imageInfo.size[1]} px</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'advanced' && (
                    <div className="advanced-tools">
                      {isBatchMode && (
                        <div className="batch-status">
                          <div className="batch-status-indicator">
                            <span className="batch-dot">●</span>
                            Batch Mode Active - Operations will be queued
                          </div>
                        </div>
                      )}
                      <div className="tool-group">
                        <h3>Brightness</h3>
                        <div className="slider-control">
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={editParams.brightness}
                            onChange={(e) => setEditParams({
                              ...editParams,
                              brightness: parseFloat(e.target.value)
                            })}
                          />
                          <span>{editParams.brightness}</span>
                          <button onClick={applyBrightness} className="btn-apply">
                            {isBatchMode ? 'Add to Queue' : 'Apply'}
                          </button>
                        </div>
                      </div>

                      <div className="tool-group">
                        <h3>Contrast</h3>
                        <div className="slider-control">
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={editParams.contrast}
                            onChange={(e) => setEditParams({
                              ...editParams,
                              contrast: parseFloat(e.target.value)
                            })}
                          />
                          <span>{editParams.contrast}</span>
                          <button onClick={applyContrast} className="btn-apply">
                            {isBatchMode ? 'Add to Queue' : 'Apply'}
                          </button>
                        </div>
                      </div>

                      <div className="tool-group">
                        <h3>Saturation</h3>
                        <div className="slider-control">
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={editParams.saturation}
                            onChange={(e) => setEditParams({
                              ...editParams,
                              saturation: parseFloat(e.target.value)
                            })}
                          />
                          <span>{editParams.saturation}</span>
                          <button onClick={applySaturation} className="btn-apply">
                            {isBatchMode ? 'Add to Queue' : 'Apply'}
                          </button>
                        </div>
                      </div>

                      <div className="tool-group">
                        <h3>Blur</h3>
                        <div className="slider-control">
                          <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.5"
                            value={editParams.blur}
                            onChange={(e) => setEditParams({
                              ...editParams,
                              blur: parseFloat(e.target.value)
                            })}
                          />
                          <span>{editParams.blur}</span>
                          <button onClick={applyBlur} className="btn-apply">
                            {isBatchMode ? 'Add to Queue' : 'Apply'}
                          </button>
                        </div>
                      </div>

                      <div className="tool-group">
                        <h3>Sharpen</h3>
                        <div className="slider-control">
                          <input
                            type="range"
                            min="0"
                            max="3"
                            step="0.1"
                            value={editParams.sharpen}
                            onChange={(e) => setEditParams({
                              ...editParams,
                              sharpen: parseFloat(e.target.value)
                            })}
                          />
                          <span>{editParams.sharpen}</span>
                          <button onClick={applySharpen} className="btn-apply">
                            {isBatchMode ? 'Add to Queue' : 'Apply'}
                          </button>
                        </div>
                      </div>

                      <div className="tool-group">
                        <h3>Compression</h3>
                        <div className="tool-controls">
                          <div className="input-group">
                            <label>Quality:</label>
                            <input
                              type="range"
                              min="1"
                              max="100"
                              value={editParams.compression.quality}
                              onChange={(e) => setEditParams({
                                ...editParams,
                                compression: { ...editParams.compression, quality: parseInt(e.target.value) }
                              })}
                            />
                            <span>{editParams.compression.quality}%</span>
                          </div>
                          <div className="input-group">
                            <label>Format:</label>
                            <select
                              value={editParams.compression.format}
                              onChange={(e) => setEditParams({
                                ...editParams,
                                compression: { ...editParams.compression, format: e.target.value }
                              })}
                            >
                              <option value="JPEG">JPEG</option>
                              <option value="PNG">PNG</option>
                              <option value="WebP">WebP</option>
                            </select>
                          </div>
                          <button onClick={applyCompression} className="btn-apply">
                            {isBatchMode ? 'Add Compression to Queue' : 'Apply Compression'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'batch' && (
                    <div className="batch-mode">
                      <div className="batch-header">
                        <h3>Batch Processing Mode</h3>
                        <button 
                          onClick={toggleBatchMode} 
                          className={`btn-toggle ${isBatchMode ? 'active' : ''}`}
                        >
                          {isBatchMode ? 'Exit Batch Mode' : 'Enable Batch Mode'}
                        </button>
                      </div>
                      
                      {isBatchMode ? (
                        <div className="batch-content">
                          <div className="batch-instructions">
                            <p>Batch mode is enabled! Operations will be queued instead of applied immediately.</p>
                            <p>Add operations below, then click "Apply All" to process them in sequence.</p>
                          </div>
                          
                          {batchProgress > 0 && (
                            <div className="batch-progress">
                              <div className="progress-bar">
                                <div 
                                  className="progress-fill" 
                                  style={{ width: `${batchProgress}%` }}
                                ></div>
                              </div>
                              <span>{Math.round(batchProgress)}% Complete</span>
                            </div>
                          )}
                          
                          <div className="operation-queue">
                            <h4>Operation Queue ({operationQueue.length})</h4>
                            {operationQueue.length === 0 ? (
                              <p className="no-operations">No operations in queue. Add some operations from Basic or Advanced tabs.</p>
                            ) : (
                              <div className="queue-list">
                                {operationQueue.map((op, index) => (
                                  <div key={op.id} className="queue-item">
                                    <div className="queue-info">
                                      <span className="queue-number">{index + 1}</span>
                                      <span className="queue-name">{op.name}</span>
                                      <span className="queue-params">
                                        {Object.entries(op.params).map(([key, value]) => `${key}: ${value}`).join(', ')}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => removeFromQueue(op.id)}
                                      className="btn-remove"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          {operationQueue.length > 0 && (
                            <div className="batch-controls">
                              <button onClick={applyBatchOperations} className="btn-apply">
                                Apply All Operations ({operationQueue.length})
                              </button>
                              <button onClick={clearQueue} className="btn-secondary">
                                Clear Queue
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="batch-disabled">
                          <p>Enable batch mode to apply multiple operations at once.</p>
                          <p>This allows you to:</p>
                          <ul>
                            <li>Queue multiple operations</li>
                            <li>Apply them in sequence</li>
                            <li>See the final result</li>
                            <li>Save processing time</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'history' && (
                    <div className="history">
                      <h3>Processing History</h3>
                      {processingHistory.length === 0 ? (
                        <p className="no-history">No operations performed yet.</p>
                      ) : (
                        <div className="history-list">
                          {processingHistory.map((item) => (
                            <div key={item.id} className="history-item">
                              <div className="history-info">
                                <span className="operation-name">
                                  {item.operation === 'batch' ? 'Batch Operations' : item.operation}
                                </span>
                                <span className="operation-time">{item.timestamp}</span>
                              </div>
                              <button
                                onClick={() => setPreviewImageUrl(item.imageUrl)}
                                className="btn-restore"
                              >
                                Restore
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageTools;