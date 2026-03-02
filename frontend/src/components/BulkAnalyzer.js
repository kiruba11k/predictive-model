import React, { useState, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  FaCloudUploadAlt,
  FaFileCsv,
  FaChartBar,
  FaDownload,
  FaSpinner,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTable,
  FaChartPie,
  FaFileExcel,
  FaUpload,
  FaEye,
  FaMagic,
  FaCheck,
  FaTimes,
  FaDatabase,
  FaPercentage,
  FaClock,
  FaHourglassHalf,
  FaInfoCircle,
  FaBan,
  FaExclamationCircle,
  FaPlay
} from 'react-icons/fa';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const BulkAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [originalHeaders, setOriginalHeaders] = useState([]);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState([]);
  const [activeTab, setActiveTab] = useState('table');
  const [progress, setProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [jobInfo, setJobInfo] = useState(null);
  const [currentRow, setCurrentRow] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const BASE_URL = 'https://predictive-model-backend.onrender.com';
  const COLORS = ['#00ffff', '#ff00ff', '#00ff88', '#ff8800', '#8884d8'];

  // Check server health on component mount
  React.useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
      if (response.status === 200) {
        setServerStatus('online');
        setError(null);
      } else {
        setServerStatus('offline');
      }
    } catch (err) {
      console.error('Server health check failed:', err);
      setServerStatus('offline');
    }
  };

  const normalizeHeader = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const resolvePainPointHeader = (headers = []) => {
    if (!headers.length) return null;

    const exact = headers.find(h => normalizeHeader(h) === 'painpoint');
    if (exact) return exact;

    const fuzzy = headers.find(h => {
      const normalized = normalizeHeader(h);
      return normalized.includes('pain') && normalized.includes('point');
    });

    return fuzzy || null;
  };

  const buildRowsFromSheetData = (jsonData) => {
    if (!jsonData?.length) {
      throw new Error('File appears to be empty');
    }

    const headers = jsonData[0].map(h => String(h).trim());
    const allData = jsonData.slice(1)
      .filter(row => row.some(cell => String(cell ?? '').trim()))
      .map(row => headers.reduce((obj, header, index) => {
        obj[header] = row[index] ?? '';
        return obj;
      }, {}));

    return { headers, allData };
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv') || 
          file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.name.endsWith('.xlsx')) {
        setFile(file);
        setError(null);
        setResults(null);
        previewFile(file);
      } else {
        setError('Please upload a CSV or Excel file');
      }
    }
  };

  const previewFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (file.name.endsWith('.csv')) {
          const workbook = XLSX.read(e.target.result, { type: 'string' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
            defval: '',
            raw: false
          });

          const { headers, allData } = buildRowsFromSheetData(jsonData);
          setOriginalHeaders(headers);

          setOriginalData(allData);
          setTotalRows(allData.length);

          const previewData = allData.slice(0, 5);
          setPreview({ headers, data: previewData });
        } else {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
            defval: '',
            raw: false
          });
          const { headers, allData } = buildRowsFromSheetData(jsonData);
          setOriginalHeaders(headers);

          setOriginalData(allData);
          setTotalRows(allData.length);
          
          const previewData = allData.slice(0, 5);
          setPreview({ headers, data: previewData });
        }
      } catch (err) {
        console.error('Preview error:', err);
        setError('Error previewing file');
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const processBulkAnalysis = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    if (serverStatus === 'offline') {
      setError('Server is offline. Please wait for it to start up.');
      return;
    }

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    setProcessing(true);
    setProgress(0);
    setError(null);
    setResults(null);
    setStartTime(Date.now());
    setEstimatedTime(null);
    setCurrentRow(0);

    const results_array = [];
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    setJobInfo({
      total: totalRows,
      current: 0,
      message: `Processing ${totalRows} records...`
    });

    try {
      const painPointHeader = resolvePainPointHeader(originalHeaders);

      if (!painPointHeader) {
        setError('Could not find pain_point column. Please ensure header is named pain_point (or similar).');
        setProcessing(false);
        return;
      }

      const findPainPointValue = (row) => {
        if (row[painPointHeader] !== undefined) {
          return row[painPointHeader];
        }

        const fallbackKey = Object.keys(row).find(
          key => normalizeHeader(key) === normalizeHeader(painPointHeader)
        );

        return fallbackKey ? row[fallbackKey] : '';
      };

      const predictWithRetry = async (painPointText, maxRetries = 3) => {
        let attempt = 0;

        while (attempt < maxRetries) {
          try {
            return await axios.post(
              `${BASE_URL}/predict?pain_point=${encodeURIComponent(painPointText)}`,
              null,
              {
                signal: abortControllerRef.current.signal,
                timeout: 45000
              }
            );
          } catch (err) {
            if (axios.isCancel(err)) {
              throw err;
            }

            attempt += 1;
            if (attempt >= maxRetries) {
              throw err;
            }

            const backoffMs = 1500 * attempt;
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      };

      // Process each row sequentially and wait for each prediction
      for (let i = 0; i < originalData.length; i++) {
        const row = originalData[i];
        const pain_point = findPainPointValue(row);
        
        // Update current row
        setCurrentRow(i + 1);
        
        // Skip empty pain points
        if (!pain_point || !pain_point.toString().trim()) {
          results_array.push({
            ...row,
            prediction: 'Skipped',
            probability: 0,
            success_probability: 0,
            confidence: 'N/A',
            note: 'Empty pain point - skipped'
          });
          skipped++;
          
          // Update progress
          const progressPercent = Math.round(((i + 1) / totalRows) * 100);
          setProgress(progressPercent);
          setJobInfo(prev => ({
            ...prev,
            current: i + 1,
            progress: progressPercent
          }));
          continue;
        }

        try {
          // Call /predict endpoint for each row with retries (Render free tier can cold-start)
          const response = await predictWithRetry(pain_point.toString().trim());

          if (response.data) {
            const prediction = response.data.prediction;
            const probability = response.data.probability;
            
            if (prediction === 'Success') {
              successful++;
            } else {
              failed++;
            }

            results_array.push({
              ...row,
              prediction: prediction,
              probability: probability,
              success_probability: prediction === 'Success' ? probability : 1 - probability,
              confidence: probability > 0.8 ? 'High' : probability > 0.5 ? 'Medium' : 'Low'
            });
          }
        } catch (err) {
          console.error(`Error processing row ${i + 1}:`, err);
          
          if (axios.isCancel(err)) {
            // Request was cancelled
            setProcessing(false);
            return;
          }

          results_array.push({
            ...row,
            prediction: 'Error',
            probability: 0,
            success_probability: 0,
            confidence: 'N/A',
            error: err.message || 'Request failed'
          });
          failed++;
        }

        // Update progress
        const progressPercent = Math.round(((i + 1) / totalRows) * 100);
        setProgress(progressPercent);
        setJobInfo(prev => ({
          ...prev,
          current: i + 1,
          progress: progressPercent
        }));

        // Calculate estimated time remaining
        if (i > 0 && startTime) {
          const elapsedSeconds = (Date.now() - startTime) / 1000;
          const avgTimePerRow = elapsedSeconds / (i + 1);
          const remainingRows = totalRows - (i + 1);
          const remainingSeconds = avgTimePerRow * remainingRows;
          
          if (remainingSeconds > 0 && remainingSeconds < 3600) {
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = Math.floor(remainingSeconds % 60);
            setEstimatedTime(`${minutes}m ${seconds}s`);
          }
        }

        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // All rows processed
      const summary = {
        total: totalRows,
        successful: successful,
        failed: failed,
        skipped: skipped,
        successRate: successful > 0 ? (successful / (successful + failed) * 100) : 0
      };

      setResults({
        predictions: results_array,
        summary: summary
      });
      
      setProcessing(false);
      setProgress(100);

    } catch (err) {
      console.error('Bulk processing error:', err);
      setError(err.message || 'Failed to process bulk data');
      setProcessing(false);
    }
  };

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setProcessing(false);
      setError('Processing cancelled by user');
    }
  };

  const downloadResults = () => {
    if (!results || !originalData) return;

    try {
      // Create worksheet with all data
      const ws = XLSX.utils.json_to_sheet(results.predictions);
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Predictions');
      
      // Add summary sheet
      const summaryData = [
        ['Bulk Prediction Summary'],
        ['Generated:', new Date().toLocaleString()],
        [''],
        ['Total Records', results.summary.total],
        ['Successful Predictions', results.summary.successful],
        ['Failed Predictions', results.summary.failed],
        ['Skipped Rows', results.summary.skipped],
        ['Success Rate', `${results.summary.successRate.toFixed(2)}%`]
      ];
      
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
      
      // Save file
      XLSX.writeFile(wb, `bulk-predictions-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download results');
    }
  };

  const renderServerStatus = () => {
    if (serverStatus === 'checking') {
      return (
        <div className="server-status checking">
          <FaSpinner className="spinner" />
          <span>Checking server connection...</span>
        </div>
      );
    } else if (serverStatus === 'offline') {
      return (
        <div className="server-status offline">
          <FaExclamationCircle />
          <span>Server is offline. Please try again later.</span>
        </div>
      );
    }
    return null;
  };

  const renderSummary = () => {
    if (!results) return null;

    const summary = results.summary;

    return (
      <div className="summary-cards">
        <div className="summary-card">
          <FaDatabase className="summary-icon" />
          <div className="summary-content">
            <h3>Total Records</h3>
            <p className="summary-value">{summary.total}</p>
          </div>
        </div>
        <div className="summary-card">
          <FaCheck className="summary-icon success-icon" />
          <div className="summary-content">
            <h3>Successful</h3>
            <p className="summary-value success">{summary.successful}</p>
          </div>
        </div>
        <div className="summary-card">
          <FaTimes className="summary-icon failure-icon" />
          <div className="summary-content">
            <h3>Failed</h3>
            <p className="summary-value failure">{summary.failed}</p>
          </div>
        </div>
        <div className="summary-card">
          <FaBan className="summary-icon skip-icon" />
          <div className="summary-content">
            <h3>Skipped</h3>
            <p className="summary-value skipped">{summary.skipped}</p>
          </div>
        </div>
        <div className="summary-card">
          <FaPercentage className="summary-icon rate-icon" />
          <div className="summary-content">
            <h3>Success Rate</h3>
            <p className="summary-value">{summary.successRate.toFixed(2)}%</p>
          </div>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!results || !originalData) return null;

    const previewData = results.predictions.slice(0, 10);
    const allHeaders = [...originalHeaders, 'Prediction', 'Probability', 'Success Probability', 'Confidence', 'Note'];

    return (
      <div className="table-container">
        <table className="results-table">
          <thead>
            <tr>
              {allHeaders.map((header, index) => (
                <th key={index}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {originalHeaders.map((header, colIndex) => (
                  <td key={colIndex}>{row[header]}</td>
                ))}
                <td>
                  <span className={`prediction-badge ${row.prediction?.toLowerCase()}`}>
                    {row.prediction === 'Success' && <FaCheck />}
                    {row.prediction === 'Failure' && <FaTimes />}
                    {row.prediction === 'Skipped' && <FaBan />}
                    {row.prediction === 'Error' && <FaExclamationCircle />}
                    {row.prediction}
                  </span>
                </td>
                <td>{row.probability ? `${(row.probability * 100).toFixed(2)}%` : 'N/A'}</td>
                <td>{row.success_probability ? `${(row.success_probability * 100).toFixed(2)}%` : 'N/A'}</td>
                <td>
                  <span className={`confidence-badge ${row.confidence?.toLowerCase()}`}>
                    {row.confidence}
                  </span>
                </td>
                <td>{row.note || row.error || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalRows > 10 && (
          <div className="table-note">
            Showing first 10 of {totalRows} records. Download Excel for complete results.
          </div>
        )}
      </div>
    );
  };

  const renderCharts = () => {
    if (!results) return null;

    const summary = results.summary;

    const pieData = [
      { name: 'Successful', value: summary.successful },
      { name: 'Failed', value: summary.failed },
      { name: 'Skipped', value: summary.skipped }
    ].filter(item => item.value > 0);

    return (
      <div className="charts-container">
        <div className="chart-card">
          <h3>Distribution Results</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="bulk-analyzer">
      <div className="bulk-header">
        <h2>
          <FaMagic /> Bulk Analysis
        </h2>
        <p>Upload a CSV or Excel file - each row will be processed using the /predict endpoint</p>
      </div>

      {renderServerStatus()}

      <div className="upload-section">
        <div 
          className={`upload-area ${file ? 'file-selected' : ''}`}
          onClick={() => fileInputRef.current.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.xlsx"
            style={{ display: 'none' }}
          />
          <FaCloudUploadAlt className="upload-icon" />
          <h3>
            <FaUpload /> Click to upload
          </h3>
          <p>
            <FaFileCsv /> <FaFileExcel /> CSV or Excel files only
          </p>
          {file && (
            <div className="file-info">
              {file.name.endsWith('.csv') ? <FaFileCsv /> : <FaFileExcel />}
              <span>{file.name} ({totalRows} rows)</span>
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            <FaExclamationTriangle />
            <span>{error}</span>
          </div>
        )}

        {preview.headers && !results && !processing && (
          <div className="preview-section">
            <h3>
              <FaEye /> File Preview
            </h3>
            <div className="preview-table">
              <table>
                <thead>
                  <tr>
                    {preview.headers.map((header, index) => (
                      <th key={index}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.data.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {preview.headers.map((header, colIndex) => (
                        <td key={colIndex}>{row[header]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="action-buttons">
          <button
            className="process-button"
            onClick={processBulkAnalysis}
            disabled={!file || processing || serverStatus === 'offline'}
          >
            {processing ? (
              <>
                <FaSpinner className="spinner" />
                <span>Processing {currentRow}/{totalRows}... {progress}%</span>
              </>
            ) : (
              <>
                <FaPlay />
                <span>Start Bulk Analysis</span>
              </>
            )}
          </button>
          
          {processing && (
            <button
              className="cancel-button"
              onClick={cancelProcessing}
            >
              <FaTimes />
              Cancel
            </button>
          )}
        </div>
      </div>

      {processing && (
        <div className="progress-section">
          <div className="progress-bar-container">
            <div 
              className="progress-bar"
              style={{ width: `${progress}%` }}
            />
            <span className="progress-text">{progress}% Complete</span>
          </div>
          
          <div className="progress-info">
            <FaHourglassHalf className="progress-info-icon" />
            <span>
              {estimatedTime ? (
                <>Estimated time remaining: {estimatedTime}</>
              ) : (
                <>Processing row {currentRow} of {totalRows}...</>
              )}
            </span>
          </div>
        </div>
      )}

      {results && (
        <div className="results-section">
          <div className="results-header">
            <h3>
              <FaCheckCircle /> Analysis Complete!
            </h3>
            <button className="download-button" onClick={downloadResults}>
              <FaFileExcel />
              Download Excel Results
            </button>
          </div>

          {renderSummary()}

          <div className="tabs">
            <button
              className={`tab ${activeTab === 'table' ? 'active' : ''}`}
              onClick={() => setActiveTab('table')}
            >
              <FaTable /> Table View
            </button>
            <button
              className={`tab ${activeTab === 'charts' ? 'active' : ''}`}
              onClick={() => setActiveTab('charts')}
            >
              <FaChartPie /> Charts
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'table' && renderTable()}
            {activeTab === 'charts' && renderCharts()}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkAnalyzer;
