import { setAiTokenProvider } from './services/aiApiClient';
import { getFirebaseAuth } from './lib/firebase';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

setAiTokenProvider(async () => {
  const user=getFirebaseAuth()?.currentUser;
  if (!user) throw new Error('Увійдіть в обліковий запис для ШІ-розпізнавання.');
  return user.getIdToken();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
