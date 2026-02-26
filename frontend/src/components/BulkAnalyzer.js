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
  FaMagic
} from 'react-icons/fa';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const BulkAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState([]);
  const [activeTab, setActiveTab] = useState('table');
  const [progress, setProgress] = useState(0);
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
          const rows = text.split('\n').slice(0, 5);
          const headers = rows[0].split(',');
          const data = rows.slice(1).map(row => {
            const values = row.split(',');
            return headers.reduce((obj, header, index) => {
              obj[header.trim()] = values[index]?.trim() || '';
              return obj;
            }, {});
          });
          setPreview({ headers, data });
        } else {
          // Handle Excel files
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          const headers = jsonData[0];
          const rows = jsonData.slice(1, 6);
          const formattedData = rows.map(row => {
            return headers.reduce((obj, header, index) => {
              obj[header] = row[index] || '';
              return obj;
            }, {});
          });
          setPreview({ headers, data: formattedData });
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

      // Upload file to backend
      const uploadRes = await axios.post(
        'https://predictive-model-backend.onrender.com/upload-bulk',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000, // 5 minutes timeout for bulk processing
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
          }
        }
      );

      if (uploadRes.data && uploadRes.data.jobId) {
        // Poll for results
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
    if (!results) return;

    const csvContent = [
      ['Pain Point', 'Prediction', 'Probability', 'Success Probability'],
      ...results.data.map(row => [
        row.pain_point,
        row.prediction,
        `${(row.probability * 100).toFixed(2)}%`,
        `${(row.success_probability * 100).toFixed(2)}%`
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-prediction-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
    if (!results) return null;

    return (
      <div className="table-container">
        <table className="results-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Pain Point</th>
              <th>Prediction</th>
              <th>Probability</th>
              <th>Success Probability</th>
            </tr>
          </thead>
          <tbody>
            {results.data.map((row, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{row.pain_point}</td>
                <td>
                  <span className={`prediction-badge ${row.prediction.toLowerCase()}`}>
                    {row.prediction === 'Success' ? <FaCheck /> : <FaTimes />}
                    {row.prediction}
                  </span>
                </td>
                <td>{(row.probability * 100).toFixed(2)}%</td>
                <td>{(row.success_probability * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
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
            <button className="download-button" onClick={downloadResults}>
              <FaDownload />
              Download CSV
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
