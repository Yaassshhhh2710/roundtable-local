import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Mic,Square,Play,Plus,Minus,Settings,FileText,Clock3,Users,Radio,CheckCircle2,ChevronRight,Download,RotateCcw,MoreHorizontal,Activity,Lightbulb,Target,ListChecks,Pause,RotateCcw as ResumeIcon} from 'lucide-react';
import './styles.css';

const colors=['#7c5cff','#22c55e','#f59e0b','#ef476f','#06b6d4'];
const demoSeed=[
 {speaker:0,text:'Welcome everyone. Let’s get started with the project review.',time:'00:04'},
 {speaker:1,text:'I think the biggest thing we need to solve is the onboarding flow.',time:'00:12'},
 {speaker:2,text:'Agreed. We also need to decide who owns the analytics implementation.',time:'00:24'},
 {speaker:0,text:'Let’s make that a decision today and leave with clear owners.',time:'00:31'},
];
const languageOptions=[
 {label:'English (India)',value:'en-IN'},
 {label:'English (US)',value:'en-US'},
 {label:'English (UK)',value:'en-GB'},
 {label:'Hindi',value:'hi-IN'},
];
const defaultNames=['Speaker 1','Speaker 2','Speaker 3','Speaker 4','Speaker 5'];

function App(){
  const [screen,setScreen]=useState('home');
  const [count,setCount]=useState(3);
  const [names,setNames]=useState(['Speaker 1','Speaker 2','Speaker 3']);
  const [language,setLanguage]=useState('en-IN');
  const [topic,setTopic]=useState('');
  const [running,setRunning]=useState(false);
  const [paused,setPaused]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [lines,setLines]=useState([]);
  const [currentSpeaker,setCurrentSpeaker]=useState(0);
  const [draftText,setDraftText]=useState('');
  const [status,setStatus]=useState('Microphone Ready');
  const [waveform,setWaveform]=useState(Array.from({length:36},()=>12));
  const [demoMode,setDemoMode]=useState(false);

  const streamRef=useRef(null);
  const mediaRecorderRef=useRef(null);
  const analyzerRef=useRef(null);
  const audioContextRef=useRef(null);
  const animationFrameRef=useRef(null);
  const timerRef=useRef(null);
  const demoTimerRef=useRef(null);
  const currentSpeakerRef=useRef(0);
  const elapsedRef=useRef(0);
  const namesRef=useRef(names);
  const languageRef=useRef(language);
  const isSessionActiveRef=useRef(false);
  const isPausedRef=useRef(false);
  const transcriptionInFlightRef=useRef(false);

  useEffect(()=>{ setNames(prev=>Array.from({length:count},(_,i)=>prev[i] || defaultNames[i] || `Speaker ${i+1}`)); setCurrentSpeaker(prev=>Math.min(prev,count-1)); },[count]);
  useEffect(()=>{ currentSpeakerRef.current=currentSpeaker; },[currentSpeaker]);
  useEffect(()=>{ elapsedRef.current=elapsed; },[elapsed]);
  useEffect(()=>{ namesRef.current=names; },[names]);
  useEffect(()=>{ languageRef.current=language; },[language]);

  useEffect(()=>{ if(!running) return; timerRef.current=setInterval(()=>setElapsed((value)=>value+1),1000); return ()=>clearInterval(timerRef.current); },[running]);

  useEffect(()=>{
    const onKeyDown=(event)=>{
      if(!running || screen !== 'session') return;
      const tag=event.target && event.target.tagName ? event.target.tagName : '';
      if(tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if(event.key >= '1' && event.key <= '5'){
        const index=Number(event.key)-1;
        if(index < count){
          setCurrentSpeaker(index);
          setStatus(`Current speaker: ${names[index] || defaultNames[index]}`);
        }
      }
    };
    window.addEventListener('keydown',onKeyDown);
    return ()=>window.removeEventListener('keydown',onKeyDown);
  },[running,screen,count,names]);

  useEffect(()=>()=>{
    if(demoTimerRef.current) clearInterval(demoTimerRef.current);
    cleanupResources(true, true);
  },[]);

  const formatTime=(value)=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
  const time=useMemo(()=>formatTime(elapsed),[elapsed]);

  const cleanupAudioGraph=()=>{
    if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current=null;
    if(audioContextRef.current && audioContextRef.current.state !== 'closed'){
      audioContextRef.current.close().catch(()=>{});
    }
    audioContextRef.current=null;
    analyzerRef.current=null;
  };

  const stopMicrophone=()=>{
    if(streamRef.current){
      streamRef.current.getTracks().forEach((track)=>track.stop());
      streamRef.current=null;
    }
  };

  const stopRecorder=()=>{
    if(mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive'){
      try{ mediaRecorderRef.current.stop(); }catch(error){ console.warn('[MIC] Recorder stop failed', error); }
    }
    mediaRecorderRef.current=null;
  };

  const cleanupResources=(keepStatus=false, silent=false)=>{
    stopRecorder();
    stopMicrophone();
    cleanupAudioGraph();
    isSessionActiveRef.current=false;
    isPausedRef.current=false;
    transcriptionInFlightRef.current=false;
    if(!keepStatus && !silent){ setWaveform(Array.from({length:36},()=>12)); }
  };

  const startAudioAnalyzer=(stream)=>{
    const AudioContext=window.AudioContext || window.webkitAudioContext;
    if(!AudioContext){ return; }
    try{
      const audioContext=new AudioContext();
      const analyser=audioContext.createAnalyser();
      analyser.fftSize=1024;
      analyser.smoothingTimeConstant=0.8;
      const source=audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current=audioContext;
      analyzerRef.current=analyser;

      const updateWave=()=>{
        if(!analyzerRef.current) return;
        const data=new Uint8Array(analyzerRef.current.fftSize);
        analyzerRef.current.getByteFrequencyData(data);
        const next = Array.from({length:36},(_,index)=>{
          const sampleIndex=Math.min(data.length-1, Math.floor((index/36) * data.length));
          const level=data[sampleIndex] || 0;
          return Math.max(10, Math.min(90, (level / 255) * 85 + 8));
        });
        setWaveform(next);
        animationFrameRef.current=requestAnimationFrame(updateWave);
      };
      updateWave();
    }catch(error){ console.error('Audio analyzer setup failed', error); }
  };

  const appendFinalLine=(transcript)=>{
    const cleanText=String(transcript || '').trim();
    if(!cleanText) return;
    setLines((previous)=>[...previous,{speaker:currentSpeakerRef.current,text:cleanText,time:formatTime(elapsedRef.current)}]);
    setDraftText('');
  };

  const transcribeAudioBlob=async(blob)=>{
    if(!blob || !blob.size || transcriptionInFlightRef.current) return;
    transcriptionInFlightRef.current=true;

    const formData=new FormData();
    formData.append('audio', blob, `roundtable-${Date.now()}.webm`);

    try{
      const response=await fetch('http://localhost:3001/api/transcribe', {
        method:'POST',
        body:formData,
      });

      if(!response.ok){
        const errorPayload=await response.json().catch(()=>({error:'Local transcription failed.'}));
        throw new Error(errorPayload.error || 'Local transcription failed.');
      }

      const payload=await response.json();
      const text=String(payload.text || '').trim();
      if(text){
        const speakerId=currentSpeakerRef.current;
        const speakerName = namesRef.current[speakerId] || `Speaker ${speakerId + 1}`;
        setLines((previous)=>[...previous,{speaker:speakerId,speakerName,text,time:formatTime(elapsedRef.current)}]);
        setStatus(`${speakerName} spoke`);
      }
    }catch(error){
      console.error('[TRANSCRIBE] local transcription failed:', error);
      setStatus('Transcription unavailable. Please try again.');
    } finally {
      transcriptionInFlightRef.current=false;
    }
  };

  const startMicrophoneCapture=async()=>{
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      setScreen('session');
      setRunning(false);
      setPaused(false);
      setStatus('Microphone access is not available in this browser.');
      return false;
    }

    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      streamRef.current=stream;
      startAudioAnalyzer(stream);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
      mediaRecorderRef.current=recorder;

      recorder.ondataavailable=(event)=>{
        if(!isSessionActiveRef.current || isPausedRef.current || !event.data || event.data.size === 0) return;
        const blob=new Blob([event.data], {type:event.data.type || mimeType || 'audio/webm'});
        transcribeAudioBlob(blob);
      };

      recorder.start(3000);
      setStatus('Listening…');
      return true;
    }catch(error){
      const errorName = error && error.name;
      if(errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError'){
        setStatus('Microphone access denied. Please allow microphone access in your browser settings.');
      }else if(errorName === 'NotFoundError'){
        setStatus('No microphone detected. Please connect a microphone and try again.');
      }else{
        setStatus('Microphone access is unavailable right now.');
      }
      setRunning(false);
      setPaused(false);
      cleanupResources(true,true);
      return false;
    }
  };

  const startDemoSession=()=>{
    if(demoTimerRef.current) clearInterval(demoTimerRef.current);
    cleanupResources(true,true);
    setDemoMode(true);
    setScreen('session');
    setRunning(true);
    setPaused(false);
    setElapsed(0);
    setLines([]);
    setDraftText('');
    setCurrentSpeaker(0);
    setStatus('Demo Session');
    let index=0;
    const addDemoLine=()=>{
      const sample=demoSeed[index % demoSeed.length];
      const speakerIndex = index % Math.max(1, count);
      setLines((previous)=>[...previous,{...sample,speaker:speakerIndex,time:formatTime(elapsed)}]);
      index += 1;
    };
    addDemoLine();
    demoTimerRef.current=setInterval(addDemoLine,4200);
  };

  const startLiveSession=async()=>{
    if(demoTimerRef.current) clearInterval(demoTimerRef.current);
    cleanupResources(true,true);
    setDemoMode(false);

    if(!window.MediaRecorder){
      setScreen('session');
      setRunning(false);
      setPaused(false);
      setStatus('This browser does not support local audio capture.');
      return;
    }

    setScreen('session');
    setRunning(true);
    setPaused(false);
    setElapsed(0);
    setLines([]);
    setDraftText('');
    setCurrentSpeaker(0);
    setStatus('Microphone Ready');
    isSessionActiveRef.current=true;
    isPausedRef.current=false;

    const started = await startMicrophoneCapture();
    if(!started){
      setRunning(false);
      setPaused(false);
      isSessionActiveRef.current=false;
    }
  };

  const handlePause=()=>{
    if(!running || screen !== 'session') return;
    setPaused(true);
    isPausedRef.current=true;
    setDraftText('');
    setStatus('Paused');
    stopRecorder();
    stopMicrophone();
  };

  const handleResume=async()=>{
    if(!running || screen !== 'session') return;
    setPaused(false);
    isPausedRef.current=false;
    setStatus('Resuming microphone…');
    isSessionActiveRef.current=true;
    await startMicrophoneCapture();
  };

  const endSession=()=>{
    if(demoTimerRef.current) clearInterval(demoTimerRef.current);
    setRunning(false);
    setPaused(false);
    isSessionActiveRef.current=false;
    isPausedRef.current=false;
    cleanupResources(true,true);
    setScreen('summary');
    setStatus('Microphone Ready');
  };

  const resetSession=()=>{
    if(demoTimerRef.current) clearInterval(demoTimerRef.current);
    cleanupResources(true,true);
    setScreen('home');
    setRunning(false);
    setPaused(false);
    setElapsed(0);
    setLines([]);
    setDraftText('');
    setCurrentSpeaker(0);
    setStatus('Microphone Ready');
  };

  if(screen==='home'){
    return <Home count={count} setCount={setCount} names={names} setNames={setNames} topic={topic} setTopic={setTopic} language={language} setLanguage={setLanguage} startLiveSession={startLiveSession} startDemoSession={startDemoSession} demoMode={demoMode} setDemoMode={setDemoMode} />;
  }

  if(screen==='summary'){
    return <Summary names={names} lines={lines} elapsed={elapsed} reset={resetSession} />;
  }

  return <Session names={names} lines={lines} running={running} paused={paused} active={currentSpeaker} time={time} status={status} topic={topic} draftText={draftText} waveform={waveform} currentSpeaker={currentSpeaker} setCurrentSpeaker={setCurrentSpeaker} language={language} setLanguage={setLanguage} endSession={endSession} handlePause={handlePause} handleResume={handleResume} />;
}

