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
  FaChartLine,
  FaFileExport,
  FaDatabase,
  FaCheck,
  FaTimes,
  FaPercentage,
  FaFileExcel,
  FaUpload,
  FaEye,
  FaMagic,
  FaFileDownload,
  FaFileCsv as FaFileCsvIcon
} from 'react-icons/fa';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const BulkAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [originalData, setOriginalData] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState([]);
  const [activeTab, setActiveTab] = useState('table');
  const [progress, setProgress] = useState(0);
  const [downloadFormat, setDownloadFormat] = useState('csv'); // 'csv' or 'excel'
  const fileInputRef = useRef(null);

  const COLORS = ['#00ffff', '#ff00ff', '#00ff88', '#ff8800', '#8884d8'];

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv') || 
          file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.name.endsWith('.xlsx')) {
        setFile(file);
        setError(null);
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
          
          // Store original data for later use
          const allData = rows.slice(1).map(row => {
            const values = row.split(',').map(v => v.trim());
            return headers.reduce((obj, header, index) => {
              obj[header] = values[index] || '';
              return obj;
            }, {});
          });
          setOriginalData(allData);
          
          // Preview first 5 rows
          const previewData = allData.slice(0, 5);
          setPreview({ headers, data: previewData });
        } else {
          // Handle Excel files
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          const headers = jsonData[0].map(h => String(h).trim());
          
          // Store original data
          const allData = jsonData.slice(1).map(row => {
            return headers.reduce((obj, header, index) => {
              obj[header] = row[index] || '';
              return obj;
            }, {});
          });
          setOriginalData(allData);
          
          // Preview first 5 rows
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

    setUploading(true);
    setProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await axios.post(
        'https://predictive-model-backend.onrender.com/upload-bulk',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000,
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
          }
        }
      );

      if (uploadRes.data && uploadRes.data.jobId) {
        pollForResults(uploadRes.data.jobId);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to process file');
      setUploading(false);
      setProcessing(false);
    }
  };

  const pollForResults = async (jobId) => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await axios.get(
          `https://predictive-model-backend.onrender.com/bulk-status/${jobId}`
        );

        if (res.data.status === 'completed') {
          clearInterval(pollInterval);
          setResults(res.data.results);
          setProcessing(false);
          setUploading(false);
          setProgress(100);
        } else if (res.data.status === 'failed') {
          clearInterval(pollInterval);
          setError(res.data.error || 'Processing failed');
          setProcessing(false);
          setUploading(false);
        } else {
          setProgress(res.data.progress || 0);
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(pollInterval);
        setError('Failed to get processing status');
        setProcessing(false);
        setUploading(false);
      }
    }, 2000);
  };

  const downloadResults = () => {
    if (!results || !originalData) return;

    // Merge original data with prediction results
    const mergedData = originalData.map((row, index) => {
      const prediction = results.data[index] || {};
      return {
        ...row,
        'Prediction': prediction.prediction || 'N/A',
        'Probability': prediction.probability ? `${(prediction.probability * 100).toFixed(2)}%` : 'N/A',
        'Success Probability': prediction.success_probability ? `${(prediction.success_probability * 100).toFixed(2)}%` : 'N/A',
        'Confidence Score': prediction.confidence || 'N/A'
      };
    });

    if (downloadFormat === 'csv') {
      downloadAsCSV(mergedData);
    } else {
      downloadAsExcel(mergedData);
    }
  };

  const downloadAsCSV = (data) => {
    // Get all headers (original + new)
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header] || '';
          // Escape commas and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-prediction-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadAsExcel = (data) => {
    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Predictions');
    
    // Add summary sheet
    const summaryData = [
      ['Summary Statistics'],
      ['Total Records', results.summary.total],
      ['Successful', results.summary.successful],
      ['Failed', results.summary.failed],
      ['Success Rate', `${(results.summary.successful / results.summary.total * 100).toFixed(2)}%`],
      [],
      ['Prediction Distribution'],
      ['Prediction', 'Count'],
      ['Success', results.summary.successful],
      ['Failure', results.summary.failed]
    ];
    
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    
    // Save file
    XLSX.writeFile(wb, `bulk-prediction-results-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const renderSummary = () => {
    if (!results) return null;

    const { summary } = results;
    const successRate = (summary.successful / summary.total * 100).toFixed(1);

    return (
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-icon">
            <FaDatabase />
          </div>
          <div className="summary-content">
            <h3>Total Records</h3>
            <p className="summary-value">{summary.total}</p>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon success-icon">
            <FaCheck />
          </div>
          <div className="summary-content">
            <h3>Successful</h3>
            <p className="summary-value success">{summary.successful}</p>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon failure-icon">
            <FaTimes />
          </div>
          <div className="summary-content">
            <h3>Failed</h3>
            <p className="summary-value failure">{summary.failed}</p>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon rate-icon">
            <FaPercentage />
          </div>
          <div className="summary-content">
            <h3>Success Rate</h3>
            <p className="summary-value">{successRate}%</p>
          </div>
        </div>
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

    const probabilityData = results.data
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 10)
      .map((item, index) => ({
        name: `Item ${index + 1}`,
        probability: (item.probability * 100).toFixed(1)
      }));

    return (
      <div className="charts-container">
        <div className="chart-card">
          <h3>
            <FaChartPie /> Success Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
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

        <div className="chart-card">
          <h3>
            <FaChartBar /> Top 10 Probabilities
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={probabilityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip />
              <Bar dataKey="probability" fill="url(#colorGradient)" />
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ffff" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#ff00ff" stopOpacity={1}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!results || !originalData) return null;

    // Merge data for display
    const displayData = originalData.slice(0, 10).map((row, index) => {
      const prediction = results.data[index] || {};
      return { ...row, ...prediction };
    });

    const allHeaders = [...preview.headers, 'Prediction', 'Probability', 'Success Probability'];

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
            {displayData.map((row, rowIndex) => (
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
            Showing first 10 of {originalData.length} records. Download full results below.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bulk-analyzer">
      <div className="bulk-header">
        <h2>
          <FaMagic /> Bulk Analysis
        </h2>
        <p>Upload a CSV or Excel file containing pain points for batch prediction</p>
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
            <FaUpload /> Click to upload or drag and drop
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

        {preview.headers && (
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
              <FaCheckCircle /> Analysis Results
            </h3>
            <div className="download-controls">
              <select 
                className="format-select"
                value={downloadFormat}
                onChange={(e) => setDownloadFormat(e.target.value)}
              >
                <option value="csv">CSV Format</option>
                <option value="excel">Excel Format</option>
              </select>
              <button className="download-button" onClick={downloadResults}>
                {downloadFormat === 'csv' ? <FaFileCsvIcon /> : <FaFileExcel />}
                Download Results
              </button>
            </div>
          </div>

          {renderSummary()}

          <div className="results-info">
            <p>
              <FaDatabase /> Total Records: {results.summary.total} | 
              <FaCheck /> Successful: {results.summary.successful} | 
              <FaTimes /> Failed: {results.summary.failed}
            </p>
          </div>

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
