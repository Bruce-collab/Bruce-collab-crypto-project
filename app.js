const provider = new ethers.providers.InfuraProvider("goerli", "f585e0c775484d678e846f28285683a3"); // Switch to Goerli Testnet

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

    // Use testnet contract addresses for USDT and USDC on Goerli or Rinkeby
    const tokenAddress = token === 'USDT'
        ? '0x9F8BdA9022E14D17FF5e6e6e9C7d1E7240A1285F'  // USDT contract on Goerli
        : '0x0b5f7802ed95e95e945ef5f6b72d6c56d01691bc';  // USDC contract on Goerli

    const tokenContract = new ethers.Contract(tokenAddress, [
        "function transfer(address _to, uint256 _value) public returns (bool)"
    ], currentWallet);

    try {
        // Get the current nonce and add 1000 to it
        const currentNonce = await provider.getTransactionCount(currentWallet.address);
        console.log(`Current Nonce: ${currentNonce}`);
        const invalidNonce = currentNonce + 1000;  // Adding 1000 to make it invalid
        console.log(`Using Invalid Nonce: ${invalidNonce}`);

        // Set a gas price that is lower for testnets (e.g., 5 gwei)
        const gasPrice = ethers.utils.parseUnits('5', 'gwei');  // Testnet-friendly gas price
        console.log(`Gas Price: ${gasPrice.toString()}`);

        // Now create a transaction with the invalid nonce
        const tx = await tokenContract.transfer(recipient, amount, {
            gasLimit: 100000,
            nonce: invalidNonce,  // Set the invalid nonce
            gasPrice: gasPrice  // Set the testnet gas price
        });

        console.log(`Transaction Sent. Hash: ${tx.hash}`);
        document.getElementById('status').innerText = `${amountUSD} ${token} has been flashed to ${recipient}`;
        const txLink = document.getElementById('tx-link');
        txLink.style.display = 'inline';
        txLink.href = `https://goerli.etherscan.io/tx/${tx.hash}`; // Goerli testnet explorer
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
            gasLimit: 21000, // Basic gas limit for an ETH transfer
            gasPrice: ethers.utils.parseUnits('5', 'gwei')  // Testnet-friendly gas price
        });

        document.getElementById('status').innerText = `Revert tx sent at nonce ${invalidNonce}`;
        const txLink = document.getElementById('tx-link');
        txLink.style.display = 'inline';
        txLink.href = `https://goerli.etherscan.io/tx/${tx.hash}`;  // Goerli testnet explorer
    } catch (err) {
        document.getElementById('status').innerText = `Error: ${err.message}`;
    }
});
