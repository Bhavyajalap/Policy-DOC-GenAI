import { useState, useRef, useEffect, useCallback } from 'react';
import Head from 'next/head';

const CHIPS = [
  'Summarise this policy document',
  'What are the key provisions?',
  'Who does this policy apply to?',
  'What are the penalties or consequences?',
  'Are there any deadlines or timeframes?',
  'What rights does this grant individuals?',
];

function DocIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
      <rect x="0.5" y="0.5" width="13" height="15" rx="2" fill="var(--danger-bg)" stroke="var(--danger)" strokeOpacity="0.4"/>
      <path d="M3 5h8M3 8h8M3 11h5" stroke="var(--danger)" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.7"/>
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 10.5V3M8 3L5.5 5.5M8 3l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.5 11.5v1A1.5 1.5 0 004 14h8a1.5 1.5 0 001.5-1.5v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 8l12-6-4.5 6 4.5 6L2 8z"/>
    </svg>
  );
}

function formatMessage(text) {
  const lines = text.split('\n');
  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const bold = (str) => {
      const parts = str.split(/\*\*(.*?)\*\*/g);
      return parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p);
    };

    if (line.startsWith('### ')) {
      elements.push(<h4 key={key++} style={{fontWeight:500,marginTop:'12px',marginBottom:'4px'}}>{bold(line.slice(4))}</h4>);
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={key++} style={{fontWeight:500,marginTop:'14px',marginBottom:'6px'}}>{bold(line.slice(3))}</h3>);
    } else if (line.match(/^[-•*] /)) {
      elements.push(<li key={key++} style={{marginLeft:'16px',marginBottom:'3px'}}>{bold(line.slice(2))}</li>);
    } else if (line.match(/^\d+\. /)) {
      elements.push(<li key={key++} style={{marginLeft:'16px',marginBottom:'3px',listStyleType:'decimal'}}>{bold(line.replace(/^\d+\. /,''))}</li>);
    } else {
      elements.push(<p key={key++} style={{marginBottom:'6px'}}>{bold(line)}</p>);
    }
  }
  return elements;
}

