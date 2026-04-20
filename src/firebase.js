import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAM-1YPVn5GxcZ_RvVCKdpl1YffyH6yVUk",
  authDomain: "twinwash-laundry-pos.firebaseapp.com",
  projectId: "twinwash-laundry-pos",
  storageBucket: "twinwash-laundry-pos.firebasestorage.app",
  messagingSenderId: "622460154064",
  appId: "1:622460154064:web:6113b0111f90a357ac2ed5",
  measurementId: "G-6YKXEVHQPV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// 🔥 THIS is what your POS uses
export const db = getFirestore(app);