import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyCVUyhS-IElG2rYK-QyhE6JHpeajRo0Hvs",
    authDomain: "randomtalk-83427.firebaseapp.com",
    projectId: "randomtalk-83427",
    storageBucket: "randomtalk-83427.firebasestorage.app",
    messagingSenderId: "128976516333",
    appId: "1:128976516333:web:e318f43756919e8dc548e4",
    measurementId: "G-4WLQQ20MYH"
  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { signInWithPopup };