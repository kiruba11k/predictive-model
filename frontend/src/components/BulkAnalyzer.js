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
  FaPercentage
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
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState([]);
  const [activeTab, setActiveTab] = useState('table');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState(null);
  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const COLORS = ['#00ffff', '#ff00ff', '#00ff88', '#ff8800'];

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
          const text = e.target.result;
          const rows = text.split('\n').filter(row => row.trim());
          const headers = rows[0].split(',').map(h => h.trim());
          
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

    setProcessing(true);
    setProgress(0);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Start the bulk processing job
      const response = await axios.post(
        'https://predictive-model-backend.onrender.com/api/bulk/predict',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 10000
        }
      );

      if (response.data && response.data.jobId) {
        setJobId(response.data.jobId);
        // Start polling for results
        startPolling(response.data.jobId);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to start processing');
      setProcessing(false);
    }
  };

  const startPolling = (jobId) => {
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await axios.get(
          `https://predictive-model-backend.onrender.com/api/bulk/status/${jobId}`
        );

        const data = response.data;
        
        if (data.status === 'completed') {
          clearInterval(pollIntervalRef.current);
          setResults(data.results);
          setProcessing(false);
          setProgress(100);
        } else if (data.status === 'failed') {
          clearInterval(pollIntervalRef.current);
          setError(data.error || 'Processing failed');
          setProcessing(false);
        } else {
          // Update progress
          setProgress(data.progress || 0);
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(pollIntervalRef.current);
        setError('Failed to get processing status');
        setProcessing(false);
      }
    }, 2000);
  };

  const downloadResults = () => {
    if (!results || !originalData) return;

    // Merge original data with predictions
    const mergedData = originalData.map((row, index) => {
      const prediction = results.predictions[index] || {};
      return {
        ...row,
        'Prediction': prediction.prediction || 'N/A',
        'Probability': prediction.probability ? `${(prediction.probability * 100).toFixed(2)}%` : 'N/A',
        'Success Rate': prediction.success_probability ? `${(prediction.success_probability * 100).toFixed(2)}%` : 'N/A',
        'Confidence': prediction.confidence || 'Medium'
      };
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(mergedData);
    
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
      ['Success Rate', `${results.summary.successRate.toFixed(2)}%`],
      [''],
      ['Prediction Distribution'],
      ['Prediction', 'Count', 'Percentage'],
      ['Success', results.summary.successful, `${((results.summary.successful/results.summary.total)*100).toFixed(2)}%`],
      ['Failure', results.summary.failed, `${((results.summary.failed/results.summary.total)*100).toFixed(2)}%`]
    ];
    
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    
    // Save file
    XLSX.writeFile(wb, `bulk-predictions-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const renderSummary = () => {
    if (!results) return null;

    const { summary } = results;

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

    // Merge first 10 records for preview
    const previewData = originalData.slice(0, 10).map((row, index) => {
      const prediction = results.predictions[index] || {};
      return { ...row, ...prediction };
    });

    const allHeaders = [...preview.headers, 'Prediction', 'Probability', 'Success Rate'];

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
                {preview.headers.map((header, colIndex) => (
                  <td key={colIndex}>{row[header]}</td>
                ))}
                <td>
                  <span className={`prediction-badge ${row.prediction?.toLowerCase()}`}>
                    {row.prediction === 'Success' ? <FaCheck /> : <FaTimes />}
                    {row.prediction}
                  </span>
                </td>
                <td>{row.probability ? `${(row.probability * 100).toFixed(2)}%` : 'N/A'}</td>
                <td>{row.success_probability ? `${(row.success_probability * 100).toFixed(2)}%` : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {originalData.length > 10 && (
          <div className="table-note">
            Showing first 10 of {originalData.length} records. Download Excel file for complete results.
          </div>
        )}
      </div>
    );
  };

  const renderCharts = () => {
    if (!results) return null;

    const { summary } = results;

    const pieData = [
      { name: 'Successful', value: summary.successful },
      { name: 'Failed', value: summary.failed }
    ];

    return (
      <div className="charts-container">
        <div className="chart-card">
          <h3>Success Distribution</h3>
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
        <p>Upload a CSV or Excel file for batch prediction</p>
      </div>

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

        {preview.headers && !results && (
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
            disabled={!file || processing}
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
        <div className="progress-bar-container">
          <div 
            className="progress-bar"
            style={{ width: `${progress}%` }}
          />
          <span className="progress-text">{progress}% Complete</span>
        </div>
      )}

      {results && (
        <div className="results-section">
          <div className="results-header">
            <h3>
              <FaCheckCircle /> Analysis Complete
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
              <FaChartBar /> Charts
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
