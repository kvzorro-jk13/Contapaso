/**
 * ContaPaso - Conexión Oficial con Firebase Firestore en la Nube
 * Proyecto: contapaso-d2dad
 * 
 * Funciona de manera híbrida y transparente:
 * 1. Almacenamiento local (localStorage) para respuesta inmediata y funcionamiento offline/sin conexión.
 * 2. Sincronización en la nube con Cloud Firestore para persistencia global y respaldo de ejercicios.
 * 3. Totalmente compatible con ejecución local por doble clic (file:///) y despliegue en GitHub Pages.
 */

window.firebaseConfig = {
  apiKey: "AIzaSyDr84-U5y40ojxXBF2N27mNt5R3VISoez4",
  authDomain: "contapaso-d2dad.firebaseapp.com",
  projectId: "contapaso-d2dad",
  storageBucket: "contapaso-d2dad.firebasestorage.app",
  messagingSenderId: "622801836533",
  appId: "1:622801836533:web:31a2603f6e0927513028bc",
  measurementId: "G-JXWBR775DH"
};

// Colecciones en Firestore
window.FIREBASE_COLLECTIONS = {
  EJERCICIOS: 'ejercicios_kardex',
  HISTORIAL: 'historial_talleres'
};

window.isFirebaseReady = false;
window.firestoreDb = null;

// Inicialización de Firebase
function initFirebaseApp() {
  try {
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
      if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
      }
      window.firestoreDb = firebase.firestore();
      window.isFirebaseReady = true;
      console.log("ContaPaso: Firebase Firestore conectado exitosamente a contapaso-d2dad.");
      actualizarIndicadorNube(true);
    } else {
      console.warn("ContaPaso: SDK de Firebase no detectado, operando en modo local.");
      actualizarIndicadorNube(false);
    }
  } catch (error) {
    console.error("ContaPaso: Error al inicializar Firebase:", error);
    window.isFirebaseReady = false;
    actualizarIndicadorNube(false);
  }
}

function actualizarIndicadorNube(conectado) {
  const badge = document.getElementById('cloud-status-badge');
  if (badge) {
    if (conectado) {
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span><span class="text-emerald-300">Nube Activa</span>';
      badge.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-[10px] font-mono font-bold shadow-sm";
      badge.title = "Conectado a Firebase Firestore (contapaso-d2dad)";
    } else {
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span><span class="text-cyan-300">Modo Local</span>';
      badge.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold";
      badge.title = "Operando con almacenamiento local del navegador";
    }
  }
}

/**
 * Guarda un ejercicio del historial en Cloud Firestore
 */
window.guardarHistorialFirestore = async function(item) {
  if (!window.isFirebaseReady || !window.firestoreDb) return false;
  try {
    const docId = String(item.id || ('hist_' + Date.now()));
    await window.firestoreDb.collection(window.FIREBASE_COLLECTIONS.HISTORIAL).doc(docId).set({
      ...item,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log("ContaPaso: Taller sincronizado en Firestore ->", docId);
    return true;
  } catch (err) {
    console.warn("ContaPaso: No se pudo sincronizar en Firestore (usando fallback local):", err.message);
    return false;
  }
};

/**
 * Obtiene los ejercicios del historial almacenados en Cloud Firestore
 */
window.obtenerHistorialFirestore = async function() {
  if (!window.isFirebaseReady || !window.firestoreDb) return [];
  try {
    const snapshot = await window.firestoreDb
      .collection(window.FIREBASE_COLLECTIONS.HISTORIAL)
      .limit(50)
      .get();

    const lista = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      lista.push({ ...data, id: doc.id });
    });
    return lista;
  } catch (err) {
    console.warn("ContaPaso: Error al leer historial de Firestore:", err.message);
    return [];
  }
};

/**
 * Guarda un ejercicio en el banco de talleres de Cloud Firestore
 */
window.guardarEjercicioBancoFirestore = async function(ejercicio) {
  if (!window.isFirebaseReady || !window.firestoreDb) return false;
  try {
    const docId = String(ejercicio.id || ('ej_' + Date.now()));
    await window.firestoreDb.collection(window.FIREBASE_COLLECTIONS.EJERCICIOS).doc(docId).set({
      ...ejercicio,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn("ContaPaso: Error guardando ejercicio en Firestore:", err.message);
    return false;
  }
};

/**
 * Obtiene los ejercicios del banco de talleres desde Cloud Firestore
 */
window.obtenerBancoFirestore = async function() {
  if (!window.isFirebaseReady || !window.firestoreDb) return [];
  try {
    const snapshot = await window.firestoreDb
      .collection(window.FIREBASE_COLLECTIONS.EJERCICIOS)
      .get();

    const lista = [];
    snapshot.forEach(doc => {
      lista.push({ ...doc.data(), id: doc.id });
    });
    return lista;
  } catch (err) {
    console.warn("ContaPaso: Error al leer banco de Firestore:", err.message);
    return [];
  }
};

// Inicializar al cargar el script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFirebaseApp);
} else {
  initFirebaseApp();
}
