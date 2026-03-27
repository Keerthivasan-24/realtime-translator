import React, { useState } from 'react'
import BottomNav        from './components/BottomNav'
import HomeScreen       from './screens/HomeScreen'
import ConversationScreen from './screens/ConversationScreen'
import MeetingScreen    from './screens/MeetingScreen'
import VideoScreen      from './screens/VideoScreen'
import TranscriptScreen from './screens/TranscriptScreen'
import VideoCall        from './components/VideoCall'

export default function App() {
  const [tab,     setTab]     = useState('home')
  const [session, setSession] = useState(null) // active video call

  // Full-screen video call takes over the whole UI
  if (session) {
    return (
      <VideoCall
        roomId={session.roomId}
        srcLang={session.srcLang}
        tgtLang={session.tgtLang}
        onLeave={() => { setSession(null); setTab('video') }}
      />
    )
  }

  const renderScreen = () => {
    switch (tab) {
      case 'home':         return <HomeScreen onNavigate={setTab} />
      case 'conversation': return <ConversationScreen />
      case 'meeting':      return <MeetingScreen />
      case 'video':        return <VideoScreen onStartCall={(roomId, src, tgt) => setSession({ roomId, srcLang: src, tgtLang: tgt })} />
      case 'transcript':   return <TranscriptScreen />
      default:             return <HomeScreen onNavigate={setTab} />
    }
  }

  return (
    <div style={styles.app}>
      {/* Top logo bar */}
      <div style={styles.topBar}>
        <div style={styles.logo}>文A</div>
      </div>

      {/* Screen content */}
      <div style={styles.content}>
        {renderScreen()}
      </div>

      {/* Bottom nav */}
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

const styles = {
  app: {
    display: 'flex', flexDirection: 'column',
    height: '100vh', background: '#0d0d1a', color: '#fff',
    maxWidth: 480, margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  topBar: {
    display: 'flex', alignItems: 'center', padding: '12px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  logo: {
    width: 36, height: 36, borderRadius: 10,
    background: 'linear-gradient(135deg,#2dd4bf,#818cf8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 800, color: '#fff',
  },
  content: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
}
