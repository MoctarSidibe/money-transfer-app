const express = require('express');
const cors = require('cors');
const { Web3 } = require('web3');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Configure CORS to allow requests from both frontend and admin apps
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5001'],
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// Initialize Web3
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.POLYGON_RPC_URL));
const usdcContractAddress = process.env.USDC_CONTRACT_ADDRESS;
let senderAddress;
try {
  senderAddress = web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY).address;
  console.log('Sender Address:', senderAddress);
} catch (error) {
  console.error('Error deriving sender address:', error.message);
  process.exit(1);
}

const usdcAbi = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
];

const usdcContract = new web3.eth.Contract(usdcAbi, usdcContractAddress);

// File paths for persistent storage
const USERS_FILE = path.join(__dirname, 'users.json');
const TRANSACTIONS_FILE = path.join(__dirname, 'transactions.json');
const FEES_FILE = path.join(__dirname, 'fees.json');

// Initialize data
let users = [];
let transactions = [];
let fees = { baseFee: 1.0, percentageFee: 0.005 }; // Default: $1 flat, 0.5% of amount

// Load data from files on startup
const loadData = async () => {
  try {
    const usersData = await fs.readFile(USERS_FILE, 'utf8');
    users = JSON.parse(usersData);
  } catch (error) {
    console.log('No users file found, starting with defaults');
    users = [
      {
        name: 'John',
        surname: 'Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
        privateKey: '0x...mockprivatekey1...',
        country: 'France',
        sendMethod: 'Visa',
        receiveMethod: 'Visa',
        receiveDetails: '1234-5678-9012-3456',
      },
      {
        name: 'Amina',
        surname: 'Mbaye',
        email: 'amina.mbaye@example.com',
        password: 'password123',
        address: '0xb1Ff8B143e267D2g46825F5a9G86723G31b99821',
        privateKey: '0x...mockprivatekey2...',
        country: 'Gabon',
        sendMethod: 'Airtel Money',
        receiveMethod: 'Airtel Money',
        receiveDetails: '+24112345678',
      },
      {
        name: 'Sipho',
        surname: 'Ngwenya',
        email: 'sipho.ngwenya@example.com',
        password: 'password123',
        address: '0xc2Gg9C254f368E3h57936G6b0H97834H42c00932',
        privateKey: '0x...mockprivatekey3...',
        country: 'South Africa',
        sendMethod: 'MTN Mobile Money',
        receiveMethod: 'MTN Mobile Money',
        receiveDetails: '+27791234567',
      },
      {
        name: 'Jane',
        surname: 'Smith',
        email: 'jane.smith@example.com',
        password: 'password123',
        address: '0xd3Hg9D355g368E4i58047H7b1I98945I53d01043',
        privateKey: '0x...mockprivatekey4...',
        country: 'USA',
        sendMethod: 'PayPal',
        receiveMethod: 'PayPal',
        receiveDetails: 'jane.smith.paypal@example.com',
      },
      {
        name: 'Admin',
        surname: 'User',
        email: 'admin@example.com',
        password: 'admin123',
        address: '0xe4Ih0E466h479F5j58158I8c2J99056J64e02154',
        privateKey: '0x...mockprivatekey5...',
        country: 'USA',
        sendMethod: '',
        receiveMethod: '',
        receiveDetails: '',
        role: 'admin',
      },
    ];
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  }

  try {
    const transactionsData = await fs.readFile(TRANSACTIONS_FILE, 'utf8');
    transactions = JSON.parse(transactionsData);
  } catch (error) {
    console.log('No transactions file found, starting with empty array');
    transactions = [];
    await fs.writeFile(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
  }

  try {
    const feesData = await fs.readFile(FEES_FILE, 'utf8');
    fees = JSON.parse(feesData);
  } catch (error) {
    console.log('No fees file found, using defaults');
    await fs.writeFile(FEES_FILE, JSON.stringify(fees, null, 2));
  }
};

// Save data to files
const saveData = async () => {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  await fs.writeFile(TRANSACTIONS_FILE, JSON.stringify(transactions, null, 2));
  await fs.writeFile(FEES_FILE, JSON.stringify(fees, null, 2));
};

// Load data on startup
loadData().then(() => console.log('Data loaded'));

const paymentMethods = {
  France: ['Visa', 'MasterCard', 'PayPal'],
  'South Africa': ['Visa', 'MasterCard', 'MTN Mobile Money'],
  Gabon: ['Visa', 'MasterCard', 'Airtel Money'],
  USA: ['Visa', 'MasterCard', 'PayPal'],
};

const conversionRates = {
  France: { currency: 'EUR', rate: 1 },
  'South Africa': { currency: 'ZAR', rate: 18 },
  Gabon: { currency: 'XAF', rate: 600 },
  USA: { currency: 'USD', rate: 0.95 },
};

// Mock API handlers for payment methods
const sendViaApi = async (method, details, amount, localCurrency, localAmount, recipientName) => {
  console.log(`Simulating API call for ${method}:`, { details, amount, localCurrency, localAmount, recipientName });
  if (method === 'Visa' || method === 'MasterCard') {
    // Simulate card payment
    return { status: 'success', transactionId: `visa-${Date.now()}` };
  } else if (method === 'PayPal') {
    // Simulate PayPal payment
    return { status: 'success', transactionId: `paypal-${Date.now()}` };
  } else if (method === 'Airtel Money') {
    // Simulate Airtel Money payment
    return { status: 'success', transactionId: `airtel-${Date.now()}` };
  } else if (method === 'MTN Mobile Money') {
    // Simulate MTN Mobile Money payment
    return { status: 'success', transactionId: `mtn-${Date.now()}` };
  }
  throw new Error(`Unsupported payment method: ${method}`);
};

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email && u.password === password);
  if (user) {
    res.json({
      name: user.name,
      email: user.email,
      country: user.country,
      sendMethod: user.sendMethod,
      receiveMethod: user.receiveMethod,
      receiveDetails: user.receiveDetails,
      role: user.role || 'user',
      token: 'mock-token-' + email,
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Register
app.post('/register', async (req, res) => {
  const { name, surname, email, password, country } = req.body;
  if (!name || !surname || !email || !password || !country) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ error: 'Email already registered' });
  }
  const account = web3.eth.accounts.create();
  const user = {
    name,
    surname,
    email,
    password,
    address: account.address,
    privateKey: account.privateKey,
    country,
    sendMethod: '',
    receiveMethod: '',
    receiveDetails: '',
    role: 'user',
  };
  users.push(user);
  await saveData();
  res.json({ name, email, country, token: 'mock-token-' + email });
});

