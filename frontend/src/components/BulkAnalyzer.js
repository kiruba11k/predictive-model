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

import React, { useState, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { FaCloudUploadAlt, FaDownload, FaSpinner, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

const BulkAnalyzer = () => {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, processing, completed, error
    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    // Update this to your actual Render Backend URL
    const BASE_URL = 'https://predictive-model-backend.onrender.com';

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            setFile(selected);
            setResults(null);
            setError(null);
            setStatus('idle');
        }
    };

    const startAnalysis = async () => {
        if (!file) return;
        setStatus('processing');
        setProgress(0);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            // 1. Initial Upload to get Job ID
            const { data } = await axios.post(`${BASE_URL}/upload-bulk`, formData);
            const jobId = data.jobId;

            // 2. Poll Status every 2.5 seconds
            const poll = setInterval(async () => {
                try {
                    const response = await axios.get(`${BASE_URL}/bulk-status/${jobId}`);
                    const job = response.data;

                    setProgress(job.progress);

                    if (job.status === 'completed') {
                        clearInterval(poll);
                        setResults(job.results);
                        setStatus('completed');
                    } else if (job.status === 'failed') {
                        clearInterval(poll);
                        setError(job.error || "Analysis failed on server.");
                        setStatus('error');
                    }
                } catch (e) {
                    console.error("Polling error", e);
                    // Don't clear interval yet, server might be momentarily slow
                }
            }, 2500);

        } catch (err) {
            setError("Server is likely waking up. Please wait 30 seconds and try again.");
            setStatus('error');
        }
    };

    const downloadExcel = () => {
        if (!results) return;
        // Converts JSON results back to an Excel Sheet
        const ws = XLSX.utils.json_to_sheet(results);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Lead Predictions");
        
        // Triggers Browser Download
        XLSX.writeFile(wb, `Lead_Analysis_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="max-w-3xl mx-auto my-10 p-6 bg-white shadow-2xl rounded-2xl border border-gray-100">
            <h2 className="text-3xl font-extrabold text-gray-800 mb-6 text-center">Bulk Analysis Tool</h2>
            
            {/* Upload Area */}
            <div 
                className={`border-4 border-dashed p-12 rounded-xl text-center transition-all cursor-pointer ${
                    file ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-400 bg-gray-50'
                }`}
                onClick={() => fileInputRef.current.click()}
            >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv,.xlsx" />
                <FaCloudUploadAlt className={`text-6xl mx-auto mb-4 ${file ? 'text-green-500' : 'text-gray-400'}`} />
                <p className="text-lg font-medium text-gray-700">
                    {file ? file.name : "Drop CSV/Excel file here or click to browse"}
                </p>
            </div>

            {/* Action Button */}
            {status === 'idle' && file && (
                <button onClick={startAnalysis} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg transition">
                    Analyze {file.name}
                </button>
            )}

            {/* Progress Bar */}
            {status === 'processing' && (
                <div className="mt-8">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-blue-600 font-bold animate-pulse">Processing Leads...</span>
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden border border-gray-200">
                        <div className="bg-blue-600 h-full transition-all duration-700 ease-out" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-center text-gray-500 text-sm mt-4 flex items-center justify-center gap-2">
                        <FaSpinner className="animate-spin" /> This may take a few minutes for large files.
                    </p>
                </div>
            )}

            {/* Results View */}
            {status === 'completed' && (
                <div className="mt-8 p-6 bg-green-50 rounded-xl border border-green-200 text-center animate-fadeIn">
                    <FaCheckCircle className="text-green-500 text-5xl mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-green-900 mb-2">Analysis Complete!</h3>
                    <p className="text-green-700 mb-6">Successfully analyzed {results.length} rows.</p>
                    <button 
                        onClick={downloadExcel} 
                        className="flex items-center gap-3 mx-auto bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold shadow-md transition transform hover:scale-105"
                    >
                        <FaDownload /> Download Prediction Report
                    </button>
                </div>
            )}

            {/* Error Message */}
            {status === 'error' && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3">
                    <FaExclamationTriangle className="mt-1 flex-shrink-0" />
                    <div>
                        <p className="font-bold">Error Occurred</p>
                        <p className="text-sm">{error}</p>
                        <button onClick={() => setStatus('idle')} className="text-sm underline mt-2">Try again</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BulkAnalyzer;