export default function Home() {
  const [docs, setDocs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [warn, setWarn] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fileRef = useRef(null);
  const messagesEnd = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const toBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('Read failed'));
    r.readAsDataURL(file);
  });

  const handleFiles = useCallback(async (files) => {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf');
    if (!pdfs.length) { setWarn('Only PDF files are supported.'); return; }
    const newDocs = await Promise.all(pdfs.map(async f => ({
      id: Date.now() + Math.random(),
      name: f.name,
      size: f.size,
      base64: await toBase64(f),
    })));
    setDocs(prev => [...prev, ...newDocs]);
  }, []);

  const onFileChange = (e) => { handleFiles(e.target.files); e.target.value = ''; };

  const removeDoc = (id) => setDocs(prev => prev.filter(d => d.id !== id));

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg) return;
    if (!docs.length) { setWarn('Please upload at least one PDF document first.'); return; }
    setInput('');
    setWarn('');
    setLoading(true);

    const userMsg = { role: 'user', text: msg };
    setMessages(prev => [...prev, userMsg]);

    // Build API messages — include PDFs on every user turn that needs docs
    const userContent = [
      ...docs.map(d => ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: d.base64 } })),
      { type: 'text', text: msg },
    ];

    // History: prior turns use text only (PDFs don't need to repeat)
    const history = messages.flatMap(m => {
      if (m.role === 'user') return [{ role: 'user', content: [{ type: 'text', text: m.text }] }];
      return [{ role: 'assistant', content: m.text }];
    });

    const apiMessages = [...history, { role: 'user', content: userContent }];

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, docNames: docs.map(d => d.name) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'API error');
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `**Error:** ${err.message}` }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const autoResize = (el) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  };

  const fmtSize = (b) => b < 1024 * 1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/1024/1024).toFixed(1)} MB`;

  return (
    <>
      <Head>
        <title>Policy Assistant</title>
        <meta name="description" content="AI-powered government and legal policy document assistant" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{display:'flex',height:'100vh',overflow:'hidden'}}>

        {/* Sidebar */}
        <div style={{
          width: sidebarOpen ? 270 : 0,
          minWidth: sidebarOpen ? 270 : 0,
          overflow: 'hidden',
          transition: 'width .2s, min-width .2s',
          background: 'var(--surface)',
          borderRight: '0.5px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{padding:'16px 16px 14px',borderBottom:'0.5px solid var(--border)',flexShrink:0}}>
            <div style={{fontSize:11,fontWeight:600,letterSpacing:'.07em',color:'var(--text3)',textTransform:'uppercase',marginBottom:10}}>Documents</div>
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width:'100%',display:'flex',alignItems:'center',gap:8,
                padding:'9px 12px',background:'var(--surface2)',
                border:'0.5px dashed var(--border-md)',borderRadius:8,
                fontSize:13,color:'var(--text2)',cursor:'pointer',
                transition:'background .15s',
              }}
              onMouseOver={e=>e.currentTarget.style.background='var(--bg)'}
              onMouseOut={e=>e.currentTarget.style.background='var(--surface2)'}
            >
              <UploadIcon /> Upload PDF
            </button>
            <input ref={fileRef} type="file" accept=".pdf" multiple onChange={onFileChange} style={{display:'none'}} />
          </div>

          <div style={{flex:1,overflowY:'auto',padding:'10px 10px'}}>
            {docs.length === 0 ? (
              <div style={{padding:'24px 8px',textAlign:'center',color:'var(--text3)',fontSize:13,lineHeight:1.7}}>
                No documents yet.<br/>Upload PDFs to begin.
              </div>
            ) : docs.map(doc => (
              <div key={doc.id} style={{
                display:'flex',alignItems:'flex-start',gap:10,
                padding:'9px 10px',marginBottom:5,
                background:'var(--surface2)',borderRadius:8,
                border:'0.5px solid var(--border)',position:'relative',
              }}>
                <div style={{marginTop:1,flexShrink:0}}><DocIcon /></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={doc.name}>{doc.name}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{fmtSize(doc.size)}</div>
                </div>
                <button
                  onClick={() => removeDoc(doc.id)}
                  style={{
                    background:'none',border:'none',color:'var(--text3)',
                    fontSize:16,lineHeight:1,cursor:'pointer',padding:'0 2px',
                    flexShrink:0,marginTop:-1,
                  }}
                  title="Remove"
                >×</button>
              </div>
            ))}
          </div>

          <div style={{padding:'12px 16px',borderTop:'0.5px solid var(--border)',flexShrink:0}}>
            <div style={{fontSize:12,color:'var(--text3)',textAlign:'center'}}>
              {docs.length === 0 ? 'No documents loaded' : `${docs.length} document${docs.length>1?'s':''} loaded`}
            </div>
          </div>
        </div>

        {/* Main */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>

          {/* Header */}
          <div style={{
            padding:'12px 20px',
            background:'var(--surface)',
            borderBottom:'0.5px solid var(--border)',
            display:'flex',alignItems:'center',gap:12,
            flexShrink:0,
          }}>
            <button
              onClick={() => setSidebarOpen(s => !s)}
              style={{background:'none',border:'none',color:'var(--text2)',padding:'4px',borderRadius:6,display:'flex',alignItems:'center'}}
              title="Toggle sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="4" width="14" height="1.5" rx="0.75" fill="currentColor"/>
                <rect x="2" y="8.25" width="14" height="1.5" rx="0.75" fill="currentColor"/>
                <rect x="2" y="12.5" width="14" height="1.5" rx="0.75" fill="currentColor"/>
              </svg>
            </button>
            <div style={{flex:1}}>
              <div style={{fontWeight:500,fontSize:15}}>Policy Assistant</div>
              <div style={{fontSize:12,color:'var(--text3)'}}>
                {docs.length ? `${docs.length} document${docs.length>1?'s':''} active` : 'Upload documents to begin'}
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                style={{
                  padding:'5px 12px',background:'none',border:'0.5px solid var(--border-md)',
                  borderRadius:7,fontSize:12,color:'var(--text2)',cursor:'pointer',
                }}
              >
                Clear chat
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:'auto',padding:'24px 20px',display:'flex',flexDirection:'column',gap:18}}>

            {messages.length === 0 && (
              <div style={{maxWidth:520,margin:'auto',textAlign:'center'}}>
                <div style={{
                  width:52,height:52,borderRadius:'50%',background:'var(--accent-bg)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  margin:'0 auto 18px',fontSize:22,
                }}>📋</div>
                <h2 style={{fontWeight:500,fontSize:20,marginBottom:10}}>Government & Legal Policy Assistant</h2>
                <p style={{color:'var(--text2)',lineHeight:1.75,marginBottom:22,fontSize:14}}>
                  Upload your policy documents in the sidebar, then ask questions in plain language.
                  I'll read across all your documents to find accurate, cited answers.
                </p>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center'}}>
                  {CHIPS.map(chip => (
                    <button
                      key={chip}
                      onClick={() => sendMessage(chip)}
                      style={{
                        padding:'7px 14px',background:'var(--surface)',
                        border:'0.5px solid var(--border-md)',borderRadius:20,
                        fontSize:12,color:'var(--text2)',cursor:'pointer',
                        transition:'all .15s',
                      }}
                      onMouseOver={e=>{ e.currentTarget.style.background='var(--accent-bg)'; e.currentTarget.style.color='var(--accent-text)'; e.currentTarget.style.borderColor='var(--accent)'; }}
                      onMouseOut={e=>{ e.currentTarget.style.background='var(--surface)'; e.currentTarget.style.color='var(--text2)'; e.currentTarget.style.borderColor='var(--border-md)'; }}
                    >{chip}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{display:'flex',gap:10,flexDirection:msg.role==='user'?'row-reverse':'row',maxWidth:720,marginLeft:msg.role==='user'?'auto':'0'}}>
                <div style={{
                  width:30,height:30,borderRadius:'50%',flexShrink:0,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:12,fontWeight:500,
                  background: msg.role==='user' ? 'var(--accent-bg)' : 'var(--success-bg)',
                  color: msg.role==='user' ? 'var(--accent-text)' : 'var(--success-text)',
                }}>
                  {msg.role === 'user' ? 'You' : 'AI'}
                </div>
                <div style={{
                  padding:'10px 14px',
                  borderRadius: msg.role==='user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  maxWidth:580,
                  background: msg.role==='user' ? 'var(--accent-bg)' : 'var(--surface)',
                  border: msg.role==='user' ? '0.5px solid rgba(26,79,186,0.2)' : '0.5px solid var(--border)',
                  fontSize:14,lineHeight:1.65,
                }}>
                  {msg.role === 'assistant' && docs.length > 0 && (
                    <div style={{
                      display:'inline-flex',alignItems:'center',gap:5,
                      background:'var(--surface2)',border:'0.5px solid var(--border)',
                      borderRadius:10,padding:'2px 8px',fontSize:11,
                      color:'var(--text2)',marginBottom:8,
                    }}>
                      📄 {docs.length} doc{docs.length>1?'s':''} referenced
                    </div>
                  )}
                  {formatMessage(msg.text)}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{display:'flex',gap:10,maxWidth:720}}>
                <div style={{width:30,height:30,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,background:'var(--success-bg)',color:'var(--success-text)'}}>AI</div>
                <div style={{padding:'14px 16px',background:'var(--surface)',border:'0.5px solid var(--border)',borderRadius:'4px 14px 14px 14px',display:'flex',gap:5,alignItems:'center'}}>
                  {[0,1,2].map(n => (
                    <span key={n} style={{
                      width:6,height:6,borderRadius:'50%',background:'var(--text3)',
                      animation:'bounce 0.9s infinite',
                      animationDelay:`${n*0.15}s`,
                      display:'inline-block',
                    }}/>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEnd}/>
          </div>

          {/* Input */}
          <div style={{padding:'14px 20px',background:'var(--surface)',borderTop:'0.5px solid var(--border)',flexShrink:0}}>
            {warn && (
              <div style={{background:'var(--warn-bg)',border:'0.5px solid var(--border-md)',borderRadius:8,padding:'9px 14px',fontSize:13,color:'var(--warn-text)',marginBottom:10}}>
                {warn}
              </div>
            )}
            <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize(e.target); }}
                onKeyDown={handleKey}
                placeholder={docs.length ? 'Ask a question about your policy documents…' : 'Upload documents first, then ask questions…'}
                rows={1}
                style={{
                  flex:1,resize:'none',padding:'10px 14px',
                  background:'var(--surface2)',border:'0.5px solid var(--border-md)',
                  borderRadius:12,fontSize:14,color:'var(--text)',
                  lineHeight:1.5,maxHeight:150,minHeight:42,
                  outline:'none',
                }}
                onFocus={e=>e.target.style.borderColor='var(--accent)'}
                onBlur={e=>e.target.style.borderColor='var(--border-md)'}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading || !docs.length}
                style={{
                  width:40,height:40,borderRadius:'50%',border:'none',
                  background: (!input.trim() || loading || !docs.length) ? 'var(--surface2)' : 'var(--text)',
                  color: (!input.trim() || loading || !docs.length) ? 'var(--text3)' : 'var(--bg)',
                  cursor: (!input.trim() || loading || !docs.length) ? 'default' : 'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  flexShrink:0,transition:'all .15s',
                }}
              >
                <SendIcon/>
              </button>
            </div>
            <div style={{fontSize:11,color:'var(--text3)',textAlign:'center',marginTop:8}}>
              Powered by Claude · API key secured on server · Never stored
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
}