function Header({onDocs,demoMode=false}){
 return <header>
  <div className="brand">
   <div className="brandMark"><Activity size={18}/></div>
   <div><b>ROUNDTABLE</b><span>KNOW WHO SAID WHAT</span></div>
  </div>
  <div className="headerRight">
   <span className="demoPill">{demoMode ? 'DEMO MODE' : 'LIVE MIC'}</span>
   <button className="ghost" onClick={onDocs}>Docs</button>
  </div>
 </header>;
}

function Home({count,setCount,names,setNames,topic,setTopic,language,setLanguage,startLiveSession,startDemoSession,demoMode,setDemoMode}){
 return <div className="app">
  <Header onDocs={()=>alert('ROUNDTABLE runs locally. Use the live session for real microphone input, or use Demo Session for a sample walkthrough.')} demoMode={demoMode} />
  <main className="hero">
   <div className="eyebrow"><span className="dot"></span> REAL-TIME MULTISPEAKER INTELLIGENCE</div>
   <h1>Hear every voice.<br/><em>Know who said what.</em></h1>
   <p className="sub">Live transcription with speaker tracking, real microphone input, topic detection, decision tracking, and AI summaries — designed for focused conversations.</p>
   <div className="heroActions">
    <button className="primary big" onClick={startLiveSession}><Mic size={19}/> Start Session <ChevronRight size={18}/></button>
    <button className="secondary big" onClick={startDemoSession}><Play size={18}/> Demo Session</button>
   </div>

   <div className="setup">
    <div className="setupTop">
     <div><span className="label">SESSION SETUP</span><h2>Who’s at the table?</h2></div>
     <div className="counter">
      <button onClick={()=>setCount(Math.max(3,count-1))}><Minus size={16}/></button>
      <strong>{count}</strong>
      <button onClick={()=>setCount(Math.min(5,count+1))}><Plus size={16}/></button>
     </div>
    </div>
    <div className="speakerGrid">
     {names.map((name,index)=><div className="speakerInput" key={index}><span style={{background:colors[index]}}></span><input value={name} onChange={(event)=>setNames((values)=>values.map((item,indexValue)=> indexValue===index ? event.target.value : item))}/></div>)}
    </div>
    <div className="topicRow">
     <div className="topicField"><FileText size={16}/><input placeholder="Session topic (optional)" value={topic} onChange={(event)=>setTopic(event.target.value)}/></div>
     <div className="languageField">
      <label>LANGUAGE</label>
      <select value={language} onChange={(event)=>setLanguage(event.target.value)}>
       {languageOptions.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
     </div>
    </div>
   </div>

   <div className="features">
    <Feature icon={<Users/>} title="Speaker Diarization" text="Real-time attribution with per-speaker color coding and live indicators."/>
    <Feature icon={<Activity/>} title="Live Waveform" text="Microphone-driven waveform using the active audio stream in your browser."/>
    <Feature icon={<Lightbulb/>} title="AI Insights" text="Topics, decisions, action items, and post-session summary — structured."/>
   </div>
  </main>
 </div>;
}

function Feature({icon,title,text}){
 return <div className="feature">
  <div className="featureIcon">{icon}</div>
  <div>
   <h3>{title}</h3>
   <p>{text}</p>
  </div>
 </div>;
}

function Wave({waveform,active,currentSpeaker}){
 const bars = waveform && waveform.length ? waveform : Array.from({length:36},()=>12);
 return <div className={`wave ${active ? 'waveActive' : ''}`}>
  {bars.map((value,index)=><i key={index} style={{height:`${value}px`,opacity:active ? 0.4 + (value/110) : 0.22 + (index % 7) / 18}}></i>)}
  <div className="waveGlow" style={{left:`${10 + (currentSpeaker / 5) * 75}%`}} />
 </div>;
}

function Session({names,lines,running,paused,active,time,status,topic,draftText,waveform,currentSpeaker,setCurrentSpeaker,language,setLanguage,endSession,handlePause,handleResume}){
 return <div className="app dark">
  <Header onDocs={()=>{}} demoMode={false} />
  <div className="sessionBar">
   <div><span className="liveDot"></span>{paused ? 'PAUSED' : running ? 'LIVE SESSION' : 'SESSION'} <span className="sep">/</span> {topic || 'Untitled conversation'}</div>
   <div className="sessionTools">
    <span className="timer"><Clock3 size={15}/>{time}</span>
    {paused ? <button className="secondary" onClick={handleResume}><ResumeIcon size={15}/> Resume</button> : <button className="secondary" onClick={handlePause}><Pause size={15}/> Pause</button>}
    <button className="stop" onClick={endSession}><Square size={15}/> End Session</button>
   </div>
  </div>

  <main className="workspace">
   <section className="transcriptPanel">
    <div className="panelHead">
     <div><span className="label">LIVE TRANSCRIPT</span><h2>Conversation</h2></div>
     <span className="tiny">{lines.length} utterances</span>
    </div>

    <div className="waveWrap">
     <Wave waveform={waveform} active={running && !paused} currentSpeaker={currentSpeaker} />
     <div className="waveCaption">
      <span>{status}</span>
      <span>{names[currentSpeaker] || `Speaker ${currentSpeaker + 1}`}</span>
     </div>
    </div>

    <div className="speakerControls">
     <div className="speakerControl">
      <span className="label">CURRENT SPEAKER</span>
      <select value={currentSpeaker} onChange={(event)=>setCurrentSpeaker(Number(event.target.value))}>
       {names.map((name,index)=><option key={index} value={index}>{name}</option>)}
      </select>
     </div>
     <div className="speakerControl small">
      <span className="label">LANGUAGE</span>
      <select value={language} onChange={(event)=>setLanguage(event.target.value)}>
       {languageOptions.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
     </div>
    </div>

    <div className="speakerTabs">
     {names.map((name,index)=><button type="button" className={index===active?'active':''} key={index} onClick={()=>setCurrentSpeaker(index)}><span style={{background:colors[index]}}></span>{name}</button>)}
    </div>

    <div className="transcript">
     {draftText ? <div className="utterance liveDraft">
       <div className="avatar" style={{background:colors[currentSpeaker]}}>{currentSpeaker + 1}</div>
       <div>
        <div className="uMeta"><b>{names[currentSpeaker] || `Speaker ${currentSpeaker+1}`}</b><time>LIVE</time></div>
        <p>{draftText}</p>
       </div>
     </div> : null}

     {lines.length===0 && !draftText ? <div className="empty"><Radio size={28}/><p>Waiting for conversation…</p><span>Start speaking to populate the transcript.</span></div> : null}

     {lines.map((line,index)=><div className="utterance" key={`${line.speaker}-${line.time}-${index}`}>
       <div className="avatar" style={{background:colors[line.speaker]}}>{line.speaker + 1}</div>
       <div>
        <div className="uMeta"><b>{names[line.speaker] || `Speaker ${line.speaker + 1}`}</b><time>{line.time}</time></div>
        <p>{line.text}</p>
       </div>
     </div>)}
    </div>
   </section>

   <aside className="insights">
    <div className="panelHead">
     <div><span className="label">SESSION INTELLIGENCE</span><h2>Insights</h2></div>
     <button className="iconBtn"><MoreHorizontal size={18}/></button>
    </div>
    <Insight icon={<Target/>} title="Key Topics"><span className="tag">Onboarding</span><span className="tag">Analytics ownership</span></Insight>
    <Insight icon={<CheckCircle2/>} title="Decisions"><div className="insightItem">Assign analytics implementation owner <small>Open</small></div></Insight>
    <Insight icon={<ListChecks/>} title="Action Items"><div className="insightItem">Confirm onboarding review owner <small>Next</small></div><div className="insightItem">Document handoff plan <small>Due</small></div></Insight>
    <Insight icon={<Settings/>} title="Summary"><div className="insightItem">Focused discussion on onboarding urgency and decision ownership.</div></Insight>
   </aside>
  </main>
 </div>;
}

function Insight({icon,title,children}){
 return <div className="insight">
  <div className="insightTitle">{icon}<b>{title}</b></div>
  <div className="insightBody">{children}</div>
 </div>;
}

function Summary({names,lines,elapsed,reset}){
 return <div className="app">
  <Header onDocs={()=>{}} demoMode={false} />
  <main className="summary">
   <div className="summaryTop">
    <div>
     <span className="label">SESSION COMPLETE</span>
     <h1>Conversation summary</h1>
     <p>{fmt2(elapsed)} · {lines.length} utterances · {names.length} speakers</p>
    </div>
    <div className="summaryActions">
     <button className="secondary" onClick={reset}><RotateCcw size={16}/> New Session</button>
     <button className="primary" onClick={()=>window.print()}><Download size={16}/> Export</button>
    </div>
   </div>

   <div className="summaryGrid">
    <div className="card">
     <span className="label">EXECUTIVE SUMMARY</span>
     <h2>A focused discussion on onboarding and analytics ownership.</h2>
     <p>The team identified the onboarding flow as a key problem area and agreed to establish clear ownership for the analytics implementation. The next step is to review the onboarding experience and confirm the implementation owner.</p>
    </div>
    <div className="card">
     <span className="label">SPEAKERS</span>
     {names.map((name,index)=><div className="speakerRow" key={index}><span style={{background:colors[index]}}></span><b>{name}</b><small>{lines.filter((line)=>line.speaker===index).length} utterances</small></div>)}
    </div>
    <div className="card wide">
     <span className="label">TRANSCRIPT</span>
     {lines.map((line,index)=><div className="sumLine" key={`${line.text}-${index}`}><b style={{color:colors[line.speaker]}}>{names[line.speaker] || `Speaker ${line.speaker + 1}`}</b><span>{line.text}</span><time>{line.time}</time></div>)}
    </div>
   </div>
  </main>
 </div>;
}

function fmt2(seconds){
 return `${Math.floor(seconds/60)}m ${seconds%60}s`;
}

createRoot(document.getElementById('root')).render(<App/>);
