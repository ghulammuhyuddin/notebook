import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Book, 
  FileText, 
  TrendingUp, 
  MessageSquare, 
  Search, 
  Trash2, 
  Edit3, 
  Sun, 
  Moon, 
  Download, 
  Copy, 
  Send, 
  Sparkles, 
  HelpCircle, 
  Check, 
  ChevronRight, 
  BookOpen, 
  Database, 
  ArrowUpRight, 
  X,
  FileDown,
  RefreshCw,
  AlertCircle,
  Clock,
  Heart
} from 'lucide-react';

// --- CONFIG AND STRINGS ---
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export default function App() {
  // --- STATE ---
  const [theme, setTheme] = useState('dark');
  const [view, setView] = useState('landing'); // 'landing' | 'dashboard' | 'research'
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  // Local DB State (Loaded/Saved to LocalStorage)
  const [notebooks, setNotebooks] = useState([]);
  const [activeNotebookId, setActiveNotebookId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [chats, setChats] = useState({}); // { [notebookId]: [ {role, content, timestamp, citations} ] }
  
  // Modals / Input fields
  const [newNotebook, setNewNotebook] = useState({ name: '', ticker: '', companyName: '' });
  const [showCreateNotebookModal, setShowCreateNotebookModal] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [newWatchlistTicker, setNewWatchlistTicker] = useState({ ticker: '', company: '', notes: '' });
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);

  // Active inputs / actions
  const [chatInput, setChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: 'info' }); // 'info'|'success'|'error'

  // PDF processing states
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const fileInputRef = useRef(null);

  // --- LOCALSTORAGE SYNC & INITIALIZATION ---
  useEffect(() => {
    // Sync Theme
    const savedTheme = localStorage.getItem('psx_theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');

    // Load data from LocalStorage
    const storedNotebooks = localStorage.getItem('psx_notebooks');
    const storedNotes = localStorage.getItem('psx_notes');
    const storedWatchlist = localStorage.getItem('psx_watchlist');
    const storedChats = localStorage.getItem('psx_chats');
    const storedApiKey = localStorage.getItem('NEXT_PUBLIC_GEMINI_API_KEY') || '';

    if (storedNotebooks) setNotebooks(JSON.parse(storedNotebooks));
    if (storedNotes) setNotes(JSON.parse(storedNotes));
    if (storedWatchlist) setWatchlist(JSON.parse(storedWatchlist));
    if (storedChats) setChats(JSON.parse(storedChats));
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setApiKeyInput(storedApiKey);
    }
  }, []);

  // Save changes helper
  const saveToLocalStorage = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  // Toast / Status banner trigger
  const triggerStatus = (text, type = 'info') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage({ text: '', type: 'info' });
    }, 4500);
  };

  // Toggle Theme
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('psx_theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Set API Key
  const handleSaveApiKey = () => {
    localStorage.setItem('NEXT_PUBLIC_GEMINI_API_KEY', apiKeyInput);
    setApiKey(apiKeyInput);
    setShowApiKeyModal(false);
    triggerStatus("Gemini API Key updated successfully!", "success");
  };

  // Clear API Key
  const handleClearApiKey = () => {
    localStorage.removeItem('NEXT_PUBLIC_GEMINI_API_KEY');
    setApiKey('');
    setApiKeyInput('');
    setShowApiKeyModal(false);
    triggerStatus("Gemini API Key cleared.", "info");
  };

  // --- ACTIONS ---

  // 1. Create Notebook
  const handleCreateNotebook = (e) => {
    e.preventDefault();
    if (!newNotebook.name.trim() || !newNotebook.ticker.trim()) {
      triggerStatus("Please fill in at least Notebook Name and Ticker", "error");
      return;
    }

    const created = {
      id: 'nb_' + Date.now(),
      name: newNotebook.name,
      ticker: newNotebook.ticker.toUpperCase(),
      companyName: newNotebook.companyName || newNotebook.name,
      createdAt: new Date().toISOString(),
      documents: [], // Array of { id, name, contentText, charCount, pageCount }
      summary: null, // Generated analysis summary
      fullReport: null, // Generated comprehensive PDF exportable report
    };

    const updated = [created, ...notebooks];
    setNotebooks(updated);
    saveToLocalStorage('psx_notebooks', updated);
    
    // Auto-select and enter
    setActiveNotebookId(created.id);
    setNewNotebook({ name: '', ticker: '', companyName: '' });
    setShowCreateNotebookModal(false);
    setView('research');
    triggerStatus(`Notebook "${created.name}" created!`, "success");
  };

  // Delete Notebook
  const handleDeleteNotebook = (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this notebook? All associated documents and chat history will be permanently lost.")) {
      return;
    }
    const updated = notebooks.filter(nb => nb.id !== id);
    setNotebooks(updated);
    saveToLocalStorage('psx_notebooks', updated);

    // Delete chat history
    const updatedChats = { ...chats };
    delete updatedChats[id];
    setChats(updatedChats);
    saveToLocalStorage('psx_chats', updatedChats);

    if (activeNotebookId === id) {
      setActiveNotebookId(null);
      setView('dashboard');
    }
    triggerStatus("Notebook deleted successfully", "info");
  };

  // 2. Document/PDF Processing using PDF.js via CDN
  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      triggerStatus("Only PDF documents are supported for high-fidelity stock analysis.", "error");
      return;
    }

    setIsProcessingPdf(true);
    triggerStatus(`Reading and parsing PDF: ${file.name}...`, "info");

    try {
      // Load pdfjs-dist via global script injection if not already loaded
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
          script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            resolve();
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let extractedText = '';
      let pageDetails = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedText += `--- PAGE ${i} ---\n` + pageText + '\n\n';
        pageDetails.push({ pageNum: i, charCount: pageText.length });
      }

      if (extractedText.trim().length < 50) {
        throw new Error("We couldn't extract readable text from this PDF. It might be scanned or image-only.");
      }

      // Add to current notebook documents
      const updatedNotebooks = notebooks.map(nb => {
        if (nb.id === activeNotebookId) {
          const newDoc = {
            id: 'doc_' + Date.now(),
            name: file.name,
            contentText: extractedText,
            charCount: extractedText.length,
            pageCount: pdf.numPages,
            uploadedAt: new Date().toISOString()
          };
          return {
            ...nb,
            documents: [...(nb.documents || []), newDoc]
          };
        }
        return nb;
      });

      setNotebooks(updatedNotebooks);
      saveToLocalStorage('psx_notebooks', updatedNotebooks);
      triggerStatus(`Successfully loaded "${file.name}" (${pdf.numPages} Pages). Proceeding to generate automatic summary!`, "success");

      // Auto trigger AI summary after upload
      setTimeout(() => {
        generateAiSummaryForActive();
      }, 500);

    } catch (err) {
      console.error(err);
      triggerStatus(err.message || "Failed to process PDF. Ensure it is a valid text-based PDF.", "error");
    } finally {
      setIsProcessingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete Document
  const handleDeleteDoc = (docId) => {
    const updatedNotebooks = notebooks.map(nb => {
      if (nb.id === activeNotebookId) {
        return {
          ...nb,
          documents: (nb.documents || []).filter(doc => doc.id !== docId)
        };
      }
      return nb;
    });
    setNotebooks(updatedNotebooks);
    saveToLocalStorage('psx_notebooks', updatedNotebooks);
    triggerStatus("Document deleted", "info");
  };

  // 3. Gemini API Calls with Backoff & Error Management
  const callGeminiApi = async (prompt, systemInstruction = "") => {
    if (!apiKey) {
      setShowApiKeyModal(true);
      throw new Error("A Google Gemini API key is required. Get one for free at Google AI Studio.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
    };
    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    // Exponential Backoff Retry Strategy (Up to 5 attempts)
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error("Empty response received from Gemini API.");
        }
        return text;
      } catch (err) {
        lastError = err;
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError || new Error("Failed after 5 attempts.");
  };

  // 4. Generate AI Summary (Company Overview, Revenue, Profit, Risks, Opportunities)
  const generateAiSummaryForActive = async () => {
    const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
    if (!activeNb) return;
    if (!activeNb.documents || activeNb.documents.length === 0) {
      triggerStatus("Please upload at least one PDF report document first.", "error");
      return;
    }

    setIsAiLoading(true);
    triggerStatus("Analyzing documents & generating high-impact stock summary...", "info");

    // Concatenate document contents (limit slightly to stay within context limits comfortably)
    const combinedContent = activeNb.documents.map(d => `Document: ${d.name}\n${d.contentText.substring(0, 45000)}`).join('\n\n');

    const prompt = `
    You are an expert Wall Street buy-side stock researcher. Analyze the following annual/quarterly documents for ${activeNb.companyName} (${activeNb.ticker}) and generate a structured research summary.
    
    Format your response EXACTLY as a JSON object with these exact keys:
    {
      "companyOverview": "Concise summary of the company business model and operations",
      "revenueSummary": "Analysis of the revenue trends, growth rates, and primary drivers",
      "profitSummary": "Analysis of gross, operating, and net profitability, margins, and cost structures",
      "keyRisks": "List of the most severe business, operational, or financial risks found in the text",
      "keyOpportunities": "Key catalysts, market expansions, technological edges, or growth opportunities",
      "finalSummary": "Professional buy/hold/sell perspective summarizing current state"
    }

    Do not include any Markdown block indicators, "json" prefixes, or trailing characters. Return only valid parseable JSON.

    Document Source Context:
    ${combinedContent}
    `;

    try {
      const rawText = await callGeminiApi(prompt, "You are a precise financial analytics assistant that responds strictly in valid JSON format.");
      // Clean up markdown markers if any got returned
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedSummary = JSON.parse(cleanJson);

      const updatedNotebooks = notebooks.map(nb => {
        if (nb.id === activeNotebookId) {
          return { ...nb, summary: parsedSummary };
        }
        return nb;
      });

      setNotebooks(updatedNotebooks);
      saveToLocalStorage('psx_notebooks', updatedNotebooks);
      triggerStatus("AI Research Summary generated successfully!", "success");
    } catch (err) {
      console.error(err);
      triggerStatus("Could not generate automatic summary. " + err.message, "error");
    } finally {
      setIsAiLoading(false);
    }
  };

  // 5. Chat with Documents
  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
    if (!activeNb) return;

    const userMessage = {
      role: 'user',
      content: chatInput,
      timestamp: new Date().toISOString()
    };

    const currentChat = chats[activeNotebookId] || [];
    const updatedChatList = [...currentChat, userMessage];
    
    // Update state immediately for UX
    const newChatsState = { ...chats, [activeNotebookId]: updatedChatList };
    setChats(newChatsState);
    saveToLocalStorage('psx_chats', newChatsState);
    
    const originalInput = chatInput;
    setChatInput('');
    setIsAiLoading(true);

    // Build context
    const docsContext = activeNb.documents && activeNb.documents.length > 0
      ? activeNb.documents.map(d => `[Document Name: ${d.name}]\n${d.contentText.substring(0, 35000)}`).join('\n\n')
      : "No document files uploaded yet.";

    const prompt = `
    You are Google NotebookLM, specialized in Stock Market Research for the company ${activeNb.companyName} (${activeNb.ticker}).
    Use the following document text as source context to answer the user's question. 
    If the answer cannot be found in the text, clearly state that the provided documents do not contain that information, but try to give an educational financial explanation of the concept instead.
    Include page citations (e.g. "Page 14") in your response whenever referencing specific data from the documents.

    Source context from uploaded PDFs:
    ${docsContext}

    Conversation history:
    ${currentChat.map(m => `${m.role === 'user' ? 'Question' : 'Answer'}: ${m.content}`).join('\n')}

    User's New Question: ${originalInput}
    `;

    try {
      const reply = await callGeminiApi(prompt, `You are a professional investment analyst helping users review company filings for ${activeNb.ticker}.`);
      
      const aiResponse = {
        role: 'model',
        content: reply,
        timestamp: new Date().toISOString()
      };

      const finalizedChatList = [...updatedChatList, aiResponse];
      const finalizedChatsState = { ...chats, [activeNotebookId]: finalizedChatList };
      setChats(finalizedChatsState);
      saveToLocalStorage('psx_chats', finalizedChatsState);
    } catch (err) {
      console.error(err);
      triggerStatus("Error answering query: " + err.message, "error");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Clear Active Notebook Chats
  const handleClearChats = () => {
    if (window.confirm("Reset this chat window's history?")) {
      const updatedChats = { ...chats };
      delete updatedChats[activeNotebookId];
      setChats(updatedChats);
      saveToLocalStorage('psx_chats', updatedChats);
      triggerStatus("Conversation reset", "info");
    }
  };

  // 6. Generate Comprehensive Stock Research Report
  const generateFullResearchReport = async () => {
    const activeNb = notebooks.find(nb => nb.id === activeNotebookId);
    if (!activeNb) return;

    setIsAiLoading(true);
    triggerStatus("Synthesizing ultimate stock research report with Gemini...", "info");

    const docsContext = activeNb.documents && activeNb.documents.length > 0
      ? activeNb.documents.map(d => `[Document: ${d.name}]\n${d.contentText.substring(0, 30000)}`).join('\n\n')
      : "No specific documents provided. Research based on general industry knowledge of " + activeNb.companyName;

    const prompt = `
    Conduct a comprehensive equity research analysis for ${activeNb.companyName} (${activeNb.ticker}).
    Write a highly professional, well-formatted financial research report with the following structure:
    
    1. COMPANY OVERVIEW & SECTOR POSITIONING
    2. DETAILED BUSINESS MODEL SUMMARY
    3. REVENUE & REVENUE MODEL ANALYSIS
    4. INCOME STATEMENT & MARGIN PERFORMANCE (PROFITABILITY)
    5. CRITICAL RISKS (Competitive, Macro, Regulatory, Balance Sheet)
    6. GROWTH OPPORTUNITIES & CATALYSTS
    7. CONCLUSION & INVESTMENT THESIS
    
    Use the following uploaded materials as raw source material:
    ${docsContext}

    Ensure the language is authoritative, clear, objective, and filled with deep financial insights. Formulate a final logical outlook.
    `;

    try {
      const generatedReport = await callGeminiApi(prompt, "You are a Senior CFA (Chartered Financial Analyst) writing a premium equity research report.");
      
      const updatedNotebooks = notebooks.map(nb => {
        if (nb.id === activeNotebookId) {
          return { ...nb, fullReport: generatedReport };
        }
        return nb;
      });

      setNotebooks(updatedNotebooks);
      saveToLocalStorage('psx_notebooks', updatedNotebooks);
      triggerStatus("Full Stock Research Report synthesized! Scroll down to read and download.", "success");
    } catch (err) {
      console.error(err);
      triggerStatus("Report generation failed. " + err.message, "error");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Helper: Simple Markdown to HTML-like rendering for generated reports or chat responses
  const renderFormattedText = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="text-md font-bold mt-4 mb-2 text-primary-500 dark:text-cyan-400">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} className="text-lg font-bold mt-6 mb-3 text-primary-600 dark:text-cyan-300 border-b border-gray-700 pb-1">{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={idx} className="text-xl font-extrabold mt-8 mb-4 text-primary-700 dark:text-cyan-200">{line.replace('# ', '')}</h2>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={idx} className="ml-5 list-disc my-1 text-gray-700 dark:text-gray-300">{line.substring(2)}</li>;
      }
      return <p key={idx} className="my-2 leading-relaxed text-gray-800 dark:text-gray-200 text-sm">{line}</p>;
    });
  };

  // Helper: Download report as HTML file (Clean PDF export bypass)
  const downloadReportFile = (nb) => {
    if (!nb || !nb.fullReport) return;
    const cleanHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>PSX Research Report - ${nb.ticker}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; max-width: 800px; margin: 0 auto; }
          h1 { color: #0891b2; font-size: 28px; border-bottom: 2px solid #0891b2; padding-bottom: 10px; }
          h2 { color: #0f766e; font-size: 20px; margin-top: 30px; }
          h3 { color: #115e59; font-size: 16px; }
          p { margin-bottom: 15px; text-align: justify; }
          li { margin-bottom: 8px; }
          .header-meta { background: #f3f4f6; padding: 15px; border-radius: 6px; margin-bottom: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>EQUITY RESEARCH REPORT: ${nb.companyName} (${nb.ticker})</h1>
        <div class="header-meta">
          <strong>Notebook Ref:</strong> ${nb.name}<br>
          <strong>Generated on:</strong> ${new Date().toLocaleDateString()}<br>
          <strong>Model Engine:</strong> Google Gemini ${DEFAULT_GEMINI_MODEL}
        </div>
        <div>
          ${nb.fullReport.replace(/\n/g, '<br>')}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([cleanHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PSX_Research_Report_${nb.ticker}.html`;
    a.click();
    URL.revokeObjectURL(url);
    triggerStatus("Stock report file downloaded. Open it to easily save/print as PDF!", "success");
  };

  // 7. Write/Save Notes
  const handleSaveNote = (e) => {
    e.preventDefault();
    if (!newNote.title.trim() || !newNote.content.trim()) {
      triggerStatus("Please fill in both the note title and content.", "error");
      return;
    }

    let updated;
    if (editingNoteId) {
      updated = notes.map(n => n.id === editingNoteId ? { ...n, title: newNote.title, content: newNote.content, updatedAt: new Date().toISOString() } : n);
      setEditingNoteId(null);
      triggerStatus("Note updated!", "success");
    } else {
      const added = {
        id: 'note_' + Date.now(),
        notebookId: activeNotebookId, // Link optionally to active notebook
        title: newNote.title,
        content: newNote.content,
        createdAt: new Date().toISOString()
      };
      updated = [added, ...notes];
      triggerStatus("Note created successfully!", "success");
    }

    setNotes(updated);
    saveToLocalStorage('psx_notes', updated);
    setNewNote({ title: '', content: '' });
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.id);
    setNewNote({ title: note.title, content: note.content });
  };

  const handleDeleteNote = (noteId) => {
    const updated = notes.filter(n => n.id !== noteId);
    setNotes(updated);
    saveToLocalStorage('psx_notes', updated);
    triggerStatus("Note deleted", "info");
  };

  // 8. Watchlist Interactions
  const handleAddToWatchlist = (e) => {
    e.preventDefault();
    if (!newWatchlistTicker.ticker.trim()) {
      triggerStatus("Ticker is required.", "error");
      return;
    }

    const added = {
      id: 'wl_' + Date.now(),
      ticker: newWatchlistTicker.ticker.toUpperCase(),
      company: newWatchlistTicker.company || newWatchlistTicker.ticker.toUpperCase(),
      notes: newWatchlistTicker.notes,
      addedAt: new Date().toISOString()
    };

    const updated = [added, ...watchlist];
    setWatchlist(updated);
    saveToLocalStorage('psx_watchlist', updated);
    setNewWatchlistTicker({ ticker: '', company: '', notes: '' });
    setShowWatchlistModal(false);
    triggerStatus(`${added.ticker} added to watchlist!`, "success");
  };

  const handleRemoveFromWatchlist = (id) => {
    const updated = watchlist.filter(item => item.id !== id);
    setWatchlist(updated);
    saveToLocalStorage('psx_watchlist', updated);
    triggerStatus("Removed from watchlist", "info");
  };

  const activeNotebook = notebooks.find(nb => nb.id === activeNotebookId);

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0f172a] text-gray-100' : 'bg-[#f8fafc] text-gray-900'}`}>
      
      {/* --- STATUS TOAST / NOTIFICATION BAR --- */}
      {statusMessage.text && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce border max-w-md ${
          statusMessage.type === 'success' ? 'bg-emerald-600/90 text-white border-emerald-500' : 
          statusMessage.type === 'error' ? 'bg-rose-600/90 text-white border-rose-500' : 
          'bg-cyan-600/90 text-white border-cyan-500'
        }`}>
          {statusMessage.type === 'success' ? <Check size={20} className="shrink-0" /> : <AlertCircle size={20} className="shrink-0" />}
          <p className="text-sm font-semibold">{statusMessage.text}</p>
        </div>
      )}

      {/* --- API KEY CONFIG MODAL --- */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                <Sparkles size={24} />
                <h3 className="text-xl font-bold">Configure Google Gemini API Key</h3>
              </div>
              <button onClick={() => setShowApiKeyModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This application connects directly with <strong>Gemini 2.5 Flash</strong> from your browser to analyze your documents. 
              Your API key is stored 100% locally in your secure browser memory and never leaves your machine.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-gray-500 dark:text-gray-400">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 pt-2">
                <a 
                  href="https://aistudio.google.com/" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-cyan-500 hover:underline inline-flex items-center gap-1"
                >
                  Get a free key from Google AI Studio <ArrowUpRight size={12} />
                </a>
              </div>
            </div>

            <div className="flex gap-3 mt-8 justify-end">
              <button 
                onClick={handleClearApiKey}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
              >
                Clear Key
              </button>
              <button 
                onClick={handleSaveApiKey}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-lg shadow-cyan-600/30"
              >
                Save Local Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CREATE NOTEBOOK MODAL --- */}
      {showCreateNotebookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleCreateNotebook} className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <BookOpen className="text-cyan-600 dark:text-cyan-400" size={20} />
                Create Stock Notebook
              </h3>
              <button type="button" onClick={() => setShowCreateNotebookModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-500 dark:text-gray-400">Notebook Title</label>
                <input
                  type="text"
                  placeholder="e.g. Nvidia FY26 Analysis"
                  required
                  value={newNotebook.name}
                  onChange={(e) => setNewNotebook({ ...newNotebook, name: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-500 dark:text-gray-400">Stock Ticker</label>
                  <input
                    type="text"
                    placeholder="NVDA"
                    required
                    value={newNotebook.ticker}
                    onChange={(e) => setNewNotebook({ ...newNotebook, ticker: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-500 dark:text-gray-400">Company Name</label>
                  <input
                    type="text"
                    placeholder="Nvidia Corporation"
                    value={newNotebook.companyName}
                    onChange={(e) => setNewNotebook({ ...newNotebook, companyName: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8 justify-end">
              <button 
                type="button"
                onClick={() => setShowCreateNotebookModal(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-lg shadow-cyan-600/30"
              >
                Create Notebook
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- WATCHLIST CONFIG MODAL --- */}
      {showWatchlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleAddToWatchlist} className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <TrendingUp className="text-cyan-600 dark:text-cyan-400" size={20} />
                Add to Stock Watchlist
              </h3>
              <button type="button" onClick={() => setShowWatchlistModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-500 dark:text-gray-400">Stock Ticker</label>
                <input
                  type="text"
                  placeholder="e.g. AAPL"
                  required
                  value={newWatchlistTicker.ticker}
                  onChange={(e) => setNewWatchlistTicker({ ...newWatchlistTicker, ticker: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-500 dark:text-gray-400">Company Name (Optional)</label>
                <input
                  type="text"
                  placeholder="Apple Inc."
                  value={newWatchlistTicker.company}
                  onChange={(e) => setNewWatchlistTicker({ ...newWatchlistTicker, company: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-500 dark:text-gray-400">Catalysts / Personal Notes</label>
                <textarea
                  placeholder="Write down entry plans, dividend expectations, quarterly earning catalysts..."
                  rows={3}
                  value={newWatchlistTicker.notes}
                  onChange={(e) => setNewWatchlistTicker({ ...newWatchlistTicker, notes: e.target.value })}
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8 justify-end">
              <button 
                type="button"
                onClick={() => setShowWatchlistModal(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-lg shadow-cyan-600/30"
              >
                Add Stock
              </button>
            </div>
          </form>
        </div>
      )}


      {/* --- TOP HEADER NAVIGATION --- */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('landing')}>
            <div className="p-2 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-lg text-white shadow-md shadow-cyan-500/20">
              <Book size={20} className="animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-cyan-500 to-indigo-500 bg-clip-text text-transparent">
                PSX Research
              </span>
              <span className="text-xs ml-1 font-semibold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Lite</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowApiKeyModal(true)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 border transition ${
                apiKey 
                  ? 'border-emerald-500 text-emerald-500 dark:text-emerald-400 bg-emerald-500/10' 
                  : 'border-amber-500 text-amber-500 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
              }`}
            >
              <Sparkles size={14} />
              {apiKey ? "Gemini Key Ready" : "Set Gemini Key"}
            </button>

            {view !== 'landing' && (
              <button 
                onClick={() => setView('dashboard')}
                className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg transition"
              >
                Dashboard
              </button>
            )}

            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400 transition"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>


      {/* ========================================================
          LANDING PAGE VIEW
          ======================================================== */}
      {view === 'landing' && (
        <main className="flex-1">
          {/* Hero Section */}
          <section className="relative overflow-hidden py-24 sm:py-32">
            <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
              <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-cyan-400 to-indigo-500 opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72rem]"></div>
            </div>
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <span className="text-xs font-bold uppercase tracking-widest bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/20">
                Personal Stock Intelligence Assistant
              </span>
              <h1 className="text-4xl sm:text-6xl font-black mt-6 tracking-tight text-slate-900 dark:text-white leading-tight">
                NotebookLM, Synthesized for <br />
                <span className="bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">
                  Stock Research & Analysis
                </span>
              </h1>
              <p className="mt-6 text-base sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Upload your financial reports, investor presentations, and transcripts. Ask intelligent questions, extract risk-profiles, auto-generate sector overviews, and build institution-grade equity research reports with stable Gemini 2.5 Flash.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button
                  onClick={() => {
                    setView('dashboard');
                    triggerStatus("Welcome to your Stock Analysis Space", "info");
                  }}
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold rounded-xl transition shadow-xl shadow-cyan-500/20 inline-flex items-center justify-center gap-2 text-lg hover:scale-[1.02]"
                >
                  Start Research Space <ChevronRight size={20} />
                </button>
                <button
                  onClick={() => setShowApiKeyModal(true)}
                  className="w-full sm:w-auto px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-800 dark:text-white font-semibold rounded-xl transition text-base inline-flex items-center justify-center gap-2"
                >
                  <Sparkles size={18} className="text-cyan-500" /> Enter Gemini API Key
                </button>
              </div>

              {/* Stats Block */}
              <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-slate-200 dark:border-slate-800 pt-10 text-left">
                <div>
                  <h4 className="text-3xl font-extrabold text-slate-900 dark:text-white">100%</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Client-Side Secure Storage</p>
                </div>
                <div>
                  <h4 className="text-3xl font-extrabold text-slate-900 dark:text-white">Zero</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Database Logins Required</p>
                </div>
                <div>
                  <h4 className="text-3xl font-extrabold text-slate-900 dark:text-white">Gemini</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Powered by 2.5 Flash Engine</p>
                </div>
                <div>
                  <h4 className="text-3xl font-extrabold text-slate-900 dark:text-white">100+ pgs</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Deep text parse & analysis</p>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="bg-slate-50 dark:bg-slate-900/50 py-20 border-y border-slate-200 dark:border-slate-800 transition-colors">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">
                Designed for Smart Investors
              </h2>
              
              <div className="grid md:grid-cols-3 gap-8">
                {/* Feature 1 */}
                <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="p-3 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-xl w-fit mb-4">
                    <FileText size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">High-Fidelity PDF Parsing</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Parse complex, text-heavy PDFs directly inside your browser using our client-side extraction technology.
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl w-fit mb-4">
                    <Sparkles size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Google NotebookLM Style Chat</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Interact directly with your uploaded documents. Cite page numbers automatically so you can audit answers.
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl w-fit mb-4">
                    <Download size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Export Equity Reports</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    Convert AI synthesized deep-dives into elegant, ready-to-print stock research reports in one click.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Bottom Call to Action */}
          <section className="py-20 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">Ready to upgrade your investing research flow?</h2>
            <button
              onClick={() => setView('dashboard')}
              className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold rounded-xl transition shadow-xl shadow-cyan-500/20 inline-flex items-center gap-2"
            >
              Enter Research Workspace <ChevronRight size={18} />
            </button>
          </section>
        </main>
      )}


      {/* ========================================================
          DASHBOARD VIEW
          ======================================================== */}
      {view === 'dashboard' && (
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
          
          {/* Welcome Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Stock Analysis Hub</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select an existing notebook or spin up a new research project instantly.</p>
            </div>
            
            <button
              onClick={() => setShowCreateNotebookModal(true)}
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 text-sm"
            >
              <Plus size={16} /> Create Notebook
            </button>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Active Notebooks</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black">{notebooks.length}</span>
                <span className="text-xs text-gray-400">Total stored</span>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Uploaded Documents</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black">
                  {notebooks.reduce((acc, curr) => acc + (curr.documents?.length || 0), 0)}
                </span>
                <span className="text-xs text-gray-400">PDFs processed</span>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Stock Notes</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black">{notes.length}</span>
                <span className="text-xs text-gray-400">Items written</span>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Watchlisted Stocks</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black">{watchlist.length}</span>
                <span className="text-xs text-cyan-500 font-semibold flex items-center gap-0.5">
                  Tracks <ArrowUpRight size={12} />
                </span>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: Notebook List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <BookOpen size={18} className="text-cyan-500" /> Recent Research Notebooks
                </h2>
              </div>

              {notebooks.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                  <div className="p-3 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-full w-fit mx-auto mb-4">
                    <BookOpen size={32} />
                  </div>
                  <h3 className="font-bold text-lg">No Notebooks Found</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2">
                    Create your first stock research notebook to get started uploading annual reports.
                  </p>
                  <button
                    onClick={() => setShowCreateNotebookModal(true)}
                    className="mt-6 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition text-sm"
                  >
                    Add Your First Stock
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {notebooks.map(nb => (
                    <div
                      key={nb.id}
                      onClick={() => {
                        setActiveNotebookId(nb.id);
                        setView('research');
                      }}
                      className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-cyan-500 dark:hover:border-cyan-500 cursor-pointer transition flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/10">
                            {nb.ticker}
                          </span>
                          <button
                            onClick={(e) => handleDeleteNotebook(nb.id, e)}
                            className="text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Delete Notebook"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        
                        <h3 className="font-bold text-lg mt-3 text-slate-950 dark:text-white group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition">
                          {nb.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {nb.companyName}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-6 pt-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <FileText size={12} />
                          {nb.documents?.length || 0} Docs
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(nb.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Col: Watchlist & Quick Notes */}
            <div className="space-y-6">
              {/* Watchlist card */}
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <TrendingUp size={16} className="text-emerald-500" /> Watchlist
                  </h3>
                  <button 
                    onClick={() => setShowWatchlistModal(true)}
                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500 hover:text-white transition text-xs"
                    title="Add to Watchlist"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {watchlist.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">Your watchlist is currently empty.</p>
                ) : (
                  <div className="space-y-3">
                    {watchlist.map(item => (
                      <div key={item.id} className="flex justify-between items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 rounded">
                              {item.ticker}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold max-w-[120px] truncate">
                              {item.company}
                            </span>
                          </div>
                          {item.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{item.notes}</p>}
                        </div>
                        <button
                          onClick={() => handleRemoveFromWatchlist(item.id)}
                          className="text-gray-400 hover:text-rose-500 p-1"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Personal Notes Box */}
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-1.5">
                  <Edit3 size={16} className="text-amber-500" /> Stock Research Notes
                </h3>
                
                <form onSubmit={handleSaveNote} className="space-y-3 mb-6 border-b border-slate-200 dark:border-slate-800 pb-5">
                  <input
                    type="text"
                    placeholder="Note Title (e.g. Q3 Catalyst)"
                    required
                    value={newNote.title}
                    onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                    className="w-full p-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <textarea
                    placeholder="Take direct custom notes here..."
                    required
                    rows={2}
                    value={newNote.content}
                    onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                    className="w-full p-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-xs transition"
                  >
                    {editingNoteId ? "Update Note" : "Save Note"}
                  </button>
                </form>

                {notes.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">No notes saved yet.</p>
                ) : (
                  <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
                    {notes.map(note => (
                      <div key={note.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-xs truncate max-w-[150px]">{note.title}</h4>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => handleEditNote(note)} className="text-gray-400 hover:text-cyan-500">
                              <Edit3 size={10} />
                            </button>
                            <button onClick={() => handleDeleteNote(note.id)} className="text-gray-400 hover:text-rose-500">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-normal line-clamp-3">{note.content}</p>
                        <span className="text-[10px] text-gray-400 block mt-2">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}


      {/* ========================================================
          RESEARCH & NOTEBOOK SPACE VIEW (Google NotebookLM Layout)
          ======================================================== */}
      {view === 'research' && activeNotebook && (
        <main className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] overflow-hidden transition-all">
          
          {/* LEFT SIDEBAR (Notebook, Documents & Notes) */}
          <section className="w-full lg:w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-900/30 shrink-0">
            
            {/* Active Notebook Metadata block */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
              <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/10">
                {activeNotebook.ticker}
              </span>
              <h2 className="font-bold text-base text-slate-900 dark:text-white mt-1.5 leading-snug">{activeNotebook.name}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{activeNotebook.companyName}</p>
            </div>

            {/* Document upload / list */}
            <div className="p-4 flex-1 flex flex-col min-h-0 overflow-y-auto space-y-6">
              
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileText size={14} /> Source Documents
                  </h3>
                  <span className="text-xs text-cyan-500 font-bold bg-cyan-500/10 px-1.5 rounded">
                    {activeNotebook.documents?.length || 0}
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".pdf"
                    ref={fileInputRef}
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingPdf}
                    className="w-full py-2 px-3 border border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isProcessingPdf ? (
                      <>
                        <RefreshCw size={14} className="animate-spin text-cyan-500" /> Processing PDF...
                      </>
                    ) : (
                      <>
                        <Plus size={14} /> Upload Financial PDF
                      </>
                    )}
                  </button>

                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto mt-2 pr-1">
                    {(!activeNotebook.documents || activeNotebook.documents.length === 0) ? (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center py-3 italic bg-white dark:bg-slate-900/40 rounded border border-slate-100 dark:border-slate-800">
                        No financial reports uploaded.
                      </p>
                    ) : (
                      activeNotebook.documents.map(doc => (
                        <div key={doc.id} className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between items-center gap-2 group">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold truncate text-slate-900 dark:text-slate-300" title={doc.name}>
                              {doc.name}
                            </p>
                            <span className="text-[9px] text-gray-500 dark:text-gray-400 block">
                              {(doc.charCount / 1000).toFixed(1)}k chars ({doc.pageCount} pgs)
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 p-1"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Saved Notes for active company */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <Edit3 size={14} /> Quick Notes Box
                </h3>

                <form onSubmit={handleSaveNote} className="space-y-2 mb-4 bg-white dark:bg-slate-900/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                  <input
                    type="text"
                    placeholder="Note Title"
                    required
                    value={newNote.title}
                    onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                    className="w-full p-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <textarea
                    placeholder="Write a custom stock note..."
                    required
                    rows={2}
                    value={newNote.content}
                    onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                    className="w-full p-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[10px] uppercase tracking-wider transition"
                  >
                    {editingNoteId ? "Update Notebook Note" : "Save Notebook Note"}
                  </button>
                </form>

                {/* Filter notes linked to this notebook or unlinked */}
                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                  {notes.filter(n => n.notebookId === activeNotebookId).length === 0 ? (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center py-2 italic">No notes saved for this stock.</p>
                  ) : (
                    notes.filter(n => n.notebookId === activeNotebookId).map(note => (
                      <div key={note.id} className="p-2 bg-white dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-[11px] truncate">{note.title}</h4>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleEditNote(note)} className="text-gray-400 hover:text-cyan-500">
                              <Edit3 size={10} />
                            </button>
                            <button onClick={() => handleDeleteNote(note.id)} className="text-gray-400 hover:text-rose-500">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{note.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Actions footer */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between gap-2">
              <button
                onClick={() => setView('dashboard')}
                className="flex-1 py-2 text-xs font-semibold rounded bg-slate-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Exit Workspace
              </button>
              <button
                onClick={generateFullResearchReport}
                disabled={isAiLoading}
                className="flex-1 py-2 text-xs font-bold rounded bg-gradient-to-r from-cyan-600 to-indigo-600 text-white hover:from-cyan-500 hover:to-indigo-500 transition disabled:opacity-50"
              >
                CFA Report
              </button>
            </div>

          </section>

          {/* CENTER PANEL (Chat Interface) */}
          <section className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950">
            
            {/* Chat Title / Clear trigger */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
              <div className="flex items-center gap-2">
                <MessageSquare className="text-cyan-500" size={18} />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Notebook AI Chat</h3>
              </div>
              <button
                onClick={handleClearChats}
                disabled={(chats[activeNotebookId] || []).length === 0}
                className="text-xs text-gray-400 hover:text-rose-500 transition disabled:opacity-30"
              >
                Clear Conversation
              </button>
            </div>

            {/* Chat Log Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              
              {/* Default Welcome / Quick prompt suggest card */}
              {(!chats[activeNotebookId] || chats[activeNotebookId].length === 0) ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl mx-auto mt-8 text-center space-y-4">
                  <div className="p-3 bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white rounded-full w-fit mx-auto shadow-md">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-base">Ask your documents anything</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Gemini parses the context from your uploaded files and can cite specific details or statistics.
                    </p>
                  </div>

                  {/* Suggest queries */}
                  <div className="grid sm:grid-cols-2 gap-2 text-left pt-2">
                    {[
                      "Summarize this annual report.",
                      "What are the critical risks mentioned?",
                      "Are there any major technological growth opportunities?",
                      "Does the company pay high dividends?"
                    ].map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => setChatInput(q)}
                        className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-cyan-500 dark:hover:border-cyan-500 transition text-xs text-left text-slate-700 dark:text-gray-300 font-semibold"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {chats[activeNotebookId].map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`p-4 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-cyan-600 text-white rounded-tr-none'
                          : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-tl-none text-slate-800 dark:text-slate-100'
                      }`}>
                        
                        {/* Header metadata label */}
                        <div className="flex justify-between items-center gap-4 mb-2 text-[10px] font-bold tracking-wider uppercase opacity-60">
                          <span>{msg.role === 'user' ? 'Analyst (You)' : 'PSX AI Analyst'}</span>
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {/* Text formatting with citation rendering support */}
                        <div className="space-y-1">
                          {msg.role === 'user' ? (
                            <p className="leading-relaxed font-medium">{msg.content}</p>
                          ) : (
                            renderFormattedText(msg.content)
                          )}
                        </div>

                        {/* Copy button for model responses */}
                        {msg.role !== 'user' && (
                          <div className="flex justify-end mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                            <button
                              onClick={() => {
                                document.execCommand('copy');
                                navigator.clipboard?.writeText?.(msg.content);
                                triggerStatus("Response copied to clipboard!", "success");
                              }}
                              className="text-[10px] font-bold text-gray-400 hover:text-cyan-500 flex items-center gap-1 transition"
                            >
                              <Copy size={12} /> Copy AI Response
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Loader placeholder */}
              {isAiLoading && (
                <div className="flex gap-3 justify-start max-w-3xl mx-auto">
                  <div className="p-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none text-slate-800 dark:text-slate-100 w-[70%]">
                    <div className="flex items-center gap-2 text-cyan-500 animate-pulse text-xs font-bold">
                      <RefreshCw size={14} className="animate-spin" /> PSX AI Analyst is reasoning through context...
                    </div>
                    <div className="space-y-2 mt-3">
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-[85%]"></div>
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-[60%]"></div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Chat form controls */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/10">
              <form onSubmit={handleSendChatMessage} className="max-w-3xl mx-auto flex gap-3">
                <input
                  type="text"
                  placeholder={
                    (!activeNotebook.documents || activeNotebook.documents.length === 0)
                      ? "⚠️ Upload reports first before querying stock context..."
                      : "Ask a question about " + activeNotebook.ticker + " filings..."
                  }
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isAiLoading}
                  className="flex-1 p-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  type="submit"
                  disabled={isAiLoading || !chatInput.trim()}
                  className="p-3 bg-gradient-to-tr from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl transition disabled:opacity-40"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>

          </section>

          {/* RIGHT SIDEBAR (AI Summary Cards & Full Reports) */}
          <section className="w-full lg:w-[480px] border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-slate-50 dark:bg-slate-900/25">
            
            {/* Tab-like indicator header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Sparkles size={16} className="text-indigo-500" /> Auto AI Summaries
              </div>
              <button
                onClick={generateAiSummaryForActive}
                disabled={isAiLoading || !activeNotebook.documents || activeNotebook.documents.length === 0}
                className="text-xs font-semibold text-cyan-500 hover:text-cyan-400 transition flex items-center gap-1 disabled:opacity-40"
              >
                <RefreshCw size={12} /> Regenerate
              </button>
            </div>

            {/* Scrollable Summary Panel */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

              {/* No Summary Placeholder Card */}
              {!activeNotebook.summary ? (
                <div className="p-6 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/40">
                  <Book size={28} className="mx-auto text-gray-400 mb-3" />
                  <h4 className="font-bold text-sm">No Summary Extracted</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Upload your stock report PDF or click below to trigger a structured financial deep dive.
                  </p>
                  <button
                    onClick={generateAiSummaryForActive}
                    disabled={isAiLoading || !activeNotebook.documents || activeNotebook.documents.length === 0}
                    className="mt-4 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition disabled:opacity-40"
                  >
                    Generate Summary
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Card 1: Overview */}
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-2 py-0.5 rounded">Overview</span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2.5 leading-relaxed">{activeNotebook.summary.companyOverview}</p>
                  </div>

                  {/* Card 2: Financial/Revenue Trends */}
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">Revenue Summary</span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2.5 leading-relaxed">{activeNotebook.summary.revenueSummary}</p>
                  </div>

                  {/* Card 3: Margins & Profitability */}
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded">Profitability Analysis</span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2.5 leading-relaxed">{activeNotebook.summary.profitSummary}</p>
                  </div>

                  {/* Card 4: Main Risks */}
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded">Key Risk Profiles</span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2.5 leading-relaxed">{activeNotebook.summary.keyRisks}</p>
                  </div>

                  {/* Card 5: Catalysts / Opportunities */}
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">Catalysts & Opportunities</span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2.5 leading-relaxed">{activeNotebook.summary.keyOpportunities}</p>
                  </div>

                  {/* Card 6: Conclusion */}
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-2 py-0.5 rounded">Synthesis Outlook</span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2.5 leading-relaxed font-semibold italic">{activeNotebook.summary.finalSummary}</p>
                  </div>
                </div>
              )}

              {/* Full Research Report Viewer */}
              {activeNotebook.fullReport && (
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/80 space-y-4">
                  <div className="flex justify-between items-center bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
                    <div>
                      <h4 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">CFA Research Report</h4>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">Synthesized comprehensive Stock Report</p>
                    </div>
                    <button
                      onClick={() => downloadReportFile(activeNotebook)}
                      className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition shadow"
                      title="Download HTML Report to print to PDF"
                    >
                      <FileDown size={16} />
                    </button>
                  </div>

                  <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-h-[350px] overflow-y-auto pr-2 shadow-inner">
                    {renderFormattedText(activeNotebook.fullReport)}
                  </div>
                </div>
              )}

            </div>
            
          </section>

        </main>
      )}

      {/* --- FOOTER --- */}
      <footer className="py-6 border-t border-slate-200 dark:border-slate-800 mt-auto text-center text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-900/60 transition-colors">
        <p className="flex items-center justify-center gap-1">
          Made for buy-side investment analysts & retail traders. Built securely on Google Gemini 2.5 Flash <Heart size={12} className="text-rose-500 fill-rose-500" />
        </p>
      </footer>

    </div>
  );
}
