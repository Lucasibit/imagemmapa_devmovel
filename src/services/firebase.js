// Inicialização do Firebase (apenas Firestore é usado nesta aplicação).
//
// ⚠️ CONFIGURAÇÃO OBRIGATÓRIA
// 1. Acesse https://console.firebase.google.com e crie um projeto.
// 2. Em "Build > Firestore Database", crie um banco (modo de teste durante o desenvolvimento).
// 3. Em "Configurações do projeto > Seus apps > Web", registre um app Web e
//    copie o objeto `firebaseConfig` para baixo.
//
// Observação: as chaves abaixo NÃO são segredos — a apiKey do Firebase Web é
// pública por design. A proteção dos dados é feita pelas Security Rules do
// Firestore, não por ocultar a config.
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD6FSIByIhKxn7FoeFm6oaKcQqYpE8WdPo",
  projectId: "mapalugares-50d61",
  storageBucket: "mapalugares-50d61.firebasestorage.app",
  messagingSenderId: "367226964788",
  appId: "1:367226964788:ios:7c598c4d6f7600e991b361",
};

// Evita reinicializar o app durante o hot-reload do Metro.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// `experimentalForceLongPolling` torna a conexão do Firestore confiável no
// React Native/Expo, onde o transporte WebChannel padrão costuma falhar.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

