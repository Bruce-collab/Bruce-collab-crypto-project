// app.js
const web3 = new Web3("https://mainnet.infura.io/v3/f585e0c775484d678e846f28285683a3");  // Infura URL

let currentWallet = null;
let wallets = [];

// Add Wallet to the Wallets List
function addWallet(privateKey) {
    const wallet = web3.eth.accounts.privateKeyToAccount(privateKey);
    wallets.push(wallet);
    localStorage.setItem('wallets', JSON.stringify(wallets));
    updateWalletSelector();
}

// Update Wallet Dropdown Selector
function updateWalletSelector() {
    const walletSelector = document.getElementById('wallet-selector');
    walletSelector.innerHTML = '';
    wallets.forEach((wallet, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.text = wallet.address;
        walletSelector.appendChild(option);
    });
}

// Switch Wallet
document.getElementById('wallet-selector').addEventListener('change', (event) => {
    currentWallet = wallets[event.target.value];
    updateWalletInfo(currentWallet);
});

// Update Wallet Info
function updateWalletInfo(wallet) {
    document.getElementById('balance').innerText = `${web3.utils.fromWei(wallet.balance, 'ether')} ETH`;
    document.getElementById('private-key').innerText = wallet.privateKey;
}

// Generate Random Nonce (1-10)
function getRandomNonce() {
    return Math.floor(Math.random() * 10) + 1;
}

// Send Flash Transaction
document.getElementById('send-flash-btn').addEventListener('click', async () => {
    const recipient = document.getElementById('recipient').value;
    const amountUSD = document.getElementById('amount').value;
    const token = document.getElementById('token-selector').value;

    if (!currentWallet || !recipient || !amountUSD) {
        alert("Please provide all required fields.");
        return;
    }

    // Convert USD to USDT/USDC (assuming 1:1 rate)
    const amount = web3.utils.toWei(amountUSD, 'ether'); // assuming the token has 6 decimals
    
    const tokenAddress = token === 'USDT' ? '0xdAC17F958D2ee523a2206206994597C13D831ec7' : '0xA0b86991c6218b36c1d19d4A2e9eb0ce3606eB48'; // USDT and USDC contract addresses
    const data = web3.eth.abi.encodeFunctionCall({
        name: 'transfer',
        type: 'function',
        inputs: [
            { type: 'address', name: '_to' },
            { type: 'uint256', name: '_value' }
        ]
    }, [recipient, amount]);

    // Estimate Gas
    const gasPrice = await web3.eth.getGasPrice();
    const gasLimit = await web3.eth.estimateGas({
        to: tokenAddress,
        data: data
    });

    // Generate random nonce for transaction
    const nonce = getRandomNonce();

    const tx = {
        to: tokenAddress,
        data: data,
        gasPrice: gasPrice,
        gas: gasLimit,
        from: currentWallet.address,
        nonce: nonce // Use random nonce
    };

    web3.eth.accounts.signTransaction(tx, currentWallet.privateKey).then(signedTx => {
        web3.eth.sendSignedTransaction(signedTx.rawTransaction).on('transactionHash', (hash) => {
            document.getElementById('status').innerText = `${amountUSD} ${token} has been flashed to ${recipient} with nonce: ${nonce}`;
            const txLink = document.getElementById('tx-link');
            txLink.style.display = 'inline';
            txLink.href = `https://etherscan.io/tx/${hash}`;

            // Display confirmation message
            const confirmationMessage = document.getElementById('confirmation-message');
            confirmationMessage.innerText = `${amountUSD} ${token} has been flashed to ${recipient} with nonce: ${nonce}`;
        }).on('error', (err) => {
            document.getElementById('status').innerText = `Error: ${err.message}`;
        });
    });
});

// Forcefully Revert a Flash (Use Higher Nonce to Cancel)
document.getElementById('revert-flash-btn').addEventListener('click', async () => {
    const nonceToRevert = getRandomNonce() + 10; // Higher nonce to overwrite (e.g., random nonce + 10)

    if (!nonceToRevert) {
        alert("Please enter a nonce to revert.");
        return;
    }

    // Create a higher nonce transaction to "cancel" the previous one
    const tx = {
        to: currentWallet.address,
        data: '0x',
        gasPrice: await web3.eth.getGasPrice(),
        gas: 21000, // Basic transfer gas limit
        from: currentWallet.address,
        nonce: nonceToRevert // Using higher nonce to overwrite the previous one
    };

    web3.eth.accounts.signTransaction(tx, currentWallet.privateKey).then(signedTx => {
        web3.eth.sendSignedTransaction(signedTx.rawTransaction).on('transactionHash', (hash) => {
            document.getElementById('status').innerText = `Flash Transaction with Nonce ${nonceToRevert} has been forced to cancel.`;
            const txLink = document.getElementById('tx-link');
            txLink.style.display = 'inline';
            txLink.href = `https://etherscan.io/tx/${hash}`;
        }).on('error', (err) => {
            document.getElementById('status').innerText = `Error: ${err.message}`;
        });
    });
});