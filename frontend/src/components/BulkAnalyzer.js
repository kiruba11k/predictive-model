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
  FaSkipForward
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
  const [jobId, setJobId] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [jobInfo, setJobInfo] = useState(null);
  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const BASE_URL = 'https://predictive-model-backend.onrender.com';
  const COLORS = ['#00ffff', '#ff00ff', '#00ff88', '#ff8800', '#8884d8'];

  // Check server health on component mount
  React.useEffect(() => {
    checkServerHealth();
    return () => {
      stopPolling();
    };
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
      setError('Cannot connect to server. The server might be starting up (takes 30-60 seconds on Render free tier).');
    }
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
        setJobInfo(null);
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
          const text = e.target.result;
          const rows = text.split('\n').filter(row => row.trim());
          const headers = rows[0].split(',').map(h => h.trim());
          setOriginalHeaders(headers);
          
          const allData = rows.slice(1).map(row => {
            const values = row.split(',').map(v => v.trim());
            return headers.reduce((obj, header, index) => {
              obj[header] = values[index] || '';
              return obj;
            }, {});
          });
          setOriginalData(allData);
          
          const previewData = allData.slice(0, 5);
          setPreview({ headers, data: previewData });
        } else {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          const headers = jsonData[0].map(h => String(h).trim());
          setOriginalHeaders(headers);
          
          const allData = jsonData.slice(1).map(row => {
            return headers.reduce((obj, header, index) => {
              obj[header] = row[index] || '';
              return obj;
            }, {});
          });
          setOriginalData(allData);
          
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
      setError('Server is offline. Please wait for it to start up (takes 30-60 seconds).');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setError(null);
    setResults(null);
    setStartTime(Date.now());
    setEstimatedTime(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(
        `${BASE_URL}/upload-bulk`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        }
      );

      console.log('Upload response:', response.data);

      if (response.data && response.data.jobId) {
        setJobId(response.data.jobId);
        setJobInfo({
          total: response.data.total,
          valid: response.data.valid,
          skipped: response.data.skipped,
          message: response.data.message
        });
        startPolling(response.data.jobId);
        
        timeoutRef.current = setTimeout(() => {
          stopPolling();
          setError('Processing is taking longer than expected. The job is still running but you can check back later.');
          setProcessing(false);
        }, 600000); // 10 minutes
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Upload error:', err);
      
      if (err.code === 'ECONNABORTED') {
        setError('Request timeout. The server might be busy. Please try again.');
      } else if (err.response?.status === 404) {
        setError('Upload endpoint not found. Please check if the server has the bulk upload feature.');
      } else if (err.response?.status === 500) {
        setError('Server error. Please try again with a smaller file.');
      } else if (err.message.includes('Network Error')) {
        setError('Cannot connect to server. The Render free tier server might be sleeping. Please wait 30-60 seconds and try again.');
      } else {
        setError(err.response?.data?.detail || err.message || 'Failed to start processing');
      }
      
      setProcessing(false);
    }
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const startPolling = (jobId) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await axios.get(
          `${BASE_URL}/bulk-status/${jobId}`,
          { timeout: 10000 }
        );

        console.log('Status response:', response.data);
        const data = response.data;
        
        if (data.status === 'completed') {
          stopPolling();
          setResults(data.results);
          setProcessing(false);
          setProgress(100);
        } else if (data.status === 'failed') {
          stopPolling();
          setError(data.error || 'Processing failed');
          setProcessing(false);
        } else {
          setProgress(data.progress || 0);
          
          if (startTime && data.progress > 0) {
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const totalEstimatedSeconds = (elapsedSeconds / data.progress) * 100;
            const remainingSeconds = totalEstimatedSeconds - elapsedSeconds;
            
            if (remainingSeconds > 0 && remainingSeconds < 3600) {
              const minutes = Math.floor(remainingSeconds / 60);
              const seconds = Math.floor(remainingSeconds % 60);
              setEstimatedTime(`${minutes}m ${seconds}s`);
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
        // Don't stop polling on error
        if (err.response?.status === 404) {
          console.log('Status endpoint not found yet, continuing to poll...');
        }
      }
    }, 3000);
  };

  const downloadResults = async () => {
    if (!jobId) return;

    try {
      const response = await axios.get(
        `${BASE_URL}/bulk-results/${jobId}`,
        { responseType: 'blob', timeout: 30000 }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bulk-results-${jobId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Download error:', err);
      
      // Fallback: Generate Excel with merged data
      if (results && originalData && originalHeaders) {
        const mergedData = originalData.map((row, index) => {
          const prediction = results.predictions?.[index] || {};
          return {
            ...row,
            'Prediction': prediction.prediction || 'N/A',
            'Probability': prediction.probability ? `${(prediction.probability * 100).toFixed(2)}%` : 'N/A',
            'Success Probability': prediction.success_probability ? `${(prediction.success_probability * 100).toFixed(2)}%` : 'N/A',
            'Confidence': prediction.confidence || 'N/A',
            'Note': prediction.note || ''
          };
        });

        const ws = XLSX.utils.json_to_sheet(mergedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Predictions');
        
        const summaryData = [
          ['Bulk Prediction Summary'],
          ['Generated:', new Date().toLocaleString()],
          [''],
          ['Total Records', results.summary?.total || 0],
          ['Successful Predictions', results.summary?.successful || 0],
          ['Failed Predictions', results.summary?.failed || 0],
          ['Skipped Rows', results.summary?.skipped || 0],
          ['Success Rate', `${(results.summary?.successRate || 0).toFixed(2)}%`]
        ];
        
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
        
        XLSX.writeFile(wb, `bulk-predictions-${new Date().toISOString().split('T')[0]}.xlsx`);
      } else {
        setError('Failed to download results');
      }
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
          <FaExclamationTriangle />
          <span>Server is starting up. Please wait 30-60 seconds...</span>
        </div>
      );
    }
    return null;
  };

  const renderJobInfo = () => {
    if (!jobInfo) return null;

    return (
      <div className="job-info">
        <FaInfoCircle className="job-info-icon" />
        <div className="job-info-content">
          <p><strong>Total rows:</strong> {jobInfo.total}</p>
          <p><strong>Valid pain points:</strong> {jobInfo.valid}</p>
          <p><strong>Empty rows (will be skipped):</strong> {jobInfo.skipped}</p>
          <p className="job-message">{jobInfo.message}</p>
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    if (!results) return null;

    const summary = results.summary || {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      successRate: 0
    };

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
          <FaSkipForward className="summary-icon skip-icon" />
          <div className="summary-content">
            <h3>Skipped</h3>
            <p className="summary-value skipped">{summary.skipped}</p>
          </div>
        </div>
        <div className="summary-card">
          <FaPercentage className="summary-icon rate-icon" />
          <div className="summary-content">
            <h3>Success Rate</h3>
            <p className="summary-value">{summary.successRate?.toFixed(2) || '0'}%</p>
          </div>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!results || !originalData) return null;

    const predictions = results.predictions || [];
    
    const previewData = originalData.slice(0, 10).map((row, index) => {
      const prediction = predictions[index] || {};
      return { ...row, ...prediction };
    });

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
                    {row.prediction === 'Skipped' && <FaSkipForward />}
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
                <td>{row.note || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {originalData.length > 10 && (
          <div className="table-note">
            Showing first 10 of {originalData.length} records. Download CSV for complete results.
          </div>
        )}
      </div>
    );
  };

  const renderCharts = () => {
    if (!results) return null;

    const summary = results.summary || {
      successful: 0,
      failed: 0,
      skipped: 0,
      total: 0
    };

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
        <p>Upload a CSV or Excel file containing 'pain_point' column for batch prediction</p>
      </div>

      {renderServerStatus()}

      <div className="upload-section">
        <div 
          className={`upload-area ${file ? 'file-selected' : ''} ${serverStatus === 'offline' ? 'disabled' : ''}`}
          onClick={() => serverStatus === 'online' && fileInputRef.current.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.xlsx"
            disabled={serverStatus === 'offline'}
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
              <span>{file.name}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            <FaExclamationTriangle />
            <span>{error}</span>
          </div>
        )}

        {jobInfo && !results && renderJobInfo()}

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
                <span>Processing... {progress}%</span>
              </>
            ) : (
              <>
                <FaChartBar />
                <span>Analyze Bulk Data</span>
              </>
            )}
          </button>
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
                <>Processing {jobInfo?.total || 0} records... This may take a few minutes</>
              )}
            </span>
          </div>

          {progress > 0 && progress < 100 && (
            <div className="progress-note">
              <FaClock />
              <span>Don't close this window. You'll be able to download results when complete.</span>
            </div>
          )}
        </div>
      )}

      {results && (
        <div className="results-section">
          <div className="results-header">
            <h3>
              <FaCheckCircle /> Analysis Complete!
            </h3>
            <button className="download-button" onClick={downloadResults}>
              <FaDownload />
              Download CSV Results
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
