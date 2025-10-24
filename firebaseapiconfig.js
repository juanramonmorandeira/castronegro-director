// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyBHHLjBTsOHmvcAnvBGEawhFwf2eQcS3LU",
  authDomain: "village-storyteller.firebaseapp.com",
  projectId: "village-storyteller",
  storageBucket: "village-storyteller.firebasestorage.app",
  messagingSenderId: "869314466089",
  appId: "1:869314466089:web:713a8b943e8fafdb6ce738",
  measurementId: "G-KSNK0Z8JEC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
