import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, signInWithPopup } from './firebase';
import './Home.css';

function Home() {
  const [gender, setGender] = useState('');
  const navigate = useNavigate();

  const extractNameFromEmail = (email) => {
    const namePart = email.split('@')[0]; // e.g., "john.doe" from "john.doe@example.com"
    return namePart
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '); // "John Doe"
  };

  const handleGoogleSignIn = async () => {
    if (!gender) {
      alert('Please select your gender.');
      return;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const name = extractNameFromEmail(user.email);
      navigate('/chat', { state: { name, gender } });
    } catch (error) {
      console.error('Sign-in error:', error);
      alert('Failed to sign in. Please try again.');
    }
  };

  return (
    <div className="home">
      <h1>RandomTalk</h1>
      <p>Connect with strangers through video and chat!</p>
      <div className="user-form">
        <select value={gender} onChange={(e) => setGender(e.target.value)} required>
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <button onClick={handleGoogleSignIn}>Sign In with Google</button>
      </div>
    </div>
  );
}

export default Home;