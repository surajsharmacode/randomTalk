import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [peerId, setPeerId] = useState(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [peerInfo, setPeerInfo] = useState({ name: '', gender: '' });
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const hasJoined = useRef(false);
  const isVideoReady = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { name, gender } = location.state || { name: 'Anonymous', gender: 'Unknown' };

  useEffect(() => {
    if (!auth.currentUser) {
      navigate('/');
      return;
    }

    const setupVideoAndJoin = async () => {
      if (!hasJoined.current) {
        await startVideo();
        socket.emit('join', { name, gender });
        hasJoined.current = true;
      }
    };

    setupVideoAndJoin();

    socket.on('waiting', () => {
      console.log('Waiting for a match...');
      setIsWaiting(true);
      setPeerId(null);
      setMessages([]);
      setPeerInfo({ name: '', gender: '' });
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });

    socket.on('paired', (data) => {
      console.log('Paired with:', data);
      setPeerId(data.id);
      setIsWaiting(false);
      setPeerInfo({ name: data.name, gender: data.gender });
      if (isVideoReady.current) {
        initiateWebRTC(true);
      } else {
        console.log('Video not ready, waiting...');
      }
    });

    socket.on('signal', async (data) => {
      console.log('Received signal from', data.from, 'type:', data.signal.type || 'candidate');
      if (!peerConnectionRef.current) await initiateWebRTC(false);
      try {
        if (data.signal.type === 'offer') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          socket.emit('signal', { signal: answer, to: data.from });
          console.log('Sent answer to', data.from);
        } else if (data.signal.type === 'answer') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
          console.log('Set remote description with answer');
        } else if (data.signal.candidate) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.signal));
          console.log('Added ICE candidate');
        }
      } catch (error) {
        console.error('Signal error:', error);
      }
    });

    socket.on('message', (data) => {
      setMessages((prev) => [...prev, { text: data.text, from: data.from }]);
    });

    socket.on('userDisconnected', () => {
      console.log('Peer disconnected');
      setPeerId(null);
      setIsWaiting(true);
      setMessages([]);
      setPeerInfo({ name: '', gender: '' });
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });

    return () => {
      socket.off('waiting');
      socket.off('paired');
      socket.off('signal');
      socket.off('message');
      socket.off('userDisconnected');
    };
  }, [name, gender, navigate]);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('Local stream started');
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        isVideoReady.current = true;
      } else {
        console.error('Local video ref not set yet');
      }
    } catch (error) {
      console.error('Error starting video:', error);
      if (error.name === 'NotAllowedError') {
        alert('Please allow camera and microphone access to use RandomTalk.');
      }
    }
  };

  const initiateWebRTC = async (isInitiator) => {
    try {
      if (!localVideoRef.current || !localVideoRef.current.srcObject) {
        console.error('Local stream not ready');
        await startVideo();
      }
      if (!peerId) {
        console.error('Peer ID not set');
        return;
      }
      const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      peerConnectionRef.current = new RTCPeerConnection(configuration);
      const localStream = localVideoRef.current.srcObject;
      localStream.getTracks().forEach((track) => {
        peerConnectionRef.current.addTrack(track, localStream);
        console.log('Added track:', track.kind);
      });

      peerConnectionRef.current.ontrack = (event) => {
        console.log('Received remote stream:', event.streams[0].id);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        } else {
          console.error('Remote video ref not set');
        }
      };

      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && peerId) {
          console.log('Sending ICE candidate to', peerId);
          socket.emit('signal', { signal: event.candidate, to: peerId });
        }
      };

      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnectionRef.current.connectionState);
        if (peerConnectionRef.current.connectionState === 'failed') {
          console.error('WebRTC connection failed');
        }
      };

      if (isInitiator) {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        console.log('Sent offer to', peerId);
        socket.emit('signal', { signal: offer, to: peerId });
      }
    } catch (error) {
      console.error('WebRTC error:', error);
    }
  };

  const handleConnect = () => socket.emit('join', { name, gender });
  const handleDisconnect = () => {
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    socket.emit('disconnect');
    setPeerId(null);
    setIsWaiting(true);
    setMessages([]);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };
  const handleNext = () => {
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    socket.emit('next');
  };
  const handleSendMessage = () => {
    if (messageInput.trim() && peerId) {
      socket.emit('message', { text: messageInput, to: peerId });
      setMessages((prev) => [...prev, { text: messageInput, from: socket.id }]);
      setMessageInput('');
    }
  };
  const handleLogout = async () => {
    await signOut(auth);
    if (peerConnectionRef.current) peerConnectionRef.current.close();
    socket.disconnect();
    navigate('/');
  };

  return (
    <div className="app">
      <header>
        <h1>RandomTalk</h1>
        <button className="logout" onClick={handleLogout}>Logout</button>
      </header>
      <main>
        <section className="video-section">
          {isWaiting && !peerId ? (
            <p className="waiting">Finding someone to talk to...</p>
          ) : (
            <>
              <div className="video-wrapper">
                <video ref={localVideoRef} autoPlay muted className="local-video" />
                <span>You ({name})</span>
              </div>
              <div className="video-wrapper">
                <video ref={remoteVideoRef} autoPlay className="remote-video" />
                <span>{peerInfo.name || 'Stranger'} ({peerInfo.gender || 'Unknown'})</span>
              </div>
            </>
          )}
          <div className="video-controls">
            <button onClick={handleConnect} disabled={peerId || isWaiting}>Connect</button>
            <button onClick={handleDisconnect} disabled={!peerId && !isWaiting}>Disconnect</button>
            <button onClick={handleNext} disabled={!peerId}>Next</button>
          </div>
        </section>
        <section className="chat-section">
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.from === socket.id ? 'sent' : 'received'}`}>
                {msg.text}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Type a message..."
              disabled={!peerId}
            />
            <button onClick={handleSendMessage} disabled={!peerId}>Send</button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;