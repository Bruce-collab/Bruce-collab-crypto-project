const web3 = new Web3("https://mainnet.infura.io/v3/f585e0c775484d678e846f28285683a3");

let currentWallet = null;
let wallets = [];

function addWallet(privateKey) {
    try {
        const wallet = web3.eth.accounts.privateKeyToAccount(privateKey);
        wallets.push(wallet);
        localStorage.setItem('wallets', JSON.stringify(wallets));
        updateWalletSelector();
    } catch (error) {
        alert("Invalid private key");
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

document.getElementById('wallet-selector').addEventListener('change', (event) => {
    currentWallet = wallets[event.target.value];
    updateWalletInfo(currentWallet);
});

function updateWalletInfo(wallet) {
    web3.eth.getBalance(wallet.address).then(balance => {
        document.getElementById('balance').innerText = `${web3.utils.fromWei(balance, 'ether')} ETH`;
    });
}

function getRandomNonce() {
    return Math.floor(Math.random() * 10) + 1;
}

document.getElementById('send-flash-btn').addEventListener('click', async () => {
    const recipient = document.getElementById('recipient').value;
    const amountUSD = document.getElementById('amount').value;
    const token = document.getElementById('token-selector').value;
    const privateKeyInput = document.getElementById('private-key').value;

    if (!privateKeyInput) {
        alert("Please enter a private key.");
        return;
    }

    addWallet(privateKeyInput);

    if (!recipient || !amountUSD || !token || !currentWallet) {
        alert("Please provide all required fields.");
        return;
    }

    const amount = web3.utils.toWei(amountUSD, 'ether');
    const tokenAddress = token === 'USDT' ? '0xdAC17F958D2ee523a2206206994597C13D831ec7' : '0xA0b86991c6218b36c1d19d4A2e9eb0ce3606eB48';
    const data = web3.eth.abi.encodeFunctionCall({
        name: 'transfer',
        type: 'function',
        inputs: [
            { type: 'address', name: '_to' },
            { type: 'uint256', name: '_value' }
        ]
    }, [recipient, amount]);

    const gasPrice = await web3.eth.getGasPrice();
    const gasLimit = await web3.eth.estimateGas({
        to: tokenAddress,
        data: data
    });

    const nonce = getRandomNonce();

    const tx = {
        to: tokenAddress,
        data: data,
        gasPrice: gasPrice,
        gas: gasLimit,
        from: currentWallet.address,
        nonce: nonce
    };

    web3.eth.accounts.signTransaction(tx, currentWallet.privateKey).then(signedTx => {
        web3.eth.sendSignedTransaction(signedTx.rawTransaction).on('transactionHash', (hash) => {
            document.getElementById('status').innerText = `${amountUSD} ${token} has been flashed to ${recipient} with nonce: ${nonce}`;
            const txLink = document.getElementById('tx-link');
            txLink.style.display = 'inline';
            txLink.href = `https://etherscan.io/tx/${hash}`;

            const confirmationMessage = document.getElementById('confirmation-message');
            confirmationMessage.innerText = `${amountUSD} ${token} has been flashed to ${recipient} with nonce: ${nonce}`;
        }).on('error', (err) => {
            document.getElementById('status').innerText = `Error: ${err.message}`;
        });
    });
});

document.getElementById('revert-flash-btn').addEventListener('click', async () => {
    const nonceToRevert = getRandomNonce() + 10;

    if (!nonceToRevert) {
        alert("Please enter a nonce to revert.");
        return;
    }

    const tx = {
        to: currentWallet.address,
        data: '0x',
        gasPrice: await web3.eth.getGasPrice(),
        gas: 21000,
        from: currentWallet.address,
        nonce: nonceToRevert
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