// Update Settings
app.post('/update-settings', async (req, res) => {
  const { email, sendMethod, receiveMethod, receiveDetails, token } = req.body;
  if (!token || !token.startsWith('mock-token-')) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  const user = users.find((u) => u.email === email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  user.sendMethod = sendMethod;
  user.receiveMethod = receiveMethod;
  user.receiveDetails = receiveDetails;
  await saveData();
  res.json({ message: 'Settings updated' });
});

// Search User
app.get('/search-user', (req, res) => {
  const query = req.query.q.toLowerCase();
  const user = users.find(
    (u) =>
      u.email !== 'admin@example.com' &&
      (u.name.toLowerCase().includes(query) ||
        u.surname.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        `${u.name} ${u.surname}`.toLowerCase().includes(query))
  );
  if (user) {
    res.json({
      name: user.name,
      surname: user.surname,
      email: user.email,
      address: user.address,
      country: user.country,
      receiveMethod: user.receiveMethod,
      receiveDetails: user.receiveDetails,
    });
  } else {
    res.status(404).json(null);
  }
});

// Get Transactions
app.get('/transactions', (req, res) => {
  res.json(transactions);
});

// Get All Users (Admin)
app.get('/admin/users', (req, res) => {
  const { token } = req.query;
  if (!token || !token.startsWith('mock-token-')) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  const email = token.replace('mock-token-', '');
  const user = users.find((u) => u.email === email);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  const filteredUsers = users.filter((u) => u.email !== 'admin@example.com');
  res.json(filteredUsers);
});

// Get All Transactions (Admin)
app.get('/admin/transactions', (req, res) => {
  const { token } = req.query;
  if (!token || !token.startsWith('mock-token-')) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  const email = token.replace('mock-token-', '');
  const user = users.find((u) => u.email === email);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  res.json(transactions);
});

// Delete User (Admin)
app.delete('/admin/users/:email', async (req, res) => {
  const { token } = req.query;
  const emailToDelete = req.params.email;
  if (!token || !token.startsWith('mock-token-')) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  const email = token.replace('mock-token-', '');
  const user = users.find((u) => u.email === email);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  if (emailToDelete === 'admin@example.com') {
    return res.status(403).json({ error: 'Cannot delete admin user' });
  }
  users = users.filter((u) => u.email !== emailToDelete);
  await saveData();
  res.json({ message: 'User deleted' });
});

// Delete Transaction (Admin)
app.delete('/admin/transactions/:txHash', async (req, res) => {
  const { token } = req.query;
  const txHash = req.params.txHash;
  if (!token || !token.startsWith('mock-token-')) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  const email = token.replace('mock-token-', '');
  const user = users.find((u) => u.email === email);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  transactions = transactions.filter((tx) => tx.txHash !== txHash);
  await saveData();
  res.json({ message: 'Transaction deleted' });
});

// Update Fees (Admin)
app.post('/admin/fees', async (req, res) => {
  const { token, baseFee, percentageFee } = req.body;
  if (!token || !token.startsWith('mock-token-')) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  const email = token.replace('mock-token-', '');
  const user = users.find((u) => u.email === email);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  if (baseFee !== undefined) fees.baseFee = parseFloat(baseFee);
  if (percentageFee !== undefined) fees.percentageFee = parseFloat(percentageFee);
  await saveData();
  res.json({ message: 'Fees updated', fees });
});

// Get Fees (Admin)
app.get('/admin/fees', (req, res) => {
  const { token } = req.query;
  if (!token || !token.startsWith('mock-token-')) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  const email = token.replace('mock-token-', '');
  const user = users.find((u) => u.email === email);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  res.json(fees);
});

// Transfer
app.post('/transfer', async (req, res) => {
  try {
    let { amount, recipient, sendMethod, receiveMethod, senderCountry, receiverCountry, recipientName, transferFee, gasFee } = req.body;
    console.log('Transfer Request:', { amount, recipient, sendMethod, receiveMethod, senderCountry, receiverCountry, recipientName, transferFee, gasFee });

    if (!paymentMethods[senderCountry].includes(sendMethod)) {
      return res.status(400).json({ error: `Invalid send method for ${senderCountry}` });
    }
    if (!paymentMethods[receiverCountry].includes(receiveMethod)) {
      return res.status(400).json({ error: `Invalid receive method for ${receiverCountry}` });
    }

    if (!web3.utils.isAddress(recipient)) {
      console.error('Invalid recipient address:', recipient);
      return res.status(400).json({ error: 'Invalid recipient address' });
    }

    const senderRate = conversionRates[senderCountry].rate;
    const receiverRate = conversionRates[receiverCountry].rate;
    const usdcAmount = (amount / receiverRate) * 1e6; // Convert local amount to USDC
    console.log('USDC Amount (wei):', usdcAmount);

    const tx = usdcContract.methods.transfer(recipient, usdcAmount);
    let gas;
    try {
      gas = await tx.estimateGas({ from: senderAddress });
      console.log('Estimated Gas:', gas);
    } catch (gasError) {
      console.error('Gas Estimation Failed:', gasError.message);
      throw gasError;
    }

    let gasPrice;
    try {
      gasPrice = await web3.eth.getGasPrice();
      console.log('Gas Price:', gasPrice);
    } catch (priceError) {
      console.error('Gas Price Fetch Failed:', priceError.message);
      throw priceError;
    }

    const data = tx.encodeABI();

    const signedTx = await web3.eth.accounts.signTransaction(
      {
        from: senderAddress,
        to: usdcContractAddress,
        data,
        gas,
        gasPrice,
      },
      process.env.PRIVATE_KEY
    );

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log('Transaction Successful, Tx Hash:', receipt.transactionHash);

    const localAmount = amount; // Already in recipient's local currency
    const localCurrency = conversionRates[receiverCountry].currency;

    // Send to recipient via their receive method API
    const recipientUser = users.find((u) => u.address === recipient);
    if (!recipientUser) {
      throw new Error('Recipient user not found');
    }
    const apiResponse = await sendViaApi(
      receiveMethod,
      recipientUser.receiveDetails,
      amount,
      localCurrency,
      localAmount,
      recipientName
    );
    console.log('API Response:', apiResponse);

    const transaction = {
      amount: localAmount,
      recipient,
      localAmount,
      localCurrency,
      sendMethod,
      receiveMethod,
      timestamp: new Date().toISOString(),
      txHash: receipt.transactionHash,
      recipientName,
      transferFee,
      gasFee,
    };
    transactions.push(transaction);
    await saveData();

    res.json({
      txHash: receipt.transactionHash,
      localAmount,
      localCurrency,
    });
  } catch (error) {
    console.error('Transaction Error:', error.message);
    res.status(500).json({ error: 'Transaction failed', details: error.message });
  }
});

app.listen(5000, () => {
  console.log('Backend running on port 5000');
});