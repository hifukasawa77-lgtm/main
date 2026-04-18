// Firebase configuration (replace with your own)
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Encryption key
const ENCRYPTION_KEY = 'your-encryption-key';

// Navigation
document.getElementById('scanNav').addEventListener('click', () => showScreen('scanScreen'));
document.getElementById('manualNav').addEventListener('click', () => showScreen('manualScreen'));
document.getElementById('listNav').addEventListener('click', () => showScreen('listScreen'));
document.getElementById('chartNav').addEventListener('click', () => showScreen('chartScreen'));

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => screen.style.display = 'none');
  document.getElementById(screenId).style.display = 'block';
  if (screenId === 'chartScreen') {
    renderChart();
  }
}

// Camera functionality
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cameraBtn = document.getElementById('cameraBtn');
const captureBtn = document.getElementById('captureBtn');
const ocrResult = document.getElementById('ocrResult');

let stream;

cameraBtn.addEventListener('click', async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.style.display = 'block';
    captureBtn.style.display = 'block';
    cameraBtn.style.display = 'none';
  } catch (err) {
    alert('Camera access denied / カメラアクセスが拒否されました');
  }
});

captureBtn.addEventListener('click', () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  stream.getTracks().forEach(track => track.stop());
  video.style.display = 'none';
  captureBtn.style.display = 'none';
  cameraBtn.style.display = 'block';
  performOCR();
});

// OCR functionality
async function performOCR() {
  ocrResult.textContent = 'Processing... / 処理中...';
  try {
    const { data: { text } } = await Tesseract.recognize(canvas, 'jpn+eng');
    ocrResult.textContent = text;
    parseExpense(text);
  } catch (err) {
    ocrResult.textContent = 'OCR failed / OCR失敗';
  }
}

// Parse expense from OCR text
function parseExpense(text) {
  const lines = text.split('\n');
  lines.forEach(line => {
    // Regex for item and price, e.g., "Apple ¥100"
    const match = line.match(/^(.+?)\s*¥\s*(\d+(?:,\d{3})*)/);
    if (match) {
      const item = match[1].trim();
      const price = parseInt(match[2].replace(/,/g, ''));
      const date = new Date().toISOString().split('T')[0];
      addExpense({ item, price, date });
    }
  });
}

// Data management
function loadExpenses() {
  let expenses = [];
  const encrypted = localStorage.getItem('expenses');
  if (encrypted) {
    const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
    expenses = JSON.parse(decrypted);
  }
  displayExpenses(expenses);
  syncToFirebase(expenses);
}

function saveExpenses(expenses) {
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(expenses), ENCRYPTION_KEY).toString();
  localStorage.setItem('expenses', encrypted);
}

function addExpense(expense) {
  let expenses = [];
  const encrypted = localStorage.getItem('expenses');
  if (encrypted) {
    const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
    expenses = JSON.parse(decrypted);
  }
  expense.id = Date.now().toString();
  expenses.push(expense);
  saveExpenses(expenses);
  loadExpenses();
}

function displayExpenses(expenses) {
  const list = document.getElementById('expensesList');
  list.innerHTML = '';
  let total = 0;
  expenses.forEach(expense => {
    const li = document.createElement('li');
    li.textContent = `${expense.item}: ¥${expense.price} (${expense.date})`;
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => deleteExpense(expense.id);
    li.appendChild(deleteBtn);
    list.appendChild(li);
    total += expense.price;
  });
  document.getElementById('total').textContent = `Total: ¥${total} / 合計: ¥${total}`;
}

function deleteExpense(id) {
  let expenses = [];
  const encrypted = localStorage.getItem('expenses');
  if (encrypted) {
    const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
    expenses = JSON.parse(decrypted);
  }
  expenses = expenses.filter(e => e.id !== id);
  saveExpenses(expenses);
  loadExpenses();
}

// Manual entry
document.getElementById('manualForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const item = document.getElementById('itemInput').value;
  const price = parseInt(document.getElementById('priceInput').value);
  const date = document.getElementById('dateInput').value;
  addExpense({ item, price, date });
  e.target.reset();
});

// CSV export
document.getElementById('exportBtn').addEventListener('click', () => {
  let expenses = [];
  const encrypted = localStorage.getItem('expenses');
  if (encrypted) {
    const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
    expenses = JSON.parse(decrypted);
  }
  const csv = 'Item,Price,Date\n' + expenses.map(e => `${e.item},${e.price},${e.date}`).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expenses.csv';
  a.click();
});

// Chart
function renderChart() {
  let expenses = [];
  const encrypted = localStorage.getItem('expenses');
  if (encrypted) {
    const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
    expenses = JSON.parse(decrypted);
  }
  const data = {};
  expenses.forEach(e => {
    if (!data[e.date]) data[e.date] = 0;
    data[e.date] += e.price;
  });
  const labels = Object.keys(data);
  const values = Object.values(data);
  const ctx = document.getElementById('chartCanvas').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Expenses',
        data: values,
        borderColor: '#00acc1',
        backgroundColor: 'rgba(0, 172, 193, 0.2)',
      }]
    }
  });
}

// Firebase sync
function syncToFirebase(expenses) {
  db.collection('expenses').doc('user').set({ expenses });
}

// PWA registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
  });
}

// Load on start
loadExpenses();
showScreen('scanScreen');