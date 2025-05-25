const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const app = express();

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));
app.use(fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } }));

let users = [];
let transactions = [];
const usersFilePath = './users.json';
const transactionsFilePath = './business-transactions.json';

// Mock conversion rates for business payments
const conversionRates = {
  'USA': { currency: 'USD' },
  'Gabon': { currency: 'XAF' },
  'UK': { currency: 'GBP' },
  'EU': { currency: 'EUR' },
};

// Load data from files on startup
const loadData = () => {
  try {
    if (fs.existsSync(usersFilePath)) users = JSON.parse(fs.readFileSync(usersFilePath));
    if (fs.existsSync(transactionsFilePath)) transactions = JSON.parse(fs.readFileSync(transactionsFilePath));
    console.log('Data loaded:', { users: users.length, transactions: transactions.length });
  } catch (error) {
    console.error('Error loading data:', error.message);
    users = [];
    transactions = [];
  }
};

// Save data to files
const saveData = () => {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    fs.writeFileSync(transactionsFilePath, JSON.stringify(transactions, null, 2));
    console.log('Data saved to files');
  } catch (error) {
    console.error('Error saving data:', error.message);
  }
};

// Load data on startup
loadData();

console.log('Defining endpoints...');
// Register business endpoint
app.post('/register-business', (req, res) => {
  const { email, password, country, businessName, businessDescription } = req.body;
  if (!email || !businessName) return res.status(400).json({ error: 'Email and business name are required' });
  if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already exists' });

  const user = {
    id: users.length ? users[users.length - 1].id + 1 : 1,
    email,
    password,
    country,
    userType: 'business',
    businessName,
    businessDescription,
    token: 'mock-token-' + Math.random().toString(36).substr(2),
    receiveMethod: null,
    receiveDetails: null,
    profilePic: null,
  };
  users.push(user);
  saveData();
  res.status(201).json(user);
});

// Get user endpoint
app.get('/get-user', (req, res) => {
  const { email, token } = req.query;
  if (!email || !token) return res.status(400).json({ error: 'Email and token are required' });
  if (!token.startsWith('mock-token-')) return res.status(401).json({ error: 'Invalid token' });
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Upload profile picture endpoint
app.post('/upload-profile-pic', (req, res) => {
  const { email, token } = req.query;
  if (!email || !token) return res.status(400).json({ error: 'Email and token are required' });
  if (!token.startsWith('mock-token-')) return res.status(401).json({ error: 'Invalid token' });
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!req.files || !req.files.profilePic) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const profilePic = req.files.profilePic;
  const uploadPath = `./uploads/${email}-${Date.now()}-${profilePic.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  profilePic.mv(uploadPath, (err) => {
    if (err) {
      console.error('Error saving file:', err);
      return res.status(500).json({ error: 'Failed to upload file' });
    }
    user.profilePic = uploadPath;
    saveData();
    res.json({ profilePic: uploadPath });
  });
});

// Update settings endpoint
app.post('/update-settings', (req, res) => {
  const { email, token, receiveMethod, receiveDetails, sendMethod } = req.body;
  if (!email || !token) return res.status(400).json({ error: 'Email and token are required' });
  if (!token.startsWith('mock-token-')) return res.status(401).json({ error: 'Invalid token' });
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.receiveMethod = receiveMethod || user.receiveMethod;
  user.receiveDetails = receiveDetails || user.receiveDetails;
  user.sendMethod = sendMethod || user.sendMethod;
  saveData();
  res.json(user);
});

// Update profile endpoint
app.post('/update-profile', (req, res) => {
  const { email, name, businessName, businessDescription, token } = req.body;
  if (!email || !token) return res.status(400).json({ error: 'Email and token are required' });
  if (!token.startsWith('mock-token-')) return res.status(401).json({ error: 'Invalid token' });
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.businessName = businessName || user.businessName;
  user.businessDescription = businessDescription || user.businessDescription;
  saveData();
  res.json(user);
});

// Search business endpoint
app.get('/search-business', (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Search query is required' });
  const businesses = users.filter(u =>
    u.userType === 'business' &&
    (u.businessName.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()))
  );
  res.json(businesses);
});

// Business payment endpoint
app.post('/business-payment', (req, res) => {
  const { amount, senderEmail, businessEmail, token, senderCountry, receiverCountry, sendMethod, receiveMethod, transferFee, gasFee } = req.body;
  if (!amount || !senderEmail || !businessEmail || !token) return res.status(400).json({ error: 'Missing required fields' });
  if (!token.startsWith('mock-token-')) return res.status(401).json({ error: 'Invalid token' });
  const business = users.find(u => u.email === businessEmail && u.userType === 'business');
  if (!business) return res.status(404).json({ error: 'Business not found' });
  if (!business.receiveMethod || !business.receiveDetails) return res.status(400).json({ error: 'Business has not set up receive method' });
  const transaction = {
    id: transactions.length ? transactions[transactions.length - 1].id + 1 : 1,
    amount: parseFloat(amount),
    currency: conversionRates[receiverCountry]?.currency || 'USD',
    senderEmail,
    businessEmail,
    senderCountry,
    receiverCountry,
    sendMethod,
    receiveMethod,
    transferFee: parseFloat(transferFee || 0),
    gasFee: parseFloat(gasFee || 0),
    timestamp: new Date().toISOString(),
  };
  transactions.push(transaction);
  saveData();
  res.status(201).json({ transactionId: `mock-transaction-${Date.now()}` });
});

// Get business transactions endpoint
app.get('/business-transactions', (req, res) => {
  const { email, token } = req.query;
  if (!email || !token) return res.status(400).json({ error: 'Email and token are required' });
  if (!token.startsWith('mock-token-')) return res.status(401).json({ error: 'Invalid token' });
  const userTransactions = transactions.filter(tx => tx.senderEmail === email || tx.businessEmail === email);
  res.json(userTransactions);
});

// Error handling for large payloads
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 413 && 'body' in err) {
    return res.status(413).json({ error: 'Request entity too large. Please upload a smaller file (max 10MB).' });
  }
  next();
});

console.log('Starting server...');
app.listen(5002, () => console.log('Business server running on port 5002'));